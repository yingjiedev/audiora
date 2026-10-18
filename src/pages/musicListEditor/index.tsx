import AppBar from "@/components/base/appBar";
import StatusBar from "@/components/base/statusBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import i18n from "@/core/i18n";
import { useParams } from "@/core/router";
import { atom, useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Body from "./components/body";
import Bottom from "./components/bottom";
import { editingMusicListAtom, mergeEditorMusicList, musicListChangedAtom } from "./store/atom";
import useEnterTransitionEnd from "@/hooks/useEnterTransitionEnd";
import { getMusicListSource, MusicListSnapshot } from "@/core/musicListSource";
import { localMusicSheetId, musicHistorySheetId, RequestStateCode } from "@/constants/commonConst";
import { SelectionDoneAction } from "@/components/musicList/selectionControls";
import { canEditMusicList } from "@/core/musicListEditor";
import LocalMusicSheet from "@/core/localMusicSheet";
import musicHistory from "@/core/musicHistory";
import MusicSheet from "@/core/musicSheet";
import Toast from "@/utils/toast";
import { useNavigation } from "@react-navigation/native";

const unavailableSourceAtom = atom<MusicListSnapshot>({ musicList: [], state: RequestStateCode.ERROR });

export default function MusicListEditor() {
    const params = useParams<"music-list-editor">();
    const { musicSheet, musicList, sourceId } = params;
    const canEdit = canEditMusicList(params);
    const navigation = useNavigation();
    const source = getMusicListSource(sourceId);
    const snapshot = useAtomValue(source?.snapshotAtom ?? unavailableSourceAtom);

    const setEditingMusicList = useSetAtom(editingMusicListAtom);
    const [musicListChanged, setMusicListChanged] = useAtom(musicListChangedAtom);
    const editingMusicList = useAtomValue(editingMusicListAtom);
    const store = useStore();
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const saving = useRef(false);
    const [busy, setBusy] = useState(false);
    const save = async () => {
        if (saving.current) return false;
        if (!canEdit || !musicListChanged || !musicSheet?.id) return true;
        saving.current = true;
        setBusy(true);
        try {
            const tracks = editingMusicList.map(item => item.musicItem);
            if (musicSheet.id === localMusicSheetId) await LocalMusicSheet.updateMusicList(tracks);
            else if (musicSheet.id === musicHistorySheetId) await musicHistory.setHistory(tracks);
            else await MusicSheet.manualSort(musicSheet.id, tracks);
            if (!mounted.current) return false;
            const latest = store.get(editingMusicListAtom);
            const unchanged = latest.length === tracks.length && latest.every((item, index) => item.musicItem === tracks[index]);
            if (unchanged) setMusicListChanged(false);
            Toast.success(i18n.t("toast.saveSuccess"));
            return unchanged;
        } catch {
            if (mounted.current) Toast.warn(i18n.t("musicListEditor.actionFailed"));
            return false;
        } finally {
            saving.current = false;
            if (mounted.current) setBusy(false);
        }
    };

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
            <AppBar actionComponent={<SelectionDoneAction disabled={!contentReady || busy} onPress={async () => {
                if (await save()) navigation.goBack();
            }} />}>{musicSheet?.title ?? i18n.t("common.sheet")}</AppBar>
            {contentReady ? (
                <>
                    <Body source={source} state={snapshot.state} canEdit={canEdit} canSave={musicListChanged && !busy} onSave={save} />
                    <Bottom />
                </>
            ) : (
                <View style={globalStyle.flex1} />
            )}
        </VerticalSafeAreaView>
    );
}
