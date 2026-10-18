import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Header from "./components/header";
import Body from "./components/body";
import { useAtom, useSetAtom } from "jotai";
import { initQueryResult, queryResultAtom, scrollToTopAtom } from "./store/atoms";
import { useParams } from "@/core/router";
import useOpenMusicListEditor from "@/components/musicList/useOpenMusicListEditor";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import useOrientation from "@/hooks/useOrientation";
import AppBar from "@/components/base/appBar";
import { useI18N } from "@/core/i18n";
import { RequestStateCode } from "@/constants/commonConst";
import useMusicListSource from "@/hooks/useMusicListSource";
import useQueryArtist from "./hooks/useQuery";

export default function ArtistDetail() {
    const [queryResult, setQueryResult] = useAtom(queryResultAtom);
    const { artistItem, pluginHash } = useParams<"artist-detail">();
    const queryArtist = useQueryArtist(pluginHash);
    const { sourceId } = useMusicListSource(
        { musicList: queryResult.music.data ?? [], state: queryResult.music.state ?? RequestStateCode.IDLE },
        () => queryArtist(artistItem),
    );
    const setScrollToTopState = useSetAtom(scrollToTopAtom);
    const openEditor = useOpenMusicListEditor();
    const orientation = useOrientation();
    const { t } = useI18N();

    useEffect(() => {
        return () => {
            setQueryResult(initQueryResult);
            setScrollToTopState(true);
        };
    }, [setQueryResult, setScrollToTopState]);

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <AppBar
                withStatusBar
                menu={[
                    {
                        title: t("artistDetail.menu.batchEditMusic"),
                        icon: "pencil-square",
                        onPress() {
                            openEditor({
                                sourceId,
                                musicList: queryResult?.music?.data ?? [],
                                musicSheet: {
                                    title: t("artistDetail.musicSheet", {
                                        artist: artistItem.name,
                                    }),
                                },
                            });
                        },
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
        </VerticalSafeAreaView>
    );
}

const style = StyleSheet.create({
    horizontal: {
        flexDirection: "row",
        flex: 1,
    },
});
