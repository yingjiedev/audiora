import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import NavBar from "./components/navBar";
import { useAtom, useSetAtom } from "jotai";
import {
    PageStatus,
    initSearchResults,
    pageStatusAtom,
    queryAtom,
    searchResultsAtom,
} from "./store/atoms";
import HistoryPanel from "./components/historyPanel";
import ResultPanel from "./components/resultPanel";
import Loading from "@/components/base/loading";
import { SafeAreaView } from "react-native-safe-area-context";
import StatusBar from "@/components/base/statusBar";
import NoPlugin from "../../components/base/noPlugin";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import { resetSearch, updateSearchSources } from "./store/searchController";
import { useSearchablePlugins } from "@/core/pluginManager";
import MusicSelectionProvider from "@/components/musicList/musicSelectionProvider";

export default function () {
    const params = useParams<"search-page">();
    const plugins = useSearchablePlugins();
    const sourceKey = plugins.map(plugin => plugin.hash).join("|");
    const [pageStatus, setPageStatus] = useAtom(pageStatusAtom);
    const setQuery = useSetAtom(queryAtom);
    const setSearchResultsState = useSetAtom(searchResultsAtom);
    const { t } = useI18N();

    useEffect(() => {
        resetSearch("", params?.pluginHash);
        setPageStatus(PageStatus.EDITING);
        setQuery("");
        setSearchResultsState(initSearchResults);
        return () => {
            resetSearch();
            setPageStatus(PageStatus.EDITING);
            setQuery("");
        };
    }, [setPageStatus, setQuery, setSearchResultsState, params?.pluginHash]);

    useEffect(() => {
        updateSearchSources(params?.pluginHash);
    }, [sourceKey, params?.pluginHash]);

    return (
        <SafeAreaView
            edges={["bottom", "top"]}
            style={style.wrapper}>
            <MusicSelectionProvider>
                <StatusBar />
                <NavBar />
                <SafeAreaView edges={["left", "right"]} style={style.wrapper}>
                    <View style={style.flex1}>
                        {pageStatus === PageStatus.EDITING && <HistoryPanel />}
                        {pageStatus === PageStatus.SEARCHING && <Loading />}
                        {pageStatus === PageStatus.RESULT && <ResultPanel />}
                        {pageStatus === PageStatus.NO_PLUGIN && (
                            <NoPlugin notSupportType={t("common.search")} />
                        )}
                    </View>
                </SafeAreaView>
            </MusicSelectionProvider>
        </SafeAreaView>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    flex1: {
        flex: 1,
    },
});
