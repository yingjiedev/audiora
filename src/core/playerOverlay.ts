import { useSyncExternalStore } from "react";

/**
 * 全屏播放器开关。
 *
 * 播放器是根层 Overlay（见 components/playerOverlay），不是导航路由：
 * 主页在播放器打开期间保持挂载和渲染，但由 entry 屏蔽输入；返回时交叉淡化到底下的
 * 实时主页，不存在「重新挂载 + 解冻重渲染」的白屏窗口。
 */
interface PlayerOverlayState {
    open: boolean;
    sessionId: number;
}

let state: PlayerOverlayState = {
    open: false,
    sessionId: 0,
};
let preparing = false;
const listeners = new Set<() => void>();
const getSnapshot = () => state;
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

function publish(nextState: PlayerOverlayState) {
    state = nextState;
    listeners.forEach(listener => listener());
}

// Both the overlay and the home input gate must observe the same snapshot,
// including changes between their render and subscription.
export const playerOverlayStore = {
    getValue: getSnapshot,
    useValue: () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot),
};

/** Prepare the animation only when a new player will actually mount. */
export function openPlayer(prepare?: () => void) {
    if (state.open || preparing) {
        return;
    }
    preparing = true;
    try {
        prepare?.();
        publish({ open: true, sessionId: state.sessionId + 1 });
    } finally {
        preparing = false;
    }
}

/** A queued completion from an old player must not close a newer one. */
export function closePlayer(sessionId?: number) {
    if (!state.open || (sessionId !== undefined && sessionId !== state.sessionId)) {
        return;
    }
    publish({ ...state, open: false });
}

export function isPlayerOpen() {
    return playerOverlayStore.getValue().open;
}
