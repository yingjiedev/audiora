import React, { useCallback } from "react";
import { BackHandler, View } from "react-native";
import NavBar from "./components/navBar";
import SheetMusicList from "./components/sheetMusicList";
import StatusBar from "@/components/base/statusBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import CustomBackground from "@/components/base/customBackground";
import { LocalBackgroundContext } from "@/hooks/useHasCustomBackground";
import useColors from "@/hooks/useColors";
import MusicSheet, { useSheetItem } from "@/core/musicSheet";
import { useParams } from "@/core/router";
import useMusicSelection from "@/components/musicList/useMusicSelection";
import { SelectionActions, SelectionBar } from "@/components/musicList/selectionControls";
import { useFocusEffect } from "@react-navigation/native";
import { isPlayerOpen } from "@/core/playerOverlay";

const emptyMusicList: IMusic.IMusicItem[] = [];

export default function SheetDetail() {
    const { id = "favorite" } = useParams<"local-sheet-detail">();
    const musicSheet = useSheetItem(id);
    const colors = useColors();
    const background = musicSheet?.background;
    const musicList = musicSheet?.musicList ?? emptyMusicList;
    const editor = useMusicSelection(id, musicList);
    const { editing, finish } = editor;
    useFocusEffect(useCallback(() => {
        if (!editing) return;
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            if (isPlayerOpen()) return false;
            finish();
            return true;
        });
        return () => subscription.remove();
    }, [editing, finish]));

    // 背景层放在 SafeAreaView 外面：绝对定位是相对父节点的内边距框计算的，
    // 放在里面会盖不住状态栏那条安全区。
    return (
        <LocalBackgroundContext.Provider value={!!background}>
            <View style={globalStyle.fwflex1}>
                {background ? (
                    <CustomBackground
                        url={background}
                        blur={musicSheet?.backgroundBlur}
                        opacity={musicSheet?.backgroundOpacity}
                        backgroundColor={
                            colors?.pageBackground ?? colors.background
                        }
                    />
                ) : null}
                <VerticalSafeAreaView style={globalStyle.fwflex1}>
                    <StatusBar />
                    <NavBar editing={editor.editing} onEdit={editor.start} onFinishEdit={editor.finish} />
                    <SheetMusicList onEdit={editor.start} selection={editor.selection} editingControls={editor.editing ? (
                        <SelectionBar count={editor.selectedItems.length} allSelected={editor.allSelected} disabled={!musicList.length} onToggleAll={editor.toggleAll} />
                    ) : undefined} />
                    {editor.editing ? <SelectionActions key={id} selectedItems={editor.selectedItems} onClear={editor.clear}
                        removal={{ onRemove: items => MusicSheet.removeMusic(id, items) }} /> : null}
                </VerticalSafeAreaView>
            </View>
        </LocalBackgroundContext.Provider>
    );
}
