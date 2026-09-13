import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import NavBar from "./components/navBar";
import MusicBar from "@/components/musicBar";
import { SafeAreaView } from "react-native-safe-area-context";
import StatusBar from "@/components/base/statusBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import Theme from "@/core/theme";
import HomeBody from "./components/homeBody";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import Config from "@/core/appConfig";
import HomeBottomNavigation from "./components/HomeBottomNavigation";
import MyMusicOverview from "./components/MyMusicOverview";
import MusicLibraryOverview from "./components/MusicLibraryOverview";

function Home() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<"home" | "library" | "mine">("home");
    
    useEffect(() => {
        // 检查是否需要在启动后打开播放详情页
        if (Config.getConfig("basic.openPlayDetailOnLaunch")) {
            // 延迟一下导航，确保页面已经渲染完成
            setTimeout(() => {
                navigate(ROUTE_PATH.MUSIC_DETAIL);
            }, 100);
        }
    }, [navigate]);

    return (
        <SafeAreaView edges={["top"]} style={styles.appWrapper}>
            <HomeStatusBar />
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                {activeTab === "mine" ? (
                    <MyMusicOverview />
                ) : activeTab === "library" ? (
                    <MusicLibraryOverview />
                ) : (
                    <>
                        <NavBar />
                        <HomeBody />
                    </>
                )}
            </HorizontalSafeAreaView>
            <MusicBar />
            <HomeBottomNavigation
                activeTab={activeTab}
                onSelectHome={() => setActiveTab("home")}
                onSelectLibrary={() => setActiveTab("library")}
                onSelectMine={() => setActiveTab("mine")}
            />
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

// function Body() {
//     const orientation = useOrientation();
//     return (
//         <ScrollView
//             style={[
//                 styles.appWrapper,
//                 orientation === 'horizontal' ? styles.flexRow : null,
//             ]}>
//             <Operations orientation={orientation} />
//         </ScrollView>
//     );
// }

export default function App() {
    return <Home />;
}

const styles = StyleSheet.create({
    appWrapper: {
        flexDirection: "column",
        flex: 1,
    },
    flexRow: {
        flexDirection: "row",
    },
});
