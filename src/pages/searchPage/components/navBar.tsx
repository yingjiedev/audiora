import React from "react";
import AppBar from "@/components/base/appBar";
import SearchField from "@/components/base/searchField";
import { PageAction } from "@/components/base/pageSection";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import PluginManager, { usePluginDisplayNameResolver } from "@/core/pluginManager";
import { useAtom, useSetAtom } from "jotai";
import { addHistory } from "../common/historySearch";
import useSearch from "../hooks/useSearch";
import { PageStatus, initSearchResults, pageStatusAtom, queryAtom, searchResultsAtom } from "../store/atoms";
export default function NavBar() {
    const params = useParams<"search-page">();
    const getDisplayName = usePluginDisplayNameResolver();
    const source = params?.pluginHash ? PluginManager.getByHash(params.pluginHash) : undefined;
    const search = useSearch();
    const [query, setQuery] = useAtom(queryAtom);
    const setPageStatus = useSetAtom(pageStatusAtom);
    const setSearchResultsState = useSetAtom(searchResultsAtom);
    const { t } = useI18N();
    const placeholder = source ? t("musicLibrary.searchSourcePlaceholder", { name: getDisplayName(source) }) : t("searchPage.searchPlaceHolder");
    const onSearchSubmit = async () => {
        if (!query.trim()) return;
        setSearchResultsState(initSearchResults);
        setPageStatus(prev => prev === PageStatus.EDITING ? PageStatus.SEARCHING : prev);
        await search(query, 1);
        await addHistory(query);
    };
    return <AppBar actionComponent={<PageAction title={t("common.search")} onPress={onSearchSubmit} disabled={!query.trim()} />}>
        <SearchField autoFocus value={query} placeholder={placeholder} accessibilityLabel={t("searchPage.searchLabel.a11y")} accessibilityHint={placeholder}
            onFocus={() => setPageStatus(PageStatus.EDITING)} onSubmitEditing={onSearchSubmit}
            onClear={() => {
                setQuery(""); setPageStatus(PageStatus.EDITING);
            }}
            onChangeText={text => {
                if (!text) setPageStatus(PageStatus.EDITING); setQuery(text);
            }} />
    </AppBar>;
}
