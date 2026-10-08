import { GlobalState } from "@/utils/stateMapper";

/**
 * 全屏播放器开关。
 *
 * 播放器是根层 Overlay（见 components/playerOverlay），不是导航路由：
 * 主页在播放器打开期间保持挂载、保持活跃，返回时交叉淡化到底下的
 * 实时主页，不存在「重新挂载 + 解冻重渲染」的白屏窗口。
 */
export const playerOverlayStore = new GlobalState<{ open: boolean }>({
    open: false,
});

export function openPlayer() {
    playerOverlayStore.setValue({ open: true });
}

export function closePlayer() {
    playerOverlayStore.setValue({ open: false });
}

export function isPlayerOpen() {
    return playerOverlayStore.getValue().open;
}
