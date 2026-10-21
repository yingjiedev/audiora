import { getCurrentDialog, showDialog } from "@/components/dialogs/useDialog";
import {
    internalFakeSoundKey,
    sortIndexSymbol,
    timeStampSymbol,
} from "@/constants/commonConst";
import { MusicRepeatMode } from "@/constants/repeatModeConst";
import delay from "@/utils/delay";
import getUrlExt from "@/utils/getUrlExt";
import { appendStartupBreadcrumb, errorLog, trace, devLog } from "@/utils/log";
import { createMediaIndexMap, wrapIndex } from "@/utils/mediaIndexMap";
import {
    dedupeMediaItems,
    isSameMediaItem,
} from "@/utils/mediaUtils";
import Toast from "@/utils/toast";
import { getQualityText } from "@/utils/qualities";
import i18n from "@/core/i18n";
import Network from "@/utils/network";
import PersistStatus from "@/utils/persistStatus";
import {
    getPluginQualityScope,
    getQualityOrder,
    getSmartQuality,
    pickSupportedQuality,
} from "@/utils/qualities";
import { mapLocalQuality, resolveLocalAudioMeta } from "@/utils/localQuality";
import { musicIsPaused } from "@/utils/trackUtils";
import EventEmitter from "eventemitter3";
import { ISheetPlaybackContext, recordSheetPlayback } from "@/core/sheetPlaybackHistory";
import { reconcileQueueOrder } from "./reorderQueue";
import { produce } from "immer";
import { atom, getDefaultStore, useAtomValue, type PrimitiveAtom } from "jotai";
import shuffle from "lodash.shuffle";
import ReactNativeTrackPlayer, {
    Event,
    State,
    Track,
    TrackMetadataBase,
    usePlaybackState,
    useProgress,
} from "react-native-track-player";
import { Platform } from "react-native";
import LocalMusicSheet from "../localMusicSheet";

import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import { publishAndroidAutoCatalog } from "@/utils/androidAutoCatalog";
import type { IAppConfig } from "@/types/core/config";
import type { IMusicHistory } from "@/types/core/musicHistory";
import { ITrackPlayer } from "@/types/core/trackPlayer/index";
import minDistance from "@/utils/minDistance";
import { IPluginManager } from "@/types/core/pluginManager";
import { ImgAsset } from "@/constants/assetsConst";
import { resolveImportedAssetOrPath } from "@/utils/fileUtils";
import { resolveArtwork } from "@/utils/artwork";
import { getLocalPlaybackSource } from "./localPlayback";
import { EncryptedSourceError, QmcKeyError } from "@/service/mflac/songKey";
import { adaptMediaSourceForPlayback, canReuseMediaSourceForPlayback } from "./mediaSourceAdapter";
import { refreshCurrentSource } from "./refreshCurrentSource";
import SeekCoordinator from "./seekCoordinator";
import MusicSheet from "@/core/musicSheet";
import { findLinkedSource, replaceLinkedQueueItem, waitForSource } from "./linkedSource";
import { trackSourceKey } from "@/utils/trackGroup";
import PlayFailPolicy from "./playFailPolicy";



const currentMusicAtom = atom<IMusic.IMusicItem | null>(null) as PrimitiveAtom<IMusic.IMusicItem | null>;
const repeatModeAtom = atom<MusicRepeatMode>(MusicRepeatMode.QUEUE);
const qualityAtom = atom<IMusic.IQualityKey>("320k");
const playListAtom = atom<IMusic.IMusicItem[]>([]);

/**
 * 首选音质拿不到源时，降级遍历其它音质的总时间预算（毫秒）。
 * 逐档请求是串行的，插件/后端异常时会把整张音质表打满，这里兜住最坏耗时。
 */
const QUALITY_FALLBACK_BUDGET_MS = 5000;

interface NativeQueueSession {
    revision: number;
    requestRevision: number;
    musicRevision: number;
    playable: boolean;
    ended: boolean;
    failed: boolean;
}

function isLoopbackHttpUrl(url?: string) {
    if (!url) {
        return false;
    }

    try {
        const parsed = new URL(url);
        return (
            (parsed.protocol === "http:" || parsed.protocol === "https:") &&
            (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1")
        );
    } catch {
        return false;
    }
}


class TrackPlayer extends EventEmitter<{
    [TrackPlayerEvents.PlayEnd]: () => void;
    [TrackPlayerEvents.CurrentMusicChanged]: (musicItem: IMusic.IMusicItem | null) => void;
    [TrackPlayerEvents.ProgressChanged]: (progress: {
        position: number;
        duration: number;
    }) => void;
}> implements ITrackPlayer {
    // 依赖
    private configService!: IAppConfig;
    private musicHistoryService!: IMusicHistory;
    private pluginManagerService!: IPluginManager;

    // 当前播放的音乐下标
    private currentIndex = -1;
    // 音乐播放器服务是否启动
    private serviceInited = false;
    private pendingWidgetProgress: { music: IMusic.IMusicItem; position: number } | null = null;
    // 由定时关闭使用：本曲自然播放到结尾时暂停，不让播放器自动切到下一曲。
    private pauseAfterCurrentTrackEnd = false;
    private videoSuspension: {
        musicItem: IMusic.IMusicItem | null;
        wasPlaying: boolean;
    } | null = null;
    // Changes whenever the selected track changes, including switching away
    // from and back to the same media item during an asynchronous refresh.
    private currentMusicRevision = 0;
    // Source loading may finish after pause, but only for the same selection.
    private playRequestId = 0;
    private pauseRevision = 0;
    private linkedFailures = new Set<string>();
    private linkedRecoveryRequest: number | null = null;
    private seekCoordinator = new SeekCoordinator();
    // 连续取源失败的收敛策略：整列都取不到源时不再无限自动跳曲
    private playFailPolicy = new PlayFailPolicy();
    // 同一首歌也可能有多个异步请求，切歌或暂停后旧请求必须失效。
    private playRequestRevision = 0;
    private failedPlayRequestRevision = -1;
    // 每次替换原生队列独立编号，两个结束事件只能消费同一轮队列一次。
    private nativeQueueRevision = 0;
    private nativeQueue: NativeQueueSession | null = null;
    // 播放队列索引map
    private playListIndexMap = createMediaIndexMap([] as IMusic.IMusicItem[]);


    private static maxMusicQueueLength = 10000;
    private static halfMaxMusicQueueLength = 5000;
    private static toggleRepeatMapping = {
        [MusicRepeatMode.SHUFFLE]: MusicRepeatMode.SINGLE,
        [MusicRepeatMode.SINGLE]: MusicRepeatMode.QUEUE,
        [MusicRepeatMode.QUEUE]: MusicRepeatMode.SHUFFLE,
    };
    private static fakeAudioUrl = "audiora://fake-audio";
    private static proposedAudioUrl = "audiora://proposed-audio";

    constructor() {
        super();
    }

    public get previousMusic() {
        const currentMusic = this.currentMusic;
        if (!currentMusic) {
            return null;
        }

        return this.getPlayListMusicAt(this.currentIndex - 1);
    }

    public get currentMusic() {
        return getDefaultStore().get(currentMusicAtom);
    }

    public get nextMusic() {
        const currentMusic = this.currentMusic;
        if (!currentMusic) {
            return null;
        }

        return this.getPlayListMusicAt(this.currentIndex + 1);
    }

    public get repeatMode() {
        return getDefaultStore().get(repeatModeAtom);
    }

    public get quality() {
        return getDefaultStore().get(qualityAtom);
    }

    public get playList() {
        return getDefaultStore().get(playListAtom);
    }


    injectDependencies(configService: IAppConfig, musicHistoryService: IMusicHistory, pluginManager: IPluginManager): void {
        this.configService = configService;
        this.musicHistoryService = musicHistoryService;
        this.pluginManagerService = pluginManager;
    }


    async setupTrackPlayer(options: { backgroundRestore?: boolean; background?: boolean } = {}) {
        let restoreTask: Promise<void> | undefined;
        const restoreRequestRevision = this.playRequestRevision;
        const rate = PersistStatus.get("music.rate");
        const musicQueue = PersistStatus.get("music.playList");
        const repeatMode = PersistStatus.get("music.repeatMode");
        const progress = PersistStatus.get("music.progress");
        let track = PersistStatus.get("music.musicItem");
        // 偏好音质：优先用户设置的默认播放音质，回退到 master。
        // 不要直接使用 PersistStatus 里的 music.quality —— 它是上一首歌经
        // getSmartQuality 降级后的实际音质，若上一首只支持到 320k(HQ)，会把恢复的
        // 第一首歌也强制用 320k 请求音源，造成真实降级。改为对当前恢复歌曲自身的
        // 可用音质智能选择，行为与 play() 保持一致。
        const preferredQuality =
            (this.configService.getConfig("basic.defaultPlayQuality") ||
                "master") as IMusic.IQualityKey;
        const restorePlugin = track
            ? this.pluginManagerService.getByMedia(track)
            : undefined;
        const restoreSourcePlugin = track
            ? this.pluginManagerService.getMediaSourcePlugin?.(track) ?? restorePlugin
            : undefined;
        const restoreScope = track
            ? this.pluginManagerService.getMediaSourceQualityScope?.(track) ?? getPluginQualityScope(restorePlugin?.instance)
            : undefined;
        const quality: IMusic.IQualityKey =
            restoreSourcePlugin?.instance.scriptSource
                ? pickSupportedQuality(preferredQuality, restoreScope) ?? preferredQuality
                : track && (track.qualities || track.source)
                    ? getSmartQuality(
                        preferredQuality,
                      (track.qualities || track.source) as
                          | IMusic.IQuality
                          | undefined,
                      restoreScope,
                    )
                    : preferredQuality;

        // 状态恢复
        if (rate) {
            ReactNativeTrackPlayer.setRate(+rate / 100);
        }
        if (repeatMode) {
            getDefaultStore().set(repeatModeAtom, repeatMode as MusicRepeatMode);
        }

        if (musicQueue && Array.isArray(musicQueue)) {
            this.addAll(
                musicQueue,
                undefined,
                repeatMode === MusicRepeatMode.SHUFFLE,
            );
        }

        if (track && this.isInPlayList(track)) {
            // Empty-queue progress events may overwrite persistence before the
            // widget's first play request. Keep the original position in memory.
            this.pendingWidgetProgress = options.background && progress && Number.isFinite(progress) && progress > 0
                ? { music: track, position: progress } : null;
            const shouldAutoPlayOnStartup = !options.background && !options.backgroundRestore && !!this.configService.getConfig("basic.autoPlayWhenAppStart");
            void appendStartupBreadcrumb("trackplayer-restore-found", {
                title: track.title,
                hasUrl: !!track.url,
                autoPlay: shouldAutoPlayOnStartup,
                platform: Platform.OS,
            });

            if (Platform.OS === "ios" && isLoopbackHttpUrl(track.url)) {
                void appendStartupBreadcrumb("trackplayer-restore-clear-loopback", {
                    title: track.title,
                    url: track.url,
                });
                devLog("warn", "[TrackPlayer] Clearing stale loopback URL on iOS restore", {
                    url: track.url,
                    title: track.title,
                });
                // Clone: persisted tracks may be non-extensible on Hermes.
                const rest = { ...(track as any) };
                delete rest.url;
                delete rest.headers;
                track = rest as IMusic.IMusicItem;
            }

            if (!shouldAutoPlayOnStartup) {
                track = { ...track, isInit: true } as IMusic.IMusicItem;
            }

            this.setCurrentMusic(track);
            // 同步本次智能选择的音质，保证音质标签与实际请求的音源一致
            this.setQuality(quality);
            void appendStartupBreadcrumb("trackplayer-restore-current-set", {
                title: track.title,
            });

            if (options.background || (Platform.OS === "ios" && !shouldAutoPlayOnStartup && !options.backgroundRestore)) {
                void appendStartupBreadcrumb("trackplayer-restore-skip-preload-ios", {
                    title: track.title,
                });
                devLog("info", "[TrackPlayer] Skipping iOS startup source preload", {
                    title: track.title,
                });
            } else {
                void appendStartupBreadcrumb("trackplayer-restore-fetch-source", {
                    title: track.title,
                });
                restoreTask = this.pluginManagerService.getByMedia(track)
                    ?.methods.getMediaSource(track, quality)
                    .then(async newSource => {
                        if (!newSource?.url) {
                            return;
                        }
                        const adapted = await adaptMediaSourceForPlayback(newSource);
                        track = this.mergeTrackSource(track, adapted) as IMusic.IMusicItem;

                        if (isSameMediaItem(this.currentMusic, track) && this.playRequestRevision === restoreRequestRevision) {
                            void appendStartupBreadcrumb("trackplayer-restore-apply-source", {
                                title: track.title,
                                hasSourceUrl: !!newSource?.url,
                            });
                            await this.setTrackSource(track as Track, false);
                            if (progress && this.playRequestRevision === restoreRequestRevision) {
                                void appendStartupBreadcrumb("trackplayer-restore-seek", {
                                    title: track.title,
                                    progress: Number(progress) || 0,
                                });
                                await this.seekTo(Number(progress) || 0);
                            }
                        }
                    })
                    .catch(error => {
                        void appendStartupBreadcrumb("trackplayer-restore-error", {
                            title: track.title,
                            message: error instanceof Error ? error.message : String(error),
                        });
                        if (error instanceof QmcKeyError) {
                            Toast.warn(i18n.t("media.rawSongKeyRequired"));
                        } else if (error instanceof EncryptedSourceError) {
                            Toast.warn(i18n.t("media.encryptedSourceFailed"));
                        }
                        errorLog("恢复播放音源失败", {
                            title: track.title,
                            platform: track.platform,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    });
            }
        }

        if (!this.serviceInited) {

            /**
             * 此事件可能会被触发多次（比如直接替换queue） 参考代码：https://github.com/doublesymmetry/KotlinAudio
             */
            ReactNativeTrackPlayer.addEventListener(
                Event.PlaybackActiveTrackChanged,
                async evt => {
                    if (
                        evt.index === 1 &&
                        evt.lastIndex === 0 &&
                        evt.track?.url === TrackPlayer.fakeAudioUrl
                    ) {
                        await this.handleCurrentTrackEnd(
                            "fake-track",
                            evt.track.audioraQueueRevision,
                        );
                    }
                },
            );

            // 结束事件没有队列标识，必须确认当前原生队列确实已经结束。
            ReactNativeTrackPlayer.addEventListener(
                Event.PlaybackQueueEnded,
                async () => {
                    const session = this.nativeQueue;
                    if (
                        !this.isCurrentNativeQueue(session) || !session.playable ||
                        session.ended || session.failed
                    ) {
                        return;
                    }
                    const [playback, activeTrack] = await Promise.all([
                        ReactNativeTrackPlayer.getPlaybackState(),
                        ReactNativeTrackPlayer.getActiveTrack(),
                    ]);
                    if (!this.isCurrentNativeQueue(session) || playback.state !== State.Ended || !this.currentMusic) {
                        return;
                    }
                    void appendStartupBreadcrumb(
                        "trackplayer-queue-ended-fallback",
                        {
                            title: this.currentMusic.title,
                            repeatMode: this.repeatMode,
                        },
                    );
                    await this.handleCurrentTrackEnd(
                        "queue-ended",
                        activeTrack?.audioraQueueRevision,
                    );
                },
            );

            ReactNativeTrackPlayer.addEventListener(
                Event.PlaybackState,
                async event => {
                    if (event.state !== State.Playing) {
                        return;
                    }
                    const session = this.nativeQueue;
                    if (
                        !this.isCurrentNativeQueue(session) || !session.playable ||
                        session.ended || session.failed
                    ) {
                        return;
                    }
                    const [activeTrack, playback] = await Promise.all([
                        ReactNativeTrackPlayer.getActiveTrack(),
                        ReactNativeTrackPlayer.getPlaybackState(),
                    ]);
                    if (
                        this.isCurrentNativeQueue(session) && session.playable &&
                        !session.ended && !session.failed &&
                        activeTrack?.audioraQueueRevision === session.revision &&
                        activeTrack.url !== TrackPlayer.fakeAudioUrl &&
                        playback.state === State.Playing
                    ) {
                        this.playFailPolicy.noteSuccess();
                    }
                },
            );

            ReactNativeTrackPlayer.addEventListener(
                Event.PlaybackError,
                async e => {
                    const requestRevision = this.playRequestRevision;
                    const session = this.nativeQueue;
                    void appendStartupBreadcrumb("trackplayer-playback-error", {
                        message: e.message,
                        code: e.code,
                    });
                    errorLog("播放出错", e.message);
                    const currentTrack =
                        await ReactNativeTrackPlayer.getActiveTrack();
                    if (!this.isCurrentNativeQueue(session)) {
                        return;
                    }
                    if (currentTrack?.isInit) {
                        // HACK: 避免初始失败的情况
                        ReactNativeTrackPlayer.updateMetadataForTrack(0, {
                            ...currentTrack,
                            // @ts-ignore
                            isInit: undefined,
                        });
                        return;
                    }

                    if (
                        this.isCurrentNativeQueue(session) && session.playable &&
                        currentTrack?.audioraQueueRevision === session.revision &&
                        currentTrack?.url !== TrackPlayer.fakeAudioUrl && currentTrack?.url !== TrackPlayer.proposedAudioUrl &&
                        (await ReactNativeTrackPlayer.getActiveTrackIndex()) === 0 &&
                        e.message &&
                        e.message !== "android-io-file-not-found"
                    ) {
                        trace("播放出错", {
                            message: e.message,
                            code: e.code,
                        });

                        const playback = await ReactNativeTrackPlayer.getPlaybackState().catch(() => null);
                        if (playback && playback.state !== State.Error) return;
                        if (this.isCurrentNativeQueue(session)) {
                            if (!await this.recoverLinkedPlayback(!playback)) {
                                await this.handlePlayFail(requestRevision, this.currentMusicRevision);
                            }
                        }
                    }
                },
            );

            this.serviceInited = true;
        }
        if (options.backgroundRestore && restoreTask) {
            let restoreTimeout: ReturnType<typeof setTimeout> | undefined;
            try {
                await Promise.race([
                    restoreTask,
                    new Promise<void>(resolve => {
                        restoreTimeout = setTimeout(resolve, 10000);
                    }),
                ]);
            } finally {
                clearTimeout(restoreTimeout);
            }
        }
    }

    /**************** 播放队列 ******************/
    getMusicIndexInPlayList(musicItem?: IMusic.IMusicItem | null) {
        if (!musicItem) {
            return -1;
        }
        return this.playListIndexMap.getIndex(musicItem);
    }

    isInPlayList(musicItem?: IMusic.IMusicItem | null) {
        if (!musicItem) {
            return false;
        }

        return this.playListIndexMap.has(musicItem);
    }

    getPlayListMusicAt(index: number): IMusic.IMusicItem | null {
        const playList = this.playList;
        const len = playList.length;
        if (len === 0) {
            return null;
        }
        return playList[wrapIndex(index, len)];
    }

    isPlayListEmpty() {
        return this.playList.length === 0;
    }

    /****** 播放逻辑 *****/
    addAll(
        musicItems: Array<IMusic.IMusicItem>,
        beforeIndex?: number,
        shouldShuffle?: boolean,
    ): void {
        const now = Date.now();
        let newPlayList: IMusic.IMusicItem[] = [];
        let currentPlayList = this.playList;
        // Never mutate in place: items from immer/produce or frozen state throw
        // Hermes "TypeError: cannot add a new property" when assigning symbols.
        const stampedItems = musicItems.map((item, index) => ({
            ...item,
            [timeStampSymbol]: now,
            [sortIndexSymbol]: index,
        }));

        if (beforeIndex === undefined || beforeIndex < 0) {
            // 1.1. 添加到歌单末尾，并过滤掉已有的歌曲
            newPlayList = currentPlayList.concat(
                stampedItems.filter(item => !this.isInPlayList(item)),
            );
        } else {
            // 1.2. 新的播放列表，插入
            const indexMap = createMediaIndexMap(stampedItems);
            const beforeDraft = currentPlayList
                .slice(0, beforeIndex)
                .filter(item => !indexMap.has(item));
            const afterDraft = currentPlayList
                .slice(beforeIndex)
                .filter(item => !indexMap.has(item));

            newPlayList = [...beforeDraft, ...stampedItems, ...afterDraft];
        }

        // 如果太长了
        if (newPlayList.length > TrackPlayer.maxMusicQueueLength) {
            newPlayList = this.shrinkPlayListToSize(
                newPlayList,
                beforeIndex ?? newPlayList.length - 1,
            );
        }

        // 2. 如果需要随机
        if (shouldShuffle) {
            newPlayList = shuffle(newPlayList);
        }
        // 3. 设置播放列表
        this.setPlayList(newPlayList);
    }

    add(
        musicItem: IMusic.IMusicItem | IMusic.IMusicItem[],
        beforeIndex?: number,
    ): void {
        this.addAll(
            Array.isArray(musicItem) ? musicItem : [musicItem],
            beforeIndex,
        );
    }

    addNext(musicItem: IMusic.IMusicItem | IMusic.IMusicItem[]): void {
        const shouldAutoPlay = this.isPlayListEmpty() || !this.currentMusic;

        this.add(musicItem, this.currentIndex + 1);

        if (shouldAutoPlay) {
            this.play(Array.isArray(musicItem) ? musicItem[0] : musicItem);
        }
    }

    async remove(musicItem: IMusic.IMusicItem): Promise<void> {
        const playList = this.playList;

        let newPlayList: IMusic.IMusicItem[] = [];
        let currentMusic: IMusic.IMusicItem | null = this.currentMusic;
        const targetIndex = this.getMusicIndexInPlayList(musicItem);
        let shouldPlayCurrent: boolean | null = null;
        if (targetIndex === -1) {
            // 1. 这种情况应该是出错了
            return;
        }
        // 2. 移除的是当前项
        if (this.currentIndex === targetIndex) {
            // 2.1 停止播放，移除当前项
            newPlayList = produce(playList, draft => {
                draft.splice(targetIndex, 1);
            });
            // 2.2 设置新的播放列表，并更新当前音乐
            if (newPlayList.length === 0) {
                currentMusic = null;
                shouldPlayCurrent = false;
            } else {
                currentMusic = newPlayList[this.currentIndex % newPlayList.length];
                try {
                    const state = (
                        await ReactNativeTrackPlayer.getPlaybackState()
                    ).state;
                    shouldPlayCurrent = !musicIsPaused(state);
                } catch {
                    shouldPlayCurrent = false;
                }
            }
            this.setCurrentMusic(currentMusic);
        } else {
            // 3. 删除
            newPlayList = produce(playList, draft => {
                draft.splice(targetIndex, 1);
            });
        }

        this.setPlayList(newPlayList);
        if (shouldPlayCurrent === true) {
            await this.play(currentMusic, true);
        } else if (shouldPlayCurrent === false) {
            await ReactNativeTrackPlayer.reset();
        }
    }

    isCurrentMusic(musicItem?: IMusic.IMusicItem | null) {
        return isSameMediaItem(musicItem, this.currentMusic);
    }

    async play(
        musicItem?: IMusic.IMusicItem | null,
        forcePlay?: boolean,
        sheetContext?: ISheetPlaybackContext,
    ): Promise<void> {
        const requestId = ++this.playRequestId;
        const requestRevision = ++this.playRequestRevision;
        const pauseRevision = this.pauseRevision;
        let musicRevision = this.currentMusicRevision;
        this.linkedFailures = new Set();
        const isCurrentRequest = () =>
            requestId === this.playRequestId &&
            musicRevision === this.currentMusicRevision;
        const playStartTime = Date.now();
        void appendStartupBreadcrumb("trackplayer-play-invoked", {
            title: musicItem?.title ?? this.currentMusic?.title ?? "",
            platform: musicItem?.platform ?? this.currentMusic?.platform ?? "",
            forcePlay: !!forcePlay,
        });
        devLog("info", "[TrackPlayer] Play method called", {
            title: musicItem?.title,
            forcePlay,
            timestamp: playStartTime,
        });

        try {
            // 如果不传参，默认是播放当前音乐
            if (!musicItem) {
                musicItem = this.currentMusic;
            }
            if (!musicItem) {
                throw new Error(PlayFailReason.PLAY_LIST_IS_EMPTY);
            }
            // 1. 移动网络禁止播放
            const localMusicItem = LocalMusicSheet.isLocalMusic(musicItem);
            const localSource = localMusicItem
                ? getLocalPlaybackSource(musicItem, localMusicItem)
                : null;
            if (
                Network.isCellular &&
                !this.configService.getConfig("basic.useCelluarNetworkPlay") &&
                !localSource
            ) {
                await ReactNativeTrackPlayer.reset();
                throw new Error(PlayFailReason.FORBID_CELLUAR_NETWORK_PLAY);
            }

            // A headless cold start may need a fresh source before its saved
            // position can be restored. Explicit song selection still starts at 0.
            if (forcePlay) this.pendingWidgetProgress = null;
            const pendingWidgetProgress = this.pendingWidgetProgress;
            const savedProgress = !forcePlay && musicItem.isInit && this.isCurrentMusic(musicItem)
                ? pendingWidgetProgress?.position ?? Number(PersistStatus.get("music.progress")) : 0;
            const resumePosition = Number.isFinite(savedProgress) && savedProgress > 0 ? savedProgress : 0;

            // 2. 如果是当前正在播放的音频
            if (this.isCurrentMusic(musicItem)) {
                // 获取底层播放器中的track
                const currentTrack = await ReactNativeTrackPlayer.getTrack(0);
                if (!isCurrentRequest()) {
                    return;
                }
                // 2.1 如果当前有源
                if (
                    currentTrack?.url &&
                    currentTrack.url !== TrackPlayer.proposedAudioUrl &&
                    currentTrack.url !== TrackPlayer.fakeAudioUrl &&
                    canReuseMediaSourceForPlayback(currentTrack as IPlugin.IMediaSourceResult) &&
                    (localSource || (this.pluginManagerService.canReuseMediaSource?.(
                        musicItem, currentTrack as IMusic.IMediaSource,
                    ) ?? true)) &&
                    isSameMediaItem(
                        musicItem,
                        currentTrack as IMusic.IMusicItem,
                    )
                ) {
                    const currentActiveIndex =
                        await ReactNativeTrackPlayer.getActiveTrackIndex();
                    if (!isCurrentRequest()) {
                        return;
                    }
                    if (currentActiveIndex !== 0) {
                        await ReactNativeTrackPlayer.skip(0);
                    }
                    if (!isCurrentRequest()) {
                        return;
                    }
                    if (forcePlay) {
                        // 2.1.1 强制重新开始
                        await this.seekTo(0);
                    }
                    const currentState = (
                        await ReactNativeTrackPlayer.getPlaybackState()
                    ).state;
                    if (!isCurrentRequest()) {
                        return;
                    }
                    const session = this.nativeQueue;
                    if (session && currentTrack.audioraQueueRevision === session.revision) {
                        session.requestRevision = requestRevision;
                    }
                    if (
                        forcePlay || currentActiveIndex !== 0 ||
                        currentState === State.Stopped || currentState === State.Ended ||
                        session?.ended || session?.failed
                    ) {
                        await this.setTrackSource(currentTrack);
                    } else if (currentState !== State.Playing) {
                        // 2.1.2 恢复播放
                        await ReactNativeTrackPlayer.play();
                    }
                    // 这种情况下，播放队列和当前歌曲都不需要变化
                    return;
                }
                // 2.2 其他情况：重新获取源
            }

            // 3. 如果没有在播放列表中，添加到队尾；同时更新列表状态
            const inPlayList = this.isInPlayList(musicItem);
            if (!inPlayList) {
                this.add(musicItem);
            }

            // 4. 更新列表状态和当前音乐
            devLog("info", "[TrackPlayer] Setting current music and emitting event", {
                title: musicItem.title,
                timestamp: Date.now(),
                elapsed: Date.now() - playStartTime,
            });

            this.setCurrentMusic(musicItem);
            musicRevision = this.currentMusicRevision;
            if (!isCurrentRequest()) {
                return;
            }

            devLog("info", "[TrackPlayer] Current music set, initializing queue", {
                timestamp: Date.now(),
                elapsed: Date.now() - playStartTime,
            });

            void appendStartupBreadcrumb("trackplayer-set-proposed-queue", {
                title: musicItem.title,
            });
            const proposedArtwork =
                resolveArtwork(musicItem) ||
                (musicItem.artwork?.trim?.()?.length
                    ? musicItem.artwork
                    : ImgAsset.albumDefault);
            await this.setNativeQueue({
                ...musicItem,
                url: TrackPlayer.proposedAudioUrl,
                artwork: resolveImportedAssetOrPath(proposedArtwork) as unknown as any,
            }, false);
            if (!isCurrentRequest()) {
                return;
            }

            devLog("info", "[TrackPlayer] Queue initialized, fetching media source", {
                timestamp: Date.now(),
                elapsed: Date.now() - playStartTime,
            });

            // 5. 获取音源
            let track: IMusic.IMusicItem;

            // 5.1 通过插件获取音源
            let plugin = this.pluginManagerService.getByName(musicItem.platform);

            // 5.1.1 插件音质档位范围：官方协议插件只认 MusicFree 的 4 档
            // （low/standard/high/super），扩展协议插件按自己的 supportedQualities。
            // 全部选择与降级都限制在这个范围内，避免拿插件根本不认识的档位去请求。
            const sourcePlugin = this.pluginManagerService.getMediaSourcePlugin?.(musicItem) ?? plugin;
            const pluginQualityScope = this.pluginManagerService.getMediaSourceQualityScope?.(musicItem) ??
                getPluginQualityScope(sourcePlugin?.instance);

            // 5.2 智能音质选择
            const preferredQuality = this.configService.getConfig("basic.defaultPlayQuality") ?? "master";
            let selectedQuality: IMusic.IQualityKey;

            // 本地文件不需要请求在线音质；此处音质状态仅作为播放器内部兼容值，
            // 展示层会基于文件真实元数据重新映射（见 localQuality），无法映射时回退 320k。
            if (localSource) {
                selectedQuality = mapLocalQuality(
                    resolveLocalAudioMeta(musicItem, localMusicItem),
                ) ?? "320k";
            } else if ((musicItem.qualities || musicItem.source) && !sourcePlugin?.instance.scriptSource) {
                selectedQuality = getSmartQuality(
                    preferredQuality,
                    (musicItem.qualities || musicItem.source) as IMusic.IQuality | undefined,
                    pluginQualityScope,
                );
            } else {
                // 歌曲没有任何音质信息，没法智能降级。就在插件档位范围内挑一个最接近
                // 偏好的，别拿插件根本不支持的档位去试。
                selectedQuality =
                    pickSupportedQuality(
                        preferredQuality,
                        pluginQualityScope,
                    ) ?? preferredQuality;
            }

            // 5.3 获取音质排序作为后备（同样收窄到插件档位范围内）
            const qualityOrder = getQualityOrder(
                selectedQuality,
                this.configService.getConfig("basic.playQualityOrder") ?? "asc",
                pluginQualityScope,
            );

            // 5.4 插件返回音源
            let source: (IPlugin.IMediaSourceResult & { type?: string }) | null = localSource;

            // 首先尝试智能选择的音质
            if (source) {
                void appendStartupBreadcrumb("trackplayer-local-source-selected", {
                    title: musicItem.title,
                    url: source.url,
                });
                this.setQuality(selectedQuality);
            } else if (isCurrentRequest()) {
                source = await waitForSource(() => plugin?.methods?.getMediaSource(musicItem!, selectedQuality) ?? Promise.resolve(null), isCurrentRequest, 5000);

                if (source) {
                    // Clone before mutation — cached/plugin sources may be frozen.
                    source = { ...source };
                    void appendStartupBreadcrumb("trackplayer-source-selected", {
                        title: musicItem.title,
                        quality: selectedQuality,
                        url: source.url,
                    });
                    this.setQuality(selectedQuality);
                } else {
                    // 智能选择失败，回退到遍历其它音质。
                    // 只在插件档位范围内找（插件明确不支持的档位不可能拿到源），
                    // 并跳过刚单独试过的 selectedQuality，避免把同一个请求重复打给后端。
                    const candidateQualities = qualityOrder.filter(
                        quality =>
                            quality !== selectedQuality &&
                            (!pluginQualityScope.length ||
                                pluginQualityScope.includes(quality)),
                    );
                    const triedQualities: IMusic.IQualityKey[] = [selectedQuality];
                    let fallbackQuality: IMusic.IQualityKey | null = null;
                    // 逐档发请求很慢：插件或后端异常时能把整张音质表打满、让用户干等十几秒。
                    // 给一个总时间预算，超了就按"取不到源"处理。
                    const fallbackDeadline = Date.now() + QUALITY_FALLBACK_BUDGET_MS;

                    for (const quality of candidateQualities) {
                        if (Date.now() > fallbackDeadline) {
                            devLog("warn", "[TrackPlayer] 音质降级探测超时，停止继续尝试", {
                                title: musicItem.title,
                                tried: triedQualities,
                            });
                            break;
                        }
                        if (isCurrentRequest()) {
                            triedQualities.push(quality);
                            source = await waitForSource(() => plugin?.methods?.getMediaSource(musicItem!, quality) ?? Promise.resolve(null), isCurrentRequest, Math.max(0, fallbackDeadline - Date.now()));
                            // 5.4.1 获取到真实源
                            if (source) {
                                source = { ...source };
                                this.setQuality(quality);
                                fallbackQuality = quality;
                                break;
                            }
                        } else {
                            // 5.4.2 已经切换到其他歌曲了，
                            return;
                        }
                    }

                    if (!fallbackQuality) {
                        // 一档都没取到源：写进面包屑，便于离线区分"插件/后端挂了"与"音质不支持"
                        void appendStartupBreadcrumb("trackplayer-source-not-found", {
                            title: musicItem.title,
                            platform: musicItem.platform,
                            requested: selectedQuality,
                            tried: triedQualities,
                        });
                    }

                    // 显示音质提示：能降级就报降级，全部取不到源就报取源失败
                    this.showQualityNotSupportedToast(selectedQuality, musicItem, fallbackQuality);
                }
            }

            if (!isCurrentRequest()) {
                void appendStartupBreadcrumb("trackplayer-play-aborted-current-changed", {
                    title: musicItem.title,
                });
                return;
            }
            if (!source) {
                // 如果有source
                if (musicItem.source) {
                    for (let quality of qualityOrder) {
                        if (musicItem.source[quality]?.url) {
                            source = musicItem.source[quality]!;
                            this.setQuality(quality);

                            break;
                        }
                    }
                }
                // 5.4 没有返回源
                if (!source && !musicItem.url) {
                    // 插件失效的情况
                    if (this.configService.getConfig("basic.tryChangeSourceWhenPlayFail")) {
                        this.linkedFailures.add(trackSourceKey(musicItem));
                        const linked = await this.resolveLinkedFavorite(musicItem, isCurrentRequest);
                        if (!isCurrentRequest()) return;
                        if (linked) {
                            this.setPlayList(replaceLinkedQueueItem(this.playList, musicItem, linked.item));
                            musicItem = linked.item;
                            this.setCurrentMusic(musicItem);
                            musicRevision = this.currentMusicRevision;
                            plugin = this.pluginManagerService.getByMedia(musicItem);
                            this.setQuality(linked.quality);
                            source = linked.source;
                        }
                        // Existing similarity search is only a fallback, never a saved association.
                        if (!source) {
                        // 重试
                            const similarMusic = await this.getSimilarMusic(
                                musicItem,
                                "music",
                                () => !isCurrentRequest(),
                                this.linkedFailures,
                            );

                            if (similarMusic && isCurrentRequest()) {
                                const similarMusicPlugin = this.pluginManagerService.getByMedia(similarMusic);
                                const similarScope = getPluginQualityScope(similarMusicPlugin?.instance);
                                const similarQuality = pickSupportedQuality(preferredQuality, similarScope) ?? preferredQuality;
                                const similarDeadline = Date.now() + 8000;
                                this.linkedFailures.add(trackSourceKey(similarMusic));
                                for (const quality of getQualityOrder(similarQuality, "asc", similarScope)) {
                                    if (!isCurrentRequest() || Date.now() >= similarDeadline) break;
                                    source = await waitForSource(() => similarMusicPlugin?.methods?.getMediaSource(similarMusic, quality) ?? Promise.resolve(null), isCurrentRequest, Math.min(2500, similarDeadline - Date.now()));
                                    if (source?.url && isCurrentRequest()) {
                                        this.setPlayList(replaceLinkedQueueItem(this.playList, musicItem, similarMusic as IMusic.IMusicItem));
                                        musicItem = similarMusic as IMusic.IMusicItem;
                                        this.setCurrentMusic(musicItem);
                                        musicRevision = this.currentMusicRevision;
                                        plugin = similarMusicPlugin;
                                        this.setQuality(quality);
                                        break;
                                    }
                                }
                            }

                        }
                        if (!source) {
                            throw new Error(PlayFailReason.INVALID_SOURCE);
                        }
                    } else {
                        throw new Error(PlayFailReason.INVALID_SOURCE);
                    }
                } else if (!source) {
                    const providedSource = musicItem as IPlugin.IMediaSourceResult;
                    source = {
                        url: musicItem.url,
                        headers: musicItem.headers,
                        ekey: providedSource.ekey,
                        qmcRawKey: providedSource.qmcRawKey,
                        cek: providedSource.cek,
                    };
                    // 使用用户设置的默认音质，而不是硬编码
                    this.setQuality(preferredQuality);
                }
            }

            source = await adaptMediaSourceForPlayback(source);
            if (!isCurrentRequest()) {
                return;
            }

            // 6. 特殊类型源
            if (getUrlExt(source.url) === ".m3u8") {
                source = { ...source, type: "hls" as any };
            }
            // 7. 合并结果
            track = this.mergeTrackSource(musicItem, source) as IMusic.IMusicItem;

            // 8. 新增历史记录
            this.musicHistoryService.addMusic(musicItem);
            if (sheetContext) {
                try {
                    recordSheetPlayback(sheetContext);
                } catch {
                    // History storage must not prevent the requested audio from playing.
                }
            }

            devLog("info", "[TrackPlayer] Media source obtained, starting playback", {
                timestamp: Date.now(),
                elapsed: Date.now() - playStartTime,
                hasUrl: !!track.url,
            });

            trace("获取音源成功", track);

            // 9. 设置音源并立即开始播放 - CRITICAL: 不等待任何其他操作
            const canAutoPlay = () => isCurrentRequest() && pauseRevision === this.pauseRevision;
            await this.setTrackSource(track as Track, resumePosition === 0, canAutoPlay);
            if (!isCurrentRequest()) {
                return;
            }
            if (resumePosition > 0) {
                await this.seekTo(resumePosition);
                if (!isCurrentRequest()) {
                    return;
                }
                if (this.pendingWidgetProgress === pendingWidgetProgress) {
                    this.pendingWidgetProgress = null;
                }
                if (canAutoPlay()) {
                    await ReactNativeTrackPlayer.play();
                }
            }

            devLog("info", "[TrackPlayer] Playback started successfully", {
                timestamp: Date.now(),
                elapsed: Date.now() - playStartTime,
            });

            // 10. 异步获取补充信息 - 完全后台执行，绝对不阻塞播放
            // CRITICAL FIX: Use setTimeout(0) to push to end of event queue after playback starts
            setTimeout(() => {
                (async () => {
                    try {
                        const info = (await plugin?.methods?.getMusicInfo?.(musicItem)) ?? null;
                        if (info) {
                            let safeInfo = info;
                            if (
                                (typeof info.url === "string" && info.url.trim() === "") ||
                                (info.url && typeof info.url !== "string")
                            ) {
                                // Clone without url when empty/invalid (frozen-safe).
                                const rest = { ...(info as any) };
                                delete rest.url;
                                safeInfo = rest;
                            }

                            // 11. 设置补充信息
                            if (isCurrentRequest()) {
                                const mergedTrack = this.mergeTrackSource(track, safeInfo);
                                getDefaultStore().set(currentMusicAtom, mergedTrack as IMusic.IMusicItem);
                                await ReactNativeTrackPlayer.updateMetadataForTrack(
                                    0,
                                    mergedTrack as TrackMetadataBase,
                                );
                                publishAndroidAutoCatalog(this.playList, mergedTrack as IMusic.IMusicItem);
                            }
                        }
                    } catch (err) {
                        devLog("warn", "[TrackPlayer] Failed to fetch additional music info", err);
                    }
                })();
            }, 0);
        } catch (e: any) {
            // 旧请求的错误不能推进新请求，也不能影响切回同一首歌的新一轮播放。
            if (!isCurrentRequest()) {
                return;
            }
            void appendStartupBreadcrumb("trackplayer-play-catch", {
                title: musicItem?.title ?? this.currentMusic?.title ?? "",
                message: e?.message,
                name: e?.name,
            });
            const message = e?.message;
            if (
                message ===
                "The player is not initialized. Call setupPlayer first."
            ) {
                await ReactNativeTrackPlayer.setupPlayer();
                if (isCurrentRequest()) {
                    await this.play(musicItem, forcePlay, sheetContext);
                }
            } else if (message === PlayFailReason.FORBID_CELLUAR_NETWORK_PLAY) {
                if (getCurrentDialog()?.name !== "SimpleDialog") {
                    showDialog("SimpleDialog", {
                        title: "流量提醒",
                        content:
                            "Current connection is not Wi-Fi. Enable cellular playback in settings to continue.",
                    });
                }
            } else if (e instanceof EncryptedSourceError) {
                Toast.warn(i18n.t("media.encryptedSourceFailed"));
            } else if (e instanceof QmcKeyError) {
                Toast.warn(i18n.t("media.rawSongKeyRequired"));
            } else if (message === PlayFailReason.INVALID_SOURCE) {
                trace("playback failed because source is empty");
                await this.handlePlayFail(requestRevision, musicRevision);
            } else if (message === PlayFailReason.PLAY_LIST_IS_EMPTY) {
                // 队列是空的，不应该出现这种情况
            } else {
                // 插件抛错、网络异常、超时…以前到这里就被静默吞掉：
                // native 队列停在 audiora://proposed-audio 这个不可播放的占位 url 上，
                // 既不报错也不恢复，表现同样是「卡住、点下一首没反应」。
                // 统一按一次播放失败处理（自动跳曲 / 到上限就停）。
                errorLog("播放失败（未分类异常）", {
                    title: musicItem?.title,
                    platform: musicItem?.platform,
                    message,
                });
                await this.handlePlayFail(requestRevision, musicRevision);
            }
        }
    }

    async pause(): Promise<void> {
        this.pauseRevision += 1;
        this.playRequestRevision += 1;
        await ReactNativeTrackPlayer.pause();
    }

    pauseAfterCurrentTrack(): void {
        this.pauseAfterCurrentTrackEnd = true;
    }

    cancelPauseAfterCurrentTrack(): void {
        this.pauseAfterCurrentTrackEnd = false;
    }

    async suspendForVideo(): Promise<void> {
        if (this.videoSuspension) {
            return;
        }

        let wasPlaying = false;
        try {
            wasPlaying = (await ReactNativeTrackPlayer.getPlaybackState()).state === State.Playing;
        } catch {
            // The audio service may not be initialized while opening an MV.
        }

        this.videoSuspension = {
            musicItem: this.currentMusic,
            wasPlaying,
        };
        if (wasPlaying) {
            await ReactNativeTrackPlayer.pause();
        }
    }

    async restoreAfterVideo(): Promise<void> {
        const suspension = this.videoSuspension;
        this.videoSuspension = null;
        if (!suspension?.wasPlaying || !suspension.musicItem) {
            return;
        }

        // Do not unexpectedly start a different song selected while the MV was open.
        if (!this.isCurrentMusic(suspension.musicItem)) {
            return;
        }
        try {
            await ReactNativeTrackPlayer.play();
        } catch {
            // The player may have been torn down while the video modal closed.
        }
    }

    toggleRepeatMode(): void {
        this.setRepeatMode(TrackPlayer.toggleRepeatMapping[this.repeatMode]);
    }

    // 清空播放队列
    async clearPlayList(): Promise<void> {
        this.playRequestRevision += 1;
        this.nativeQueue = null;
        this.setPlayList([]);
        this.setCurrentMusic(null);

        await ReactNativeTrackPlayer.reset();
        PersistStatus.set("music.musicItem", undefined);
        PersistStatus.set("music.progress", 0);
    }

    async skipToNext(): Promise<void> {
        if (this.isPlayListEmpty()) {
            this.setCurrentMusic(null);
            return;
        }

        await this.play(this.getPlayListMusicAt(this.currentIndex + 1), true);
    }

    async skipToPrevious(): Promise<void> {
        if (this.isPlayListEmpty()) {
            this.setCurrentMusic(null);
            return;
        }

        await this.play(
            this.getPlayListMusicAt(this.currentIndex === -1 ? 0 : this.currentIndex - 1),
            true,
        );
    }

    async refreshCurrentMusicSource(
        musicItem: IMusic.IMusicItem,
    ): Promise<boolean> {
        const revision = this.currentMusicRevision;
        const quality = this.quality;
        const isTargetCurrent = () =>
            revision === this.currentMusicRevision &&
            this.isCurrentMusic(musicItem);

        return refreshCurrentSource({
            isTargetCurrent,
            getProgress: async () =>
                (await ReactNativeTrackPlayer.getProgress()).position ?? 0,
            getShouldPlay: async () =>
                !musicIsPaused(
                    (await ReactNativeTrackPlayer.getPlaybackState()).state,
                ),
            getFreshSource: async () =>
                this.pluginManagerService
                    .getByMedia(musicItem)
                    ?.methods?.getMediaSource(
                        musicItem,
                        quality,
                        1,
                        false,
                        true,
                    ),
            adaptSource: adaptMediaSourceForPlayback,
            applySource: async (source, shouldPlay) => {
                await this.setTrackSource(
                    this.mergeTrackSource(
                        musicItem,
                        source,
                    ) as unknown as Track,
                    shouldPlay,
                );
            },
            restoreProgress: position => this.seekTo(position),
        });
    }

    async changeQuality(newQuality: IMusic.IQualityKey): Promise<boolean> {
        // 获取当前的音乐和进度
        if (newQuality === this.quality) {
            return true;
        }

        // 获取当前歌曲
        const musicItem = this.currentMusic;
        if (!musicItem) {
            return false;
        }
        try {
            const progress = await ReactNativeTrackPlayer.getProgress();
            const plugin = this.pluginManagerService.getByMedia(musicItem);
            const newSource = await plugin?.methods?.getMediaSource(
                musicItem,
                newQuality,
            );
            if (!newSource?.url) {
                throw new Error(PlayFailReason.INVALID_SOURCE);
            }
            if (this.isCurrentMusic(musicItem)) {
                const playingState = (
                    await ReactNativeTrackPlayer.getPlaybackState()
                ).state;
                const adaptedSource = await adaptMediaSourceForPlayback(newSource);
                await this.setTrackSource(
                    this.mergeTrackSource(musicItem, adaptedSource) as unknown as Track,
                    !musicIsPaused(playingState),
                );

                await this.seekTo(progress.position ?? 0);
                this.setQuality(newQuality);
            }
            return true;
        } catch (error) {
            if (error instanceof QmcKeyError) {
                Toast.warn(i18n.t("media.rawSongKeyRequired"));
            } else if (error instanceof EncryptedSourceError) {
                Toast.warn(i18n.t("media.encryptedSourceFailed"));
            }
            // 修改失败
            return false;
        }
    }

    async playWithReplacePlayList(
        musicItem: IMusic.IMusicItem,
        newPlayList: IMusic.IMusicItem[],
        sheetContext?: ISheetPlaybackContext,
    ): Promise<void> {
        // 入队前先去重：重复项会让 createMediaIndexMap 只保留最后一个下标，
        // currentIndex 与真实位置错位后可能出现「下一首 == 当前首」的死循环。
        newPlayList = dedupeMediaItems(newPlayList);
        if (newPlayList.length !== 0) {
            const now = Date.now();
            // 用户重新起播一整张列表：连续失败计数也随之归零
            this.playFailPolicy.noteSuccess();
            if (newPlayList.length > TrackPlayer.maxMusicQueueLength) {
                newPlayList = this.shrinkPlayListToSize(
                    newPlayList,
                    newPlayList.findIndex(it => isSameMediaItem(it, musicItem)),
                );
            }

            newPlayList = newPlayList.map((it, index) => ({
                ...it,
                [timeStampSymbol]: now,
                [sortIndexSymbol]: index,
            }));

            this.setPlayList(
                this.repeatMode === MusicRepeatMode.SHUFFLE
                    ? shuffle(newPlayList)
                    : newPlayList,
            );
            await this.play(musicItem, true, sheetContext);
        }
    }

    reorderPlayList(order: IMusic.IMusicItem[]): void {
        const reconciled = reconcileQueueOrder(this.playList, order);
        if (!reconciled) {
            return;
        }
        const now = Date.now();
        this.setPlayList(reconciled.map((item, index) => ({
            ...item,
            [timeStampSymbol]: now,
            [sortIndexSymbol]: index,
        })));
        // Update the next-track placeholder without resetting the current audio.
        ReactNativeTrackPlayer.updateMetadataForTrack(1, this.getFakeNextTrack()).catch(() => undefined);
    }

    async seekTo(progress: number) {
        PersistStatus.set("music.progress", progress);
        return this.seekCoordinator.seek(
            progress,
            position => ReactNativeTrackPlayer.seekTo(position),
            position => {
                this.emit(TrackPlayerEvents.ProgressChanged, {
                    position,
                    duration: Number(this.currentMusic?.duration) || 0,
                });
            },
        );
    }

    getProgress = ReactNativeTrackPlayer.getProgress;
    getRate = ReactNativeTrackPlayer.getRate;
    setRate = ReactNativeTrackPlayer.setRate;
    reset = ReactNativeTrackPlayer.reset;


    /**************** 辅助函数 -- 设置内部状态 ****************/

    private setCurrentMusic(musicItem?: IMusic.IMusicItem | null) {
        if (this.pendingWidgetProgress && !isSameMediaItem(this.pendingWidgetProgress.music, musicItem)) {
            this.pendingWidgetProgress = null;
        }
        this.currentMusicRevision += 1;
        // 设置UI内部状态的musicitem
        if (!musicItem) {
            this.currentIndex = -1;
            getDefaultStore().set(currentMusicAtom, null);
            PersistStatus.set("music.musicItem", undefined);
            PersistStatus.set("music.progress", 0);

            publishAndroidAutoCatalog(this.playList, null);

            this.emit(TrackPlayerEvents.CurrentMusicChanged, null);
            return;
        }
        if (typeof musicItem.artwork !== "string") {
            musicItem.artwork = ImgAsset.albumDefault;
        }
        this.currentIndex = this.getMusicIndexInPlayList(musicItem);
        getDefaultStore().set(currentMusicAtom, musicItem);

        publishAndroidAutoCatalog(this.playList, musicItem);

        this.emit(TrackPlayerEvents.CurrentMusicChanged, musicItem);
    }

    private setRepeatMode(mode: MusicRepeatMode) {
        const playList = this.playList;
        let newPlayList: IMusic.IMusicItem[];
        const prevMode = getDefaultStore().get(repeatModeAtom);
        if (
            (prevMode === MusicRepeatMode.SHUFFLE &&
                mode !== MusicRepeatMode.SHUFFLE) ||
            (mode === MusicRepeatMode.SHUFFLE &&
                prevMode !== MusicRepeatMode.SHUFFLE)
        ) {
            if (mode === MusicRepeatMode.SHUFFLE) {
                newPlayList = shuffle(playList);
            } else {
                newPlayList = this.sortByTimestampAndIndex(playList, true);
            }
            this.setPlayList(newPlayList);
        }

        getDefaultStore().set(repeatModeAtom, mode);
        // 更新下一首歌的信息
        ReactNativeTrackPlayer.updateMetadataForTrack(
            1,
            this.getFakeNextTrack(),
        );
        // 记录
        PersistStatus.set("music.repeatMode", mode);
    }

    private setQuality(quality: IMusic.IQualityKey) {
        getDefaultStore().set(qualityAtom, quality);
        PersistStatus.set("music.quality", quality);
    }

    private isCurrentNativeQueue(session: NativeQueueSession | null): session is NativeQueueSession {
        return !!session && session === this.nativeQueue &&
            session.musicRevision === this.currentMusicRevision &&
            session.requestRevision === this.playRequestRevision;
    }

    private async setNativeQueue(track: Track, playable: boolean) {
        const session: NativeQueueSession = {
            revision: ++this.nativeQueueRevision,
            requestRevision: this.playRequestRevision,
            musicRevision: this.currentMusicRevision,
            playable,
            ended: false,
            failed: false,
        };
        this.nativeQueue = session;
        await ReactNativeTrackPlayer.setQueue([
            { ...track, audioraQueueRevision: session.revision },
            this.getFakeNextTrack(),
        ]);
        return session;
    }

    // 设置音源
    private async setTrackSource(track: Track, autoPlay = true, canAutoPlay = () => true) {
        const clonedTrack = this.patchMediaArtwork(track);
        if (!clonedTrack) {
            void appendStartupBreadcrumb("trackplayer-set-source-skipped", {
                reason: "patch-media-artwork-returned-null",
            });
            return;
        }
        void appendStartupBreadcrumb("trackplayer-set-source", {
            title: (track as IMusic.IMusicItem)?.title ?? "",
            url: clonedTrack.url,
            autoPlay,
        });
        const session = await this.setNativeQueue(clonedTrack, true);
        if (!this.isCurrentNativeQueue(session)) {
            return;
        }
        PersistStatus.set("music.musicItem", track as IMusic.IMusicItem);
        PersistStatus.set("music.progress", 0);
        if (autoPlay && canAutoPlay()) {
            void appendStartupBreadcrumb("trackplayer-native-play", {
                title: (track as IMusic.IMusicItem)?.title ?? "",
            });
            await ReactNativeTrackPlayer.play();
        }
    }

    /**
     * 设置播放队列
     * @param newPlayList 播放队列
     * @param persist 是否持久化
     */
    private setPlayList(newPlayList: IMusic.IMusicItem[], persist = true) {
        getDefaultStore().set(playListAtom, newPlayList);

        this.playListIndexMap = createMediaIndexMap(newPlayList);

        if (persist) {
            PersistStatus.set("music.playList", newPlayList);
        }

        this.currentIndex = this.getMusicIndexInPlayList(this.currentMusic);
        publishAndroidAutoCatalog(newPlayList, this.currentMusic);
    }


    /**************** 辅助函数 -- 工具方法 ****************/
    private shrinkPlayListToSize = (
        queue: IMusic.IMusicItem[],
        targetIndex = this.currentIndex,
    ) => {
        // 播放列表上限，太多无法缓存状态
        if (queue.length > TrackPlayer.maxMusicQueueLength) {
            if (targetIndex < TrackPlayer.halfMaxMusicQueueLength) {
                queue = queue.slice(0, TrackPlayer.maxMusicQueueLength);
            } else {
                const right = Math.min(
                    queue.length,
                    targetIndex + TrackPlayer.halfMaxMusicQueueLength,
                );
                const left = Math.max(0, right - TrackPlayer.maxMusicQueueLength);
                queue = queue.slice(left, right);
            }
        }
        return queue;
    };

    private mergeTrackSource(
        mediaItem: ICommon.IMediaBase,
        props: Record<string, any> | undefined,
    ) {
        return props
            ? {
                ...mediaItem,
                ...props,
                ...(props.url ? {
                    ekey: props.ekey,
                    qmcRawKey: props.qmcRawKey,
                    cek: props.cek,
                } : {}),
                id: mediaItem.id,
                platform: mediaItem.platform,
            }
            : mediaItem;
    }

    private sortByTimestampAndIndex(array: any[], newArray = false) {
        if (newArray) {
            array = [...array];
        }
        return array.sort((a, b) => {
            const ts = a[timeStampSymbol] - b[timeStampSymbol];
            if (ts !== 0) {
                return ts;
            }
            return a[sortIndexSymbol] - b[sortIndexSymbol];
        });
    }

    private getFakeNextTrack() {
        let track: Track | undefined;
        const repeatMode = this.repeatMode;
        if (repeatMode === MusicRepeatMode.SINGLE) {
            // 单曲循环
            track = this.getPlayListMusicAt(this.currentIndex) as Track;
        } else {
            // 下一曲
            track = this.getPlayListMusicAt(this.currentIndex + 1) as Track;
        }

        if (track) {
            return produce(track, _ => {
                _.url = TrackPlayer.fakeAudioUrl;
                _.audioraQueueRevision = this.nativeQueue?.revision;
                _.$ = internalFakeSoundKey;
                _.artwork = resolveImportedAssetOrPath(ImgAsset.albumDefault) as unknown as any;
            });
        } else {
            // 只有列表长度为0时才会出现的特殊情况
            return {
                url: TrackPlayer.fakeAudioUrl,
                audioraQueueRevision: this.nativeQueue?.revision,
                $: internalFakeSoundKey,
            } as Track;
        }
    }

    private showQualityNotSupportedToast(
        requestedQuality: IMusic.IQualityKey,
        musicItem: IMusic.IMusicItem,
        fallbackQuality?: IMusic.IQualityKey | null,
    ) {
        // 获取用户自定义的音质翻译设置
        const customQualityTranslations = this.configService.getConfig("basic.qualityTranslations");
        const languageData = i18n.getLanguage().languageData;
        const qualityTextI18n = getQualityText(languageData, customQualityTranslations);

        const platformPrefix = musicItem.platform ? `[${musicItem.platform}] ` : "";

        if (fallbackQuality) {
            // 确实降级了：这首歌没有首选音质，但还有别的档位可放
            Toast.warn(
                `${platformPrefix}${i18n.t("toast.musicQualityDowngraded", {
                    quality: qualityTextI18n[requestedQuality],
                    alternative: qualityTextI18n[fallbackQuality],
                })}`,
            );
            return;
        }

        // 一档都没取到源：通常是插件/音源服务异常（网络、后端失效、歌曲下架），
        // 与"这首歌不支持某音质"是两回事。把责任推给音质会把排查方向带偏。
        errorLog("获取音源失败（全部音质均无源）", {
            platform: musicItem.platform,
            title: musicItem.title,
            requestedQuality,
        });
        Toast.warn(`${platformPrefix}${i18n.t("toast.mediaSourceUnavailable")}`);
    }


    private async resolveLinkedFavorite(item: IMusic.IMusicItem, isCurrent: () => boolean, budgetMs = 8000) {
        const groupId = MusicSheet.favorites.groupFor(item)?.id;
        if (!groupId) return null;
        const linkedCurrent = () => isCurrent() && MusicSheet.favorites.groupFor(item)?.id === groupId;
        const result = await findLinkedSource(MusicSheet.favorites.linkedSources(item), async candidate => {
            const local = LocalMusicSheet.isLocalMusic(candidate);
            const localSource = local ? getLocalPlaybackSource(candidate, local) : null;
            const preferred = this.configService.getConfig("basic.defaultPlayQuality") ?? "master";
            if (localSource) return { source: localSource, quality: mapLocalQuality(resolveLocalAudioMeta(candidate, local)) ?? "320k" };
            if (Network.isCellular && !this.configService.getConfig("basic.useCelluarNetworkPlay")) return null;
            const plugin = this.pluginManagerService.getByMedia(candidate);
            if (!plugin || !this.pluginManagerService.getEnabledPlugins().some(enabled => enabled.hash === plugin.hash)) return null;
            const scope = getPluginQualityScope(plugin.instance);
            const quality = candidate.qualities || candidate.source
                ? getSmartQuality(preferred, candidate.qualities || candidate.source, scope)
                : pickSupportedQuality(preferred, scope) ?? preferred;
            const source = await plugin.methods.getMediaSource(candidate, quality);
            return source?.url ? { source, quality } : null;
        }, linkedCurrent, this.linkedFailures, budgetMs);
        return result && linkedCurrent() && MusicSheet.favorites.linkedSources(item).some(candidate => trackSourceKey(candidate) === trackSourceKey(result.item)) ? result : null;
    }

    private async recoverLinkedPlayback(assumePaused = false) {
        if (!this.configService.getConfig("basic.tryChangeSourceWhenPlayFail")) return false;
        let item = this.currentMusic;
        if (!item) return false;
        const request = this.playRequestId;
        if (this.linkedRecoveryRequest === request) return true;
        this.linkedRecoveryRequest = request;
        let revision = this.currentMusicRevision;
        const pauseRevision = this.pauseRevision;
        const isCurrent = () => request === this.playRequestId && revision === this.currentMusicRevision;
        const deadline = Date.now() + 8000;
        this.linkedFailures.add(trackSourceKey(item));
        let pausedAtStart = true;
        try {
            const progress = await ReactNativeTrackPlayer.getProgress().catch(() => ({ position: 0 }));
            pausedAtStart = assumePaused || (await ReactNativeTrackPlayer.getPlaybackState().catch(() => ({ state: State.Paused }))).state === State.Paused;
            while (isCurrent() && Date.now() < deadline) {
                const linked = await this.resolveLinkedFavorite(item, isCurrent, deadline - Date.now());
                if (!isCurrent()) return true;
                if (!linked) return pausedAtStart || pauseRevision !== this.pauseRevision;
                try {
                    const source = await waitForSource(() => adaptMediaSourceForPlayback(linked.source), isCurrent, Math.min(2000, deadline - Date.now()));
                    if (!isCurrent()) return true;
                    if (!source) continue;
                    this.setPlayList(replaceLinkedQueueItem(this.playList, item, linked.item));
                    item = linked.item;
                    this.setCurrentMusic(item);
                    revision = this.currentMusicRevision;
                    this.setQuality(linked.quality);
                    await this.setTrackSource(this.mergeTrackSource(item, source) as unknown as Track, false);
                    if (!isCurrent()) return true;
                    const position = Math.max(0, Number(progress.position) || 0);
                    if (position > 0) await this.seekTo(item.duration > 0 ? Math.min(position, Math.max(0, item.duration - 1)) : position);
                    if (!isCurrent()) return true;
                    this.musicHistoryService.addMusic(item);
                    if (!pausedAtStart && pauseRevision === this.pauseRevision) await ReactNativeTrackPlayer.play();
                    return true;
                } catch {
                    if (!isCurrent()) return true;
                    // Each candidate is already in linkedFailures; continue with the next.
                }
            }
            return !isCurrent() || pausedAtStart || pauseRevision !== this.pauseRevision;
        } catch {
            return !isCurrent() || pausedAtStart || pauseRevision !== this.pauseRevision;
        } finally {
            if (this.linkedRecoveryRequest === request) this.linkedRecoveryRequest = null;
        }
    }

    /**
     * 本曲播放结束，推进到下一条该播的曲目。
     *
     * 两条触发路径共用这里：假曲触发的 PlaybackActiveTrackChanged（主）与
     * PlaybackQueueEnded（兜底）。每一轮原生队列只消费一次，不依赖事件顺序或延迟。
     */
    private async handleCurrentTrackEnd(
        reason: "fake-track" | "queue-ended",
        queueRevision: number | undefined,
    ) {
        const session = this.nativeQueue;
        if (
            !this.isCurrentNativeQueue(session) || !session.playable ||
            session.revision !== queueRevision || session.ended || session.failed ||
            this.isPlayListEmpty() || !this.currentMusic
        ) {
            return;
        }
        session.ended = true;
        const shouldPause = this.pauseAfterCurrentTrackEnd;

        // This request is consumed by the current natural track end.
        // A later timer can request it again for the next track.
        this.pauseAfterCurrentTrackEnd = false;
        trace("queue reached end of current track", { reason });
        this.emit(TrackPlayerEvents.PlayEnd);
        if (!this.isCurrentNativeQueue(session)) {
            return;
        }
        if (shouldPause) {
            await ReactNativeTrackPlayer.pause();
            return;
        }
        if (this.repeatMode === MusicRepeatMode.SINGLE) {
            await this.play(null, true);
        } else {
            // 当前生效的歌曲是下一曲的标记
            await this.skipToNext();
        }
    }

    private async handlePlayFail(requestRevision: number, musicRevision: number) {
        const isCurrentRequest = () =>
            requestRevision === this.playRequestRevision &&
            musicRevision === this.currentMusicRevision;
        if (!isCurrentRequest() || this.failedPlayRequestRevision === requestRevision) {
            return;
        }
        this.failedPlayRequestRevision = requestRevision;
        if (this.isCurrentNativeQueue(this.nativeQueue)) {
            this.nativeQueue.failed = true;
        }
        // 用户设置了「播放失败时自动暂停」：不推进，停在原地
        if (this.configService.getConfig("basic.autoStopWhenError")) {
            return;
        }
        // 连续失败到上限就停下来。整张队列都取不到源时继续跳没有意义，
        // 只会让宿主在后台一首首空转，UI 看上去像卡死、手动切歌也被同一条链吞掉。
        if (!this.playFailPolicy.consumeAutoAdvance()) {
            devLog("warn", "[TrackPlayer] 连续取源失败达到上限，停止自动跳下一首", {
                consecutive: this.playFailPolicy.consecutiveFailures,
                title: this.currentMusic?.title,
                platform: this.currentMusic?.platform,
            });
            Toast.warn(i18n.t("toast.consecutivePlayFailStopped"));
            return;
        }
        // 用户在等待的 500ms 内切歌、暂停或清空队列，就取消这次自动跳转。
        await delay(500);
        if (isCurrentRequest()) {
            await this.skipToNext();
        }
    }

    /**
 *
 * @param musicItem 音乐类型
 * @param type 媒体类型
 * @param abortFunction 如果函数为true，则中断
 * @returns
 */
    private async getSimilarMusic<T extends ICommon.SupportMediaType>(
        musicItem: IMusic.IMusicItem,
        type: T = "music" as T,
        abortFunction?: () => boolean,
        attempted = new Set<string>(),
    ): Promise<ICommon.SupportMediaItemBase[T] | null> {
        const keyword = musicItem.alias || musicItem.title;
        const plugins = this.pluginManagerService.getSearchablePlugins(type);

        let distance = Infinity;
        let minDistanceMusicItem;
        let targetPlugin;

        const startTime = Date.now();

        for (let plugin of plugins) {
            // 超时时间：8s
            if (abortFunction?.() || Date.now() - startTime > 8000) {
                break;
            }
            if (plugin.name === musicItem.platform) {
                continue;
            }
            const results = await waitForSource<IPlugin.ISearchResult<T>>(() => plugin.methods.search(keyword, 1, type), () => !abortFunction?.(), Math.min(3000, Math.max(0, 8000 - (Date.now() - startTime))));

            // 取前两个
            const firstTwo = results?.data?.slice(0, 2) || [];

            for (let item of firstTwo) {
                if (attempted.has(trackSourceKey(item))) continue;
                if (item.title === keyword && item.artist === musicItem.artist) {
                    distance = 0;
                    minDistanceMusicItem = item;
                    targetPlugin = plugin;
                    break;
                } else {
                    const dist =
                        minDistance(keyword, item.title) +
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
            return minDistanceMusicItem as ICommon.SupportMediaItemBase[T];
        }

        return null;
    }


    private patchMediaArtwork(track: Track) {
        // Bug: React native track player 在设置音频时，artwork不能为null，并且部分情况下artwork不能为ImageSource类型
        if (!track) {
            return null;
        }
        const associatedOrOriginal =
            resolveArtwork(track as IMusic.IMusicItem) ||
            (typeof track.artwork === "string" && track.artwork.trim?.()?.length
                ? track.artwork
                : undefined);
        return {
            ...track,
            artwork: resolveImportedAssetOrPath(
                associatedOrOriginal?.length
                    ? associatedOrOriginal
                    : ImgAsset.albumDefault,
            ) as unknown as any,
        };
    }

}

export const usePlayList = () => useAtomValue(playListAtom);
export const useCurrentMusic = () => useAtomValue(currentMusicAtom);
export const useRepeatMode = () => useAtomValue(repeatModeAtom);
export const useMusicQuality = () => useAtomValue(qualityAtom);
export function useMusicState() {
    const playbackState = usePlaybackState();

    return playbackState.state;
}
export { State as MusicState, useProgress };

enum PlayFailReason {
    /** 禁止移动网络播放 */
    FORBID_CELLUAR_NETWORK_PLAY = "FORBID_CELLUAR_NETWORK_PLAY",
    /** 播放列表为空 */
    PLAY_LIST_IS_EMPTY = "PLAY_LIST_IS_EMPTY",
    /** 无效源 */
    INVALID_SOURCE = "INVALID_SOURCE",
    /** 非当前音乐 */
}

const trackPlayer = new TrackPlayer();
export default trackPlayer;

