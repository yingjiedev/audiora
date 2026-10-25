import React, { ReactNode, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentDimensionsContext } from "@/hooks/useContentDimensions";
import { adaptiveLayout } from "@/utils/adaptiveLayout";
import { HomeTab, homeTabStore, PlaybackPaneTab, playbackPaneTabStore } from "@/core/homeNavigation";
import { useCurrentMusic } from "@/core/trackPlayer";
import PrimaryNavigation from "./navigation";
import PlayerBar from "./playerBar";
import PlaybackPane from "./playbackPane";

export default function AppShell(props: {
    children: ReactNode;
    routeName: string;
    playerOpen: boolean;
    onSelectHome: (tab: HomeTab) => void;
    onSearch: () => void;
    onSettings: () => void;
}) {
    const window = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const song = useCurrentMusic();
    const homeTab = homeTabStore.useValue();
    const [paneOpen, setPaneOpen] = useState(false);
    const chromeHidden = ["permissions", "file-selector", "music-list-editor", "set-custom-theme"].includes(props.routeName);
    const layout = adaptiveLayout(window.width - insets.left - insets.right, window.height, paneOpen && !!song && !chromeHidden);
    const wide = layout.wide && !chromeHidden;
    const barHeight = wide && song ? 72 + insets.bottom : 0;
    const contentWidth = wide ? layout.contentWidth : window.width;
    const contentHeight = window.height - barHeight;
    const selectPane = (tab: PlaybackPaneTab) => {
        setPaneOpen(!layout.showPane || playbackPaneTabStore.getValue() !== tab);
        playbackPaneTabStore.setValue(tab);
    };
    return (
        <View style={styles.root}>
            <View style={[styles.row, wide && { paddingLeft: insets.left, paddingRight: insets.right }]}>
                {wide ? <PrimaryNavigation width={layout.navigationWidth} top={insets.top} selected={props.routeName === "home" ? homeTab : null}
                    onSelect={props.onSelectHome} onSearch={props.onSearch} onSettings={props.onSettings} /> : null}
                <View testID="app-content-pane" style={styles.content}>
                    <ContentDimensionsContext.Provider value={{ width: contentWidth, height: contentHeight, wide }}>
                        <SafeAreaProvider style={styles.content}>{props.children}</SafeAreaProvider>
                    </ContentDimensionsContext.Provider>
                </View>
                {wide && layout.showPane ? (
                    <View style={[styles.pane, { width: layout.paneWidth, paddingTop: insets.top }]}>
                        <PlaybackPane onClose={() => setPaneOpen(false)} active={!props.playerOpen} />
                    </View>
                ) : null}
            </View>
            {wide && song ? (
                <View style={{ height: barHeight }}>
                    {!props.playerOpen ? <PlayerBar expanded={window.width >= 1000} bottom={insets.bottom} left={insets.left} right={insets.right} canShowPane={layout.canShowPane} paneOpen={layout.showPane} onSelectPane={selectPane} /> : null}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    row: { flex: 1, flexDirection: "row", minHeight: 0 },
    content: { flex: 1, minWidth: 0, minHeight: 0 },
    pane: { marginLeft: 16, flexShrink: 0, minHeight: 0 },
});
