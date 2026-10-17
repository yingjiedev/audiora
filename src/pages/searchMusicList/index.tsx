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
import { ROUTE_PATH, useNavigate, useParams } from "@/core/router";
import PluginManager from "@/core/pluginManager";
import SearchResult from "./searchResult";
export default function SearchMusicList() {
    const { musicList, musicSheet } = useParams<"search-music-list">();
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const { t } = useI18N();
    const result = useMemo(() => filterMusic(query, musicList ?? [], platform => PluginManager.getPluginDisplayName(platform)), [musicList, query]);
    return <VerticalSafeAreaView style={globalStyle.fwflex1}>
        <StatusBar />
        <AppBar menu={result.length ? [{
            icon: "pencil-square",
            title: t("common.batchEdit"),
            onPress: () => navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
                musicList: result,
                musicSheet: { title: musicSheet?.title ?? query },
                selectionOnly: true,
            }),
        }] : []}><SearchField autoFocus value={query} placeholder={t("searchMusicList.searchPlaceHolder")} accessibilityLabel={t("searchMusicList.searchLabel.a11y")} onChangeText={setQuery} onClear={() => setQuery("")} /></AppBar>
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            <PageSummary title={musicSheet?.title || t("home.localMusic")} description={t("home.songCount", { count: result.length })} />
            <SearchResult result={result} musicSheet={musicSheet} />
        </HorizontalSafeAreaView>
    </VerticalSafeAreaView>;
}
