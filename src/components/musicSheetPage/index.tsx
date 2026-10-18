import React from "react";
import NavBar from "./components/navBar";
import SheetMusicList from "./components/sheetMusicList";
import StatusBar from "@/components/base/statusBar";
import globalStyle from "@/constants/globalStyle";
import VerticalSafeAreaView from "../base/verticalSafeAreaView";
import { RequestStateCode } from "@/constants/commonConst";
import MusicSelectionProvider from "@/components/musicList/musicSelectionProvider";
import useInlineMusicSelection from "@/components/musicList/useInlineMusicSelection";
import InlineSelectionBar from "@/components/musicList/inlineSelectionBar";
import type { MusicSelectionActions } from "@/core/musicListEditor";

interface IMusicSheetPageProps {
    navTitle: string;
    typeLabel?: string;
    sheetInfo: ICommon.WithMusicList<IMusic.IMusicSheetItemBase> | null;
    musicList?: IMusic.IMusicItem[] | null;
    // 是否可收藏
    canStar?: boolean;
    // 状态
    state: RequestStateCode;
    onRetry?: () => void;
    onLoadMore?: () => void;
    selectionActions?: MusicSelectionActions;
}

export default function MusicSheetPage(props: IMusicSheetPageProps) {
    return <VerticalSafeAreaView style={globalStyle.fwflex1}>
        <MusicSelectionProvider><MusicSheetContent {...props} /></MusicSelectionProvider>
    </VerticalSafeAreaView>;
}

const emptyMusicList: IMusic.IMusicItem[] = [];

function MusicSheetContent(props: IMusicSheetPageProps) {
    const { navTitle, typeLabel, sheetInfo, musicList, canStar, onLoadMore, onRetry, state } =
        props;
    const tracks = musicList ?? sheetInfo?.musicList ?? emptyMusicList;
    const editor = useInlineMusicSelection(`sheet:${sheetInfo?.platform}:${sheetInfo?.id}:${navTitle}`, tracks, { actions: props.selectionActions });

    return (
        <>
            <StatusBar />
            <NavBar
                musicList={musicList ?? sheetInfo?.musicList ?? []}
                navTitle={navTitle}
                onEdit={editor.start}
            />
            <SheetMusicList
                typeLabel={typeLabel}
                canStar={canStar}
                sheetInfo={sheetInfo as any}
                musicList={musicList ?? sheetInfo?.musicList}
                state={state}
                onRetry={onRetry ?? onLoadMore}
                onLoadMore={onLoadMore}
                selection={editor.selection}
                onEdit={editor.start}
                editingControls={editor.editing ? <InlineSelectionBar editor={editor} count={tracks.length} paginated /> : undefined}
            />
        </>
    );
}
