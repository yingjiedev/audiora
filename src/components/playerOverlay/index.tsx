import React from "react";
import { StyleSheet, View } from "react-native";
import MusicDetail from "@/pages/musicDetail";
import { closePlayer, playerOverlayStore } from "@/core/playerOverlay";

/**
 * 全屏播放器宿主（根层 Overlay）。
 *
 * 挂在 Stack.Navigator 之后、Panels/Dialogs 之前：压在页面之上，
 * 但面板、弹窗、Toast、MV 播放器仍盖在播放器上面。打开时挂载、
 * 退场动画结束后卸载；进场时机由 openPlayer() 的调用方先
 * armPlayerTransition() 再开这里，与原先路由版的时序一致。
 */
export default function PlayerOverlay() {
    const { open } = playerOverlayStore.useValue();

    if (!open) {
        return null;
    }

    return (
        <View style={styles.fill} collapsable={false}>
            <MusicDetail onClose={closePlayer} />
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
