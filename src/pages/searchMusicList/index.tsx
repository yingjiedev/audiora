import { filterMusic } from "./filterMusic";
import React, { useMemo, useState } from "react";
import AppBar from "@/components/base/appBar";
import SearchField from "@/components/base/searchField";
import { PageSummary } from "@/components/base/pageSection";
import StatusBar from "@/components/base/statusBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import useInlineMusicSelection from "@/components/musicList/useInlineMusicSelection";
import MusicSelectionProvider from "@/components/musicList/musicSelectionProvider";
import InlineSelectionBar from "@/components/musicList/inlineSelectionBar";
import { SelectionDoneAction } from "@/components/musicList/selectionHeader";
import PluginManager from "@/core/pluginManager";
import SearchResult from "./searchResult";
export default function SearchMusicList() {
    return <VerticalSafeAreaView style={globalStyle.fwflex1}>
        <MusicSelectionProvider><SearchMusicListContent /></MusicSelectionProvider>
    </VerticalSafeAreaView>;
}

function SearchMusicListContent() {
    const { musicList, musicSheet } = useParams<"search-music-list">();
    const [query, setQuery] = useState("");
    const { t } = useI18N();
    const result = useMemo(() => filterMusic(query, musicList ?? [], platform => PluginManager.getPluginDisplayName(platform)), [musicList, query]);
    const editor = useInlineMusicSelection(`filtered:${musicSheet?.id}:${query}`, result);
    return <>
        <StatusBar />
        <AppBar onBackPress={editor.editing ? editor.finish : undefined}
            actionComponent={editor.editing ? <SelectionDoneAction onPress={editor.finish} /> : undefined} menu={!editor.editing && result.length ? [{
                icon: "pencil-square",
                title: t("common.batchEdit"),
                onPress: editor.start,
            }] : []}><SearchField autoFocus value={query} placeholder={t("searchMusicList.searchPlaceHolder")} accessibilityLabel={t("searchMusicList.searchLabel.a11y")} onChangeText={setQuery} onClear={() => setQuery("")} /></AppBar>
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            <PageSummary title={musicSheet?.title || t("home.localMusic")} description={t("home.songCount", { count: result.length })} />
            <InlineSelectionBar editor={editor} count={result.length} />
            <SearchResult result={result} musicSheet={musicSheet} selection={editor.selection} />
        </HorizontalSafeAreaView>
    </>;
}
