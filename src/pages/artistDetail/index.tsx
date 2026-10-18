import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Header from "./components/header";
import Body from "./components/body";
import { useAtom, useSetAtom } from "jotai";
import { initQueryResult, queryResultAtom, scrollToTopAtom } from "./store/atoms";
import { useParams } from "@/core/router";
import useInlineMusicSelection from "@/components/musicList/useInlineMusicSelection";
import MusicSelectionProvider from "@/components/musicList/musicSelectionProvider";
import { SelectionDoneAction } from "@/components/musicList/selectionHeader";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import useOrientation from "@/hooks/useOrientation";
import AppBar from "@/components/base/appBar";
import { useI18N } from "@/core/i18n";

export default function ArtistDetail() {
    return <VerticalSafeAreaView style={globalStyle.fwflex1}>
        <MusicSelectionProvider><ArtistContent /></MusicSelectionProvider>
    </VerticalSafeAreaView>;
}

const emptyMusicList: IMusic.IMusicItem[] = [];

function ArtistContent() {
    const [queryResult, setQueryResult] = useAtom(queryResultAtom);
    const { artistItem, pluginHash } = useParams<"artist-detail">();
    const editor = useInlineMusicSelection(`artist:${pluginHash}:${artistItem.id}`, queryResult.music.data ?? emptyMusicList);
    const setScrollToTopState = useSetAtom(scrollToTopAtom);
    const orientation = useOrientation();
    const { t } = useI18N();

    useEffect(() => {
        return () => {
            setQueryResult(initQueryResult);
            setScrollToTopState(true);
        };
    }, [setQueryResult, setScrollToTopState]);

    return (
        <>
            <AppBar
                withStatusBar
                onBackPress={editor.editing ? editor.finish : undefined}
                actionComponent={editor.editing ? <SelectionDoneAction onPress={editor.finish} /> : undefined}
                menu={editor.editing ? [] : [
                    {
                        title: t("artistDetail.menu.batchEditMusic"),
                        icon: "pencil-square",
                        onPress: editor.start,
                    },
                ]}>
                {t("common.artist")}
            </AppBar>
            <View
                style={
                    orientation === "horizontal"
                        ? style.horizontal
                        : globalStyle.flex1
                }>
                <Header neverFold={orientation === "horizontal"} />
                <Body />
            </View>
        </>
    );
}

const style = StyleSheet.create({
    horizontal: {
        flexDirection: "row",
        flex: 1,
    },
});
