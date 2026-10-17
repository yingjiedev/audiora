import AppBar from "@/components/base/appBar";
import StatusBar from "@/components/base/statusBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import i18n from "@/core/i18n";
import { useParams } from "@/core/router";
import { atom, useAtomValue, useSetAtom } from "jotai";
import React, { useEffect } from "react";
import { View } from "react-native";
import Body from "./components/body";
import Bottom from "./components/bottom";
import { editingMusicListAtom, mergeEditorMusicList, musicListChangedAtom } from "./store/atom";
import useEnterTransitionEnd from "@/hooks/useEnterTransitionEnd";
import { getMusicListSource, MusicListSnapshot } from "@/core/musicListSource";
import { RequestStateCode } from "@/constants/commonConst";

const unavailableSourceAtom = atom<MusicListSnapshot>({ musicList: [], state: RequestStateCode.ERROR });

export default function MusicListEditor() {
    const { musicSheet, musicList, sourceId } = useParams<"music-list-editor">();
    const source = getMusicListSource(sourceId);
    const snapshot = useAtomValue(source?.snapshotAtom ?? unavailableSourceAtom);

    const setEditingMusicList = useSetAtom(editingMusicListAtom);
    const setMusicListChanged = useSetAtom(musicListChangedAtom);

    // 整表 map 写 atom + 全量排序列表的首帧渲染都很重，
    // 等进入转场结束再挂内容，避免滑入动画被卡掉
    const contentReady = useEnterTransitionEnd();

    useEffect(() => source?.acquireEditor(), [source]);

    useEffect(() => {
        if (!contentReady) {
            return;
        }
        setEditingMusicList(
            mergeEditorMusicList([], musicList ?? []),
        );
        return () => {
            setEditingMusicList([]);
            setMusicListChanged(false);
        };
    }, [
        contentReady,
        musicList,
        sourceId,
        setEditingMusicList,
        setMusicListChanged,
    ]);

    useEffect(() => {
        if (contentReady && sourceId) {
            setEditingMusicList(previous => mergeEditorMusicList(previous, snapshot.musicList));
        }
    }, [contentReady, sourceId, snapshot.musicList, setEditingMusicList]);

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar>{musicSheet?.title ?? i18n.t("common.sheet")}</AppBar>
            {contentReady ? (
                <>
                    <Body source={source} state={snapshot.state} />
                    <Bottom />
                </>
            ) : (
                <View style={globalStyle.flex1} />
            )}
        </VerticalSafeAreaView>
    );
}
