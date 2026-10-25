import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import NavBar from "./components/navBar";
import PlayerDock from "@/components/musicBar/playerDock";
import { SafeAreaView } from "react-native-safe-area-context";
import StatusBar from "@/components/base/statusBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import Theme from "@/core/theme";
import HomeBody from "./components/homeBody";
import Config from "@/core/appConfig";
import HomeBottomNavigation from "./components/HomeBottomNavigation";
import MyMusicOverview from "./components/MyMusicOverview";
import MusicLibraryOverview from "./components/MusicLibraryOverview";
import { openPlayer } from "@/core/playerOverlay";
import { HomeTab, homeTabStore } from "@/core/homeNavigation";
import useContentDimensions from "@/hooks/useContentDimensions";

function Home() {
    const activeTab = homeTabStore.useValue();
    const setActiveTab = homeTabStore.setValue;
    const { wide } = useContentDimensions();
    const [dockHeight, setDockHeight] = useState(0);
    const visited = useRef(new Set<HomeTab>());
    visited.current.add(activeTab);
    
    useEffect(() => {
        // 检查是否需要在启动后打开播放详情页
        if (Config.getConfig("basic.openPlayDetailOnLaunch")) {
            // 延迟一下，确保页面已经渲染完成
            setTimeout(() => {
                openPlayer();
            }, 100);
        }
    }, []);

    return (
        <SafeAreaView edges={["top"]} style={styles.appWrapper}>
            <HomeStatusBar />
            <HorizontalSafeAreaView style={[globalStyle.flex1, { marginBottom: wide ? 0 : dockHeight }]}>
                {(["home", "library", "mine"] as HomeTab[]).filter(tab => visited.current.has(tab)).map(tab => (
                    <View key={tab} style={[globalStyle.flex1, tab !== activeTab && styles.hidden]}
                        importantForAccessibility={tab === activeTab ? "auto" : "no-hide-descendants"} accessibilityElementsHidden={tab !== activeTab}>
                        {tab === "mine" ? <MyMusicOverview /> : tab === "library" ? <MusicLibraryOverview /> : <><NavBar /><HomeBody /></>}
                    </View>
                ))}
            </HorizontalSafeAreaView>
            {!wide ? <PlayerDock
                collapseKey={activeTab}
                onDockHeightChange={setDockHeight}
                bottomNavigation={(
                    <HomeBottomNavigation
                        integrated
                        activeTab={activeTab}
                        onSelectHome={() => setActiveTab("home")}
                        onSelectLibrary={() => setActiveTab("library")}
                        onSelectMine={() => setActiveTab("mine")}
                    />
                )}
            /> : null}
        </SafeAreaView>
    );
}

function HomeStatusBar() {
    const theme = Theme.useTheme();

    return (
        <StatusBar
            backgroundColor="transparent"
            barStyle={theme.dark ? undefined : "dark-content"}
        />
    );
}

export default function App() {
    return <Home />;
}

const styles = StyleSheet.create({
    appWrapper: {
        flexDirection: "column",
        flex: 1,
    },
    hidden: { display: "none" },
});
