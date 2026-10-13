import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import MusicDetail from "@/pages/musicDetail";
import { closePlayer, playerOverlayStore } from "@/core/playerOverlay";

/**
 * 全屏播放器宿主（根层 Overlay）。
 *
 * 挂在 Stack.Navigator 之后、Panels/Dialogs 之前：压在页面之上，
 * 但面板、弹窗、Toast、MV 播放器仍盖在播放器上面。打开时挂载、
 * 退场动画结束后卸载；openPlayer() 统一准备进场动画并分配会话，
 * 重复打开不会重置动画，过期的退出回调不会关闭新播放器。
 */
export default function PlayerOverlay() {
    const { open, sessionId } = playerOverlayStore.useValue();
    const onClose = useCallback(() => closePlayer(sessionId), [sessionId]);

    if (!open) {
        return null;
    }

    return (
        <View style={styles.fill} pointerEvents="box-none" collapsable={false}>
            <MusicDetail key={sessionId} onClose={onClose} />
        </View>
    );
}

const styles = StyleSheet.create({
    fill: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
});
