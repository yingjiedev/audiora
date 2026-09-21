import { IAppConfig } from "@/types/core/config";
import { ITrackPlayer } from "@/types/core/trackPlayer";
import { IInjectable } from "@/types/infra";
import LyricParser, { IParsedLrcItem } from "@/utils/lrcParser";
import { getMediaExtraProperty, patchMediaExtra } from "@/utils/mediaExtra";
import { isSameMediaItem } from "@/utils/mediaUtils";
import minDistance from "@/utils/minDistance";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { Plugin } from "./pluginManager";

import pathConst from "@/constants/pathConst";
import { checkAndCreateDir } from "@/utils/fileUtils";
import PersistStatus from "@/utils/persistStatus";
import CryptoJs from "crypto-js";
import { unlink, writeFile } from "react-native-fs";
import RNTrackPlayer, { Event, State } from "react-native-track-player";
import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import { IPluginManager } from "@/types/core/pluginManager";
import { autoDecryptLyric } from "@/utils/musicDecrypter";
import { devLog } from "@/utils/log";
import {
    cancelAnimation,
    Easing,
    makeMutable,
    withTiming,
    type SharedValue,
} from "react-native-reanimated";

// Lazily create the shared value to avoid touching Reanimated during module load.
let currentPositionMsShared: SharedValue<number> | null = null;

export function getCurrentPositionMsShared(): SharedValue<number> {
    if (!currentPositionMsShared) {
        currentPositionMsShared = makeMutable(0);
    }

    return currentPositionMsShared;
}


interface ILyricState {
    loading: boolean;
    lyrics: IParsedLrcItem[];
    hasTranslation: boolean;
    hasRomanization: boolean;
    meta?: Record<string, string>;
}

const defaultLyricState = {
    loading: true,
    lyrics: [],
    hasTranslation: false,
    hasRomanization: false,
};

const lyricStateAtom = atom<ILyricState>(defaultLyricState);
const currentLyricItemAtom = atom<IParsedLrcItem | null>(null);
// 当前播放位置（毫秒），用于逐字歌词效果
const currentPositionMsAtom = atom<number>(0);

// Throttle interval for position updates (ms)
// 16ms = 60fps, provides buttery smooth animation
const POSITION_UPDATE_THROTTLE = 16;
// TrackPlayer reports progress every 100ms, but restarting a 110ms animation on
// every report makes its velocity visibly pulse. Keep a long-running UI-thread
// clock instead and only resync it occasionally, like AMll's RAF time anchor.
const POSITION_CLOCK_RUNWAY_MS = 60_000;
const POSITION_CLOCK_RESYNC_INTERVAL_MS = 5_000;
const POSITION_CLOCK_MAX_DRIFT_MS = 160;
const POSITION_CLOCK_CORRECTION_MS = 2_000;
class LyricManager implements IInjectable {

    private trackPlayer!: ITrackPlayer;
    private appConfig!: IAppConfig;
    private pluginManager!: IPluginManager;

    private lyricParser: LyricParser | null = null;

    // Throttle state for position updates
    private lastPositionUpdateTime: number = 0;
    private pendingPositionMs: number = 0;
    private positionUpdateTimer: ReturnType<typeof setTimeout> | null = null;
    private isPlaybackAdvancing = false;

    // Track last position for seek detection
    private lastProgressPositionMs: number = 0;

    // Continuous UI-thread clock state for karaoke rendering
    private isPositionClockRunning = false;
    private positionClockRate = 1;
    private lastPositionClockSyncTime = 0;
    private positionClockCorrectionUntil = 0;


    get currentLyricItem() {
        return getDefaultStore().get(currentLyricItemAtom);
    }

    get lyricState() {
        return getDefaultStore().get(lyricStateAtom);
    }

    syncAfterSeek(
        positionSeconds: number,
        isPlaying: boolean,
    ): IParsedLrcItem | null | undefined {
        if (!Number.isFinite(positionSeconds)) {
            return;
        }

        const safePositionSeconds = Math.max(0, positionSeconds);
        const positionMs = safePositionSeconds * 1000;

        if (this.positionUpdateTimer) {
            clearTimeout(this.positionUpdateTimer);
            this.positionUpdateTimer = null;
        }
        this.pendingPositionMs = positionMs;
        this.lastPositionUpdateTime = Date.now();
        this.lastProgressPositionMs = positionMs;
        this.isPlaybackAdvancing = isPlaying;

        getDefaultStore().set(currentPositionMsAtom, positionMs);
        this.syncPositionClock(positionMs, true);

        const parser = this.lyricParser;
        if (!parser || !this.trackPlayer.isCurrentMusic(parser.musicItem)) {
            return;
        }

        const lyricItem = parser.getPosition(safePositionSeconds);
        getDefaultStore().set(currentLyricItemAtom, lyricItem ?? null);

        return lyricItem ?? null;
    }

    injectDependencies(trackPlayerService: ITrackPlayer, appConfigService: IAppConfig, pluginManager: IPluginManager): void {
        this.trackPlayer = trackPlayerService;
        this.appConfig = appConfigService;
        this.pluginManager = pluginManager;
    }

    private getPositionClockRate() {
        const persistedRate = Number(PersistStatus.get("music.rate") ?? 100) / 100;
        return Number.isFinite(persistedRate) && persistedRate > 0 ? persistedRate : 1;
    }

    private stopPositionClock(positionMs: number) {
        const positionShared = getCurrentPositionMsShared();
        cancelAnimation(positionShared);
        positionShared.value = positionMs;
        this.isPositionClockRunning = false;
        this.lastPositionClockSyncTime = 0;
        this.positionClockCorrectionUntil = 0;
    }

    private syncPositionClock(positionMs: number, force = false) {
        if (!this.isPlaybackAdvancing) {
            this.stopPositionClock(positionMs);
            return;
        }

        const positionShared = getCurrentPositionMsShared();
        const now = Date.now();
        const rate = this.getPositionClockRate();

        if (force || !this.isPositionClockRunning) {
            cancelAnimation(positionShared);
            positionShared.value = positionMs;
            positionShared.value = withTiming(
                positionMs + POSITION_CLOCK_RUNWAY_MS * rate,
                {
                    duration: POSITION_CLOCK_RUNWAY_MS,
                    easing: Easing.linear,
                },
            );
            this.isPositionClockRunning = true;
            this.positionClockRate = rate;
            this.lastPositionClockSyncTime = now;
            this.positionClockCorrectionUntil = 0;
            return;
        }

        // Let an in-flight correction finish instead of restarting it on every
        // 100ms progress event. Repeated restarts were the visible stutter.
        if (now < this.positionClockCorrectionUntil) return;

        // A short drift correction has just completed. Immediately hand the
        // clock back to a long linear run so it never pauses at the target.
        if (this.positionClockCorrectionUntil > 0) {
            this.positionClockCorrectionUntil = 0;
            positionShared.value = withTiming(
                positionMs + POSITION_CLOCK_RUNWAY_MS * rate,
                {
                    duration: POSITION_CLOCK_RUNWAY_MS,
                    easing: Easing.linear,
                },
            );
            this.positionClockRate = rate;
            this.lastPositionClockSyncTime = now;
            return;
        }

        const rateChanged = Math.abs(rate - this.positionClockRate) > 0.001;
        const shouldResync =
            rateChanged ||
            now - this.lastPositionClockSyncTime >= POSITION_CLOCK_RESYNC_INTERVAL_MS;
        if (!shouldResync) return;

        // Reading a SharedValue from JS synchronizes with the UI thread. Do it
        // only at the low-frequency resync point, never on every progress event.
        const drift = positionMs - positionShared.value;
        if (Math.abs(drift) > POSITION_CLOCK_MAX_DRIFT_MS) {
            positionShared.value = withTiming(
                positionMs + POSITION_CLOCK_CORRECTION_MS * rate,
                {
                    duration: POSITION_CLOCK_CORRECTION_MS,
                    easing: Easing.linear,
                },
            );
            this.positionClockRate = rate;
            this.lastPositionClockSyncTime = now;
            this.positionClockCorrectionUntil = now + POSITION_CLOCK_CORRECTION_MS;
            return;
        }

        positionShared.value = withTiming(
            positionMs + POSITION_CLOCK_RUNWAY_MS * rate,
            {
                duration: POSITION_CLOCK_RUNWAY_MS,
                easing: Easing.linear,
            },
        );
        this.positionClockRate = rate;
        this.lastPositionClockSyncTime = now;
    }

    setup() {
        // 更新歌词 - 延迟异步执行，完全不阻塞播放
        this.trackPlayer.on(TrackPlayerEvents.CurrentMusicChanged, (musicItem) => {
            devLog('info', '[LyricManager] Music changed event triggered', {
                title: musicItem?.title,
                timestamp: Date.now()
            });

            // CRITICAL FIX: Delay lyric loading to ensure playback starts immediately
            // Use setTimeout to push lyric loading to end of event queue
            setTimeout(() => {
                devLog('info', '[LyricManager] Starting delayed lyric load', {
                    title: musicItem?.title,
                    timestamp: Date.now()
                });

                this.refreshLyric(true, true).catch(err => {
                    devLog('warn', 'Lyric loading failed but playback continues', err);
                });
            }, 0);
        });

        this.trackPlayer.on(TrackPlayerEvents.ProgressChanged, progress => {
            this.syncAfterSeek(progress.position, this.isPlaybackAdvancing);
        });

        RNTrackPlayer.addEventListener(Event.PlaybackProgressUpdated, evt => {
            const parser = this.lyricParser;
            const positionMs = evt.position * 1000;
            const positionDelta = Math.abs(positionMs - this.lastProgressPositionMs);
            const isSeek = positionDelta > 800;

            // Throttled position update for smooth animation without JS thread overload
            const now = Date.now();
            this.pendingPositionMs = positionMs;

            if (now - this.lastPositionUpdateTime >= POSITION_UPDATE_THROTTLE) {
                // Enough time has passed, update immediately
                this.lastPositionUpdateTime = now;
                getDefaultStore().set(currentPositionMsAtom, positionMs);
                this.syncPositionClock(positionMs, isSeek);

                // Clear any pending timer
                if (this.positionUpdateTimer) {
                    clearTimeout(this.positionUpdateTimer);
                    this.positionUpdateTimer = null;
                }
            } else if (!this.positionUpdateTimer) {
                // Schedule an update to ensure we don't miss the final position
                const delay = POSITION_UPDATE_THROTTLE - (now - this.lastPositionUpdateTime);
                this.positionUpdateTimer = setTimeout(() => {
                    this.lastPositionUpdateTime = Date.now();
                    getDefaultStore().set(currentPositionMsAtom, this.pendingPositionMs);
                    this.syncPositionClock(this.pendingPositionMs, isSeek);
                    this.positionUpdateTimer = null;
                }, delay);
            }

            // Detect seek (position jump > 800ms)
            this.lastProgressPositionMs = positionMs;

            if (!parser || !this.trackPlayer.isCurrentMusic(parser.musicItem)) {
                return;
            }

            const currentLyricItem = getDefaultStore().get(currentLyricItemAtom);
            const newLyricItem = parser.getPosition(evt.position);

            // Use index-based comparison to handle duplicate lyric lines
            const newIndex = newLyricItem?.index ?? -1;
            if (currentLyricItem?.index !== newIndex) {
                // 更新当前歌词状态
                getDefaultStore().set(currentLyricItemAtom, newLyricItem ?? null);
            }
        });

        // Keep the continuous UI-thread clock in sync with playback state changes
        RNTrackPlayer.addEventListener(Event.PlaybackState, async (state) => {
            const isPlaying = state.state === State.Playing;
            this.isPlaybackAdvancing = isPlaying;

            if (isPlaying) {
                const progress = await this.trackPlayer.getProgress();
                this.syncPositionClock(progress.position * 1000);
            } else {
                const progress = await this.trackPlayer.getProgress();
                const positionMs = progress.position * 1000;
                this.stopPositionClock(positionMs);
                getDefaultStore().set(currentPositionMsAtom, positionMs);
            }
        });

        // setup() may run after playback has already started, in which case no
        // new PlaybackState event is guaranteed. Seed the continuous clock from
        // the current native state instead of leaving it in 100ms snap mode.
        RNTrackPlayer.getPlaybackState()
            .then(async state => {
                this.isPlaybackAdvancing = state.state === State.Playing;
                const progress = await this.trackPlayer.getProgress();
                const positionMs = progress.position * 1000;
                if (this.isPlaybackAdvancing) {
                    this.syncPositionClock(positionMs);
                } else {
                    this.stopPositionClock(positionMs);
                }
            })
            .catch(() => {});


        // Initial async lyric load - non-blocking
        this.refreshLyric(true).catch(err => {
            devLog('warn', 'Initial lyric load failed', err);
        });
    }

    associateLyric(musicItem: IMusic.IMusicItem, linkToMusicItem: ICommon.IMediaBase) {
        if (!musicItem || !linkToMusicItem) {
            return false;
        }

        // 如果当前音乐项和关联的音乐项相同，则不需要重新关联
        if (isSameMediaItem(musicItem, linkToMusicItem)) {
            patchMediaExtra(musicItem, {
                associatedLrc: undefined,
            });
            return false;
        } else {
            patchMediaExtra(musicItem, {
                associatedLrc: linkToMusicItem,
            });
            if (this.trackPlayer.isCurrentMusic(musicItem)) {
                // Async refresh, non-blocking
                this.refreshLyric(false).catch(err => {
                    devLog('warn', 'Lyric refresh after association failed', err);
                });
            }
            return true;
        }
    }

    unassociateLyric(musicItem: IMusic.IMusicItem) {
        if (!musicItem) {
            return;
        }

        patchMediaExtra(musicItem, {
            associatedLrc: undefined,
        });

        if (this.trackPlayer.isCurrentMusic(musicItem)) {
            // Async refresh, non-blocking
            this.refreshLyric(false).catch(err => {
                devLog('warn', 'Lyric refresh after unassociation failed', err);
            });
        }
    }

    async uploadLocalLyric(musicItem: IMusic.IMusicItem, lyricContent: string, type: "raw" | "translation" | "romanization" = "raw") {
        if (!musicItem) {
            return;
        }

        const platformHash = CryptoJs.MD5(musicItem.platform).toString(
            CryptoJs.enc.Hex,
        );
        const idHash: string = CryptoJs.MD5(musicItem.id).toString(
            CryptoJs.enc.Hex,
        );

        // 检查是否缓存文件夹存在
        await checkAndCreateDir(pathConst.localLrcPath + platformHash);
        await writeFile(pathConst.localLrcPath +
            platformHash +
            "/" +
            idHash +
            (type === "raw" ? "" : type === "translation" ? ".tran" : ".roma") +
            ".lrc", lyricContent, "utf8");

        if (this.trackPlayer.isCurrentMusic(musicItem)) {
            // Async refresh, non-blocking
            this.refreshLyric(false, false).catch(err => {
                devLog('warn', 'Lyric refresh after upload failed', err);
            });
        }
    }

    async removeLocalLyric(musicItem: IMusic.IMusicItem) {
        if (!musicItem) {
            return;
        }

        const platformHash = CryptoJs.MD5(musicItem.platform).toString(
            CryptoJs.enc.Hex,
        );
        const idHash: string = CryptoJs.MD5(musicItem.id).toString(
            CryptoJs.enc.Hex,
        );

        const basePath =
            pathConst.localLrcPath + platformHash + "/" + idHash;

        await unlink(basePath + ".lrc").catch(() => { });
        await unlink(basePath + ".tran.lrc").catch(() => { });
        await unlink(basePath + ".roma.lrc").catch(() => { });

        if (this.trackPlayer.isCurrentMusic(musicItem)) {
            // Async refresh, non-blocking
            this.refreshLyric(false, false).catch(err => {
                devLog('warn', 'Lyric refresh after removal failed', err);
            });
        }

    }

    // Force reload current lyric (used when config changes like enableWordByWord)
    reloadCurrentLyric() {
        this.refreshLyric(false, false).catch(err => {
            devLog('warn', 'Lyric reload failed', err);
        });
    }

    /**
     * 逐字歌词开关的唯一写入路径。
     * 这个开关只影响歌词解析（QRC 是否保留逐字时间轴），切换后必须重载当前歌词，
     * 否则要等下一首歌才生效。设置页与歌曲长按面板都走这里。
     */
    setWordByWordEnabled(enabled: boolean) {
        this.appConfig.setConfig("lyric.enableWordByWord", enabled);
        this.reloadCurrentLyric();
    }

    async updateLyricOffset(
        musicItem: IMusic.IMusicItem,
        offset: number,
    ): Promise<IParsedLrcItem | null> {
        if (!musicItem) {
            return null;
        }

        // 更新歌词偏移
        patchMediaExtra(musicItem, {
            lyricOffset: offset,
        });

        if (this.trackPlayer.isCurrentMusic(musicItem)) {
            const parser = this.lyricParser;
            if (parser && this.trackPlayer.isCurrentMusic(parser.musicItem)) {
                parser.setExtraOffset(offset * -1);

                let positionSeconds =
                    getDefaultStore().get(currentPositionMsAtom) / 1000;
                try {
                    positionSeconds = (await this.trackPlayer.getProgress()).position;
                } catch (err) {
                    devLog(
                        "warn",
                        "Using cached playback position for lyric offset update",
                        err,
                    );
                }

                const currentLyric = parser.getPosition(positionSeconds);
                const currentState = this.lyricState;
                getDefaultStore().set(lyricStateAtom, {
                    ...currentState,
                    meta: { ...parser.getMeta() },
                });
                getDefaultStore().set(
                    currentLyricItemAtom,
                    currentLyric ?? null,
                );

                return currentLyric ?? null;
            }

            await this.refreshLyric(true, false);
            return this.currentLyricItem ?? null;
        }

        return null;
    }

    private setLyricAsLoadingState() {
        getDefaultStore().set(lyricStateAtom, {
            loading: true,
            lyrics: [],
            hasTranslation: false,
            hasRomanization: false,
        });
        getDefaultStore().set(currentLyricItemAtom, null);
    }

    private setLyricAsNoLyricState() {
        getDefaultStore().set(lyricStateAtom, {
            loading: false,
            lyrics: [],
            hasTranslation: false,
            hasRomanization: false,
        });
        getDefaultStore().set(currentLyricItemAtom, null);
    }

    private async refreshLyric(skipFetchLyricSourceIfSame: boolean = true, ignoreProgress: boolean = false) {
        const currentMusicItem = this.trackPlayer.currentMusic;

        devLog('info', 'Lyric refresh started', {
            hasMusic: !!currentMusicItem,
            title: currentMusicItem?.title,
            skipFetchLyricSourceIfSame,
            ignoreProgress
        });

        // 如果没有当前音乐项，重置歌词状态
        if (!currentMusicItem) {
            this.setLyricAsNoLyricState();
            return;
        }

        try {
            let lrcSource: ILyric.ILyricSource | null;

            if (skipFetchLyricSourceIfSame && this.lyricParser && this.trackPlayer.isCurrentMusic(this.lyricParser.musicItem)) {
                lrcSource = this.lyricParser.lyricSource ?? null;
                devLog('info', 'Using cached lyric source', { hasSource: !!lrcSource });
            } else {
                // 重置歌词状态
                this.setLyricAsLoadingState();

                devLog('info', 'Fetching lyric from plugin', { platform: currentMusicItem.platform });
                const fetchStartTime = Date.now();

                lrcSource = (await this.pluginManager.getByMedia(currentMusicItem)?.methods?.getLyric(currentMusicItem)) ?? null;

                const fetchDuration = Date.now() - fetchStartTime;
                devLog('info', 'Plugin lyric fetch completed', {
                    duration: fetchDuration,
                    hasSource: !!lrcSource,
                    hasRawLrc: !!lrcSource?.rawLrc
                });
            }

            // 切换到其他歌曲了, 直接返回
            if (!this.trackPlayer.isCurrentMusic(currentMusicItem)) {
                devLog('info', 'Music changed during lyric fetch, aborting');
                return;
            }

            // 如果歌词源不存在，并且开启自动搜索歌词
            if (!lrcSource && this.appConfig.getConfig("lyric.autoSearchLyric")) {
                // 重置歌词状态
                this.setLyricAsLoadingState();

                devLog('info', 'Auto-searching similar lyric');
                lrcSource = await this.searchSimilarLyric(currentMusicItem);
            }

            // 切换到其他歌曲了, 直接返回
            if (!this.trackPlayer.isCurrentMusic(currentMusicItem)) {
                devLog('info', 'Music changed during lyric search, aborting');
                return;
            }

            // 如果源不存在，恢复默认设置
            if (!lrcSource) {
                devLog('info', 'No lyric source found, setting no-lyric state');
                this.setLyricAsNoLyricState();
                this.lyricParser = null;
                return;
            }

            // CRITICAL FIX: Defer CPU-intensive decryption to prevent blocking playback
            // QRC decryption involves Triple-DES + Zlib which can take 100-500ms+ synchronously
            devLog('info', 'Processing lyric data', {
                hasRawLrc: !!lrcSource.rawLrc,
                hasTranslation: !!lrcSource.translation,
                hasRomanization: !!lrcSource.romanization
            });

            // Defer decryption to next event loop cycle to allow playback to start
            await new Promise(resolve => setTimeout(resolve, 0));

            const decryptStartTime = Date.now();

            // Get word-by-word setting from config
            const enableWordByWord = this.appConfig.getConfig("lyric.enableWordByWord") ?? true;
            devLog('info', '[Lyric] Word-by-word config', { enableWordByWord });

            // Native async decryption (non-blocking, ~10ms)
            // Pass enableWordByWord to preserve word-level timing for QRC lyrics
            const rawLrc = lrcSource.rawLrc ? await autoDecryptLyric(lrcSource.rawLrc, enableWordByWord) : lrcSource.rawLrc;
            const translation = lrcSource.translation ? await autoDecryptLyric(lrcSource.translation, enableWordByWord) : lrcSource.translation;
            const romanization = lrcSource.romanization ? await autoDecryptLyric(lrcSource.romanization, enableWordByWord) : lrcSource.romanization;

            const decryptDuration = Date.now() - decryptStartTime;
            devLog('info', 'Lyric decryption completed', {
                duration: decryptDuration,
                rawLrcLength: rawLrc?.length,
                translationLength: translation?.length,
                romanizationLength: romanization?.length
            });

            this.lyricParser = new LyricParser(rawLrc!, {
                extra: {
                    offset: (getMediaExtraProperty(currentMusicItem, "lyricOffset") || 0) * -1,
                },
                musicItem: currentMusicItem,
                lyricSource: lrcSource,
                translation,
                romanization,
            });

            getDefaultStore().set(lyricStateAtom, {
                loading: false,
                lyrics: this.lyricParser.getLyricItems(),
                hasTranslation: !!lrcSource.translation,
                hasRomanization: !!lrcSource.romanization,
                meta: this.lyricParser.getMeta(),
            });

            const progress = await this.trackPlayer.getProgress();
            const currentLyric = ignoreProgress
                ? (this.lyricParser.getLyricItems()?.[0] ?? null)
                : this.lyricParser.getPosition(progress.position);
            getDefaultStore().set(currentLyricItemAtom, currentLyric || null);

            devLog('info', 'Lyric refresh completed successfully', {
                lyricCount: this.lyricParser.getLyricItems().length,
                hasTranslation: !!lrcSource.translation,
                hasRomanization: !!lrcSource.romanization
            });

        } catch (err) {
            devLog('error', 'Lyric refresh failed', err);
            if (this.trackPlayer.isCurrentMusic(currentMusicItem)) {
                this.lyricParser = null;
                this.setLyricAsNoLyricState();
            }
        }
    }

    /**
     * 检索最接近的歌词
     * @param musicItem 
     * @returns 
     */
    private async searchSimilarLyric(musicItem: IMusic.IMusicItem) {
        const keyword = musicItem.alias || musicItem.title;
        const plugins = this.pluginManager.getSearchablePlugins("lyric");

        let distance = Infinity;
        let minDistanceMusicItem;
        let targetPlugin: Plugin | null = null;

        for (let plugin of plugins) {
            // 如果插件不是当前音乐的插件，或者当前音乐不是正在播放的音乐，则跳过
            if (
                !this.trackPlayer.isCurrentMusic(musicItem)
            ) {
                return null;
            }

            if (plugin.name === musicItem.platform) {
                // 如果插件是当前音乐的插件，则跳过
                continue;
            }

            const results = await plugin.methods
                .search(keyword, 1, "lyric")
                .catch(() => null);

            // 取前两个
            const firstTwo = results?.data?.slice(0, 2) || [];

            for (let item of firstTwo) {
                if (
                    item.title === keyword &&
                    item.artist === musicItem.artist
                ) {
                    distance = 0;
                    minDistanceMusicItem = item;
                    targetPlugin = plugin;
                    break;
                } else {
                    const dist =
                        minDistance(keyword, musicItem.title) +
                        minDistance(item.artist, musicItem.artist);
                    if (dist < distance) {
                        distance = dist;
                        minDistanceMusicItem = item;
                        targetPlugin = plugin;
                    }
                }
            }

            if (distance === 0) {
                break;
            }
        }

        if (minDistanceMusicItem && targetPlugin) {
            return await targetPlugin.methods
                .getLyric(minDistanceMusicItem)
                .catch(() => null);
        }

        return null;
    }

}

const lyricManager = new LyricManager();
export default lyricManager;


export const useLyricState = () => useAtomValue(lyricStateAtom);
export const useCurrentLyricItem = () => useAtomValue(currentLyricItemAtom);
// 当前播放位置（毫秒），用于逐字歌词效果
export const useCurrentPositionMs = () => useAtomValue(currentPositionMsAtom);
