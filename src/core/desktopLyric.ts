import { AppState } from "react-native";

import Config from "@/core/appConfig";
import i18n from "@/core/i18n";
import lyricManager from "@/core/lyricManager";
import LyricUtil from "@/native/lyricUtil";
import Toast from "@/utils/toast";
import { resolveLyricPresets } from "@/utils/lyricPreset";

/**
 * 桌面歌词（悬浮歌词）的唯一权威写入口。
 *
 * 背景见 issue #96：开启状态、锁定状态、逐字歌词这三个键原本散落在设置页、
 * 歌曲长按面板、bootstrap、原生工具层四处，各自手写一份原生参数快照，
 * 新增任一参数必漏改一处。现在约定：
 *
 *  1. 只有本文件会写 `lyric.showStatusBarLyric` / `lyric.isLocked` /
 *     `lyric.enableWordByWord`；
 *  2. 原生参数只在这里构造（`buildDesktopLyricOptions`），别处不许再拼；
 *  3. 悬浮窗权限流程只在这里实现（设置页的「跳系统设置→回前台自动重开」），
 *     面板里的快捷开关也走同一条路径，行为不再分叉。
 *
 * 例外只有两处，都是「绕过 UI 的合法性修正」，已单独注释：
 *  - `entry/bootstrap/bootstrap.ts`：Android 上桌面歌词已下线，启动时清标记；
 *  - `core/lyricManager.ts`：原生回调（关闭窗口 / 拖拽 / 换预设 / 改字号）
 *    回写用户可见状态，属于原生→JS 的状态同步，不是第二个写入口。
 */

type PendingSubscription = { remove: () => void } | null;

// 同一个权限请求只挂一个回跳监听，避免反复点开关把监听栈堆起来
let pendingPermissionSubscription: PendingSubscription = null;

/**
 * 原生桌面歌词参数快照。
 *
 * 新增参数只改这一处；调用方不需要感知原生签名。
 */
function buildDesktopLyricOptions() {
    return {
        topPercent: Config.getConfig("lyric.topPercent"),
        leftPercent: Config.getConfig("lyric.leftPercent"),
        align: Config.getConfig("lyric.align"),
        color: Config.getConfig("lyric.color"),
        sungColor: Config.getConfig("lyric.sungColor"),
        backgroundColor: Config.getConfig("lyric.backgroundColor"),
        widthPercent: Config.getConfig("lyric.widthPercent"),
        fontSize: Config.getConfig("lyric.fontSize"),
        presetIndex: Config.getConfig("lyric.presetIndex") ?? 0,
        presets: resolveLyricPresets(),
        secondaryFontRatio:
            Config.getConfig("lyric.desktopSecondaryFontRatio") ?? 0.85,
        secondaryAlphaRatio:
            Config.getConfig("lyric.desktopSecondaryAlphaRatio") ?? 0.9,
    };
}

type IDesktopLyricOptions = ReturnType<typeof buildDesktopLyricOptions>;

function setDesktopLyricVisible(visible: boolean) {
    Config.setConfig("lyric.showStatusBarLyric", visible);
}

/** 重开桌面歌词以应用最新参数；未开启时不做任何事 */
async function relaunch(override?: Partial<IDesktopLyricOptions>) {
    await LyricUtil.hideStatusBarLyric();
    await LyricUtil.showStatusBarLyric("Audiora", {
        ...buildDesktopLyricOptions(),
        ...(override ?? {}),
    });
    // Resync lyric line data + playback state to restore word-by-word
    lyricManager.resyncDesktopLyric();
}

/**
 * 悬浮窗权限不足时的统一处理：提示 → 跳系统设置 → 回到前台自动重试。
 * 设置页原本只有它有这段逻辑，面板里只弹个提示就结束；现在两边一致。
 */
function requestPermissionThenEnable() {
    LyricUtil.requestSystemAlertPermission()
        .catch(() => false)
        .finally(() => {
            pendingPermissionSubscription?.remove();
            pendingPermissionSubscription = AppState.addEventListener(
                "change",
                async state => {
                    if (state !== "active") {
                        return;
                    }
                    pendingPermissionSubscription?.remove();
                    pendingPermissionSubscription = null;
                    if (await LyricUtil.checkSystemAlertPermission()) {
                        await setDesktopLyricEnabled(true);
                    }
                },
            );
        });
}

/**
 * 桌面歌词开关的唯一写入路径。
 * @returns 操作后桌面歌词是否真的处于开启状态（权限不足时为 false）
 */
async function setDesktopLyricEnabled(enabled: boolean): Promise<boolean> {
    try {
        if (!enabled) {
            LyricUtil.hideStatusBarLyric();
            setDesktopLyricVisible(false);
            return false;
        }

        if (!(await LyricUtil.checkSystemAlertPermission())) {
            Toast.warn(i18n.t("toast.noFloatWindowPermission"));
            requestPermissionThenEnable();
            return false;
        }

        const opened = await LyricUtil.showStatusBarLyric(
            "Audiora",
            buildDesktopLyricOptions(),
        );
        if (opened) {
            setDesktopLyricVisible(true);
            // 立刻同步当前歌词行和播放进度，避免刚打开时空白/滞后
            lyricManager.resyncDesktopLyric();
        }
        return !!opened;
    } catch {
        return false;
    }
}

/** 长按面板里的「桌面歌词」快捷开关（复用同一份实现） */
async function toggleDesktopLyric(): Promise<boolean> {
    return setDesktopLyricEnabled(
        !(Config.getConfig("lyric.showStatusBarLyric") ?? false),
    );
}

/** 锁定 / 解锁桌面歌词的唯一写入路径 */
function setDesktopLyricLocked(locked: boolean) {
    if (locked) {
        LyricUtil.lockDesktopLyric();
    } else {
        LyricUtil.unlockDesktopLyric();
    }
    Config.setConfig("lyric.isLocked", locked);
}

function toggleDesktopLyricLocked(): boolean {
    const next = !(Config.getConfig("lyric.isLocked") ?? false);
    setDesktopLyricLocked(next);
    return next;
}

/**
 * 逐字歌词的唯一写入路径。
 * 这个开关只影响歌词解析（QRC 是否保留逐字时间轴），
 * 切换后必须重载当前歌词，否则要等下一首歌才生效。
 */
function setWordByWordEnabled(enabled: boolean) {
    Config.setConfig("lyric.enableWordByWord", enabled);
    lyricManager.reloadCurrentLyric();
}

const DesktopLyric = {
    buildDesktopLyricOptions,
    setDesktopLyricEnabled,
    toggleDesktopLyric,
    setDesktopLyricLocked,
    toggleDesktopLyricLocked,
    setWordByWordEnabled,
    relaunch,
};

export default DesktopLyric;
