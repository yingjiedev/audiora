import { AggregateSearch, SearchOperation, SourceSearchResult } from "@/core/aggregateSearch";
import PluginManager from "@/core/pluginManager";
import { RequestStateCode } from "@/constants/commonConst";
import { getDefaultStore } from "jotai";
import { trackSourceKey } from "@/utils/trackGroup";
import { scopeSearchPlugins } from "../common/searchScope";
import { initSearchResults, pageStatusAtom, PageStatus, queryAtom, searchResultsAtom, searchSessionAtom } from "./atoms";

let currentScope: string | undefined;
let publishTimer: ReturnType<typeof setTimeout> | undefined;
let publishedRaw: Record<string, SourceSearchResult<ICommon.IMediaBase>> = {};
let publishedPending = false;
let publishedDataTypes = new Set<string>();

function publish() {
    clearTimeout(publishTimer);
    publishTimer = undefined;
    const store = getDefaultStore();
    const previous = store.get(searchResultsAtom);
    let results = previous;
    const changedTypes = new Set<string>();
    const dataTypes = new Set<string>();
    let pending = false;
    for (const [key, result] of Object.entries(coordinator.results)) {
        const [type, hash] = JSON.parse(key) as [ICommon.SupportMediaType, string];
        pending ||= result.state === "loading";
        if (result.data.length) dataTypes.add(type);
        if (publishedRaw[key] === result && previous[type][hash]) continue;
        if (!changedTypes.has(type)) {
            results = { ...results, [type]: { ...previous[type] } };
            changedTypes.add(type);
        }
        results[type][hash] = {
            ...result,
            query: coordinator.query,
            state: result.state === "loading"
                ? (result.data.length ? RequestStateCode.PENDING_REST_PAGE : RequestStateCode.PENDING_FIRST_PAGE)
                : result.state === "ready" ? RequestStateCode.PARTLY_DONE
                    : result.state === "finished" ? RequestStateCode.FINISHED : RequestStateCode.ERROR,
        };
    }
    if (!Object.keys(coordinator.results).length) results = { music: {}, album: {}, artist: {}, sheet: {}, lyric: {} };
    publishedRaw = coordinator.results;
    publishedPending = pending;
    publishedDataTypes = dataTypes;
    store.set(searchResultsAtom, results);
}

function schedulePublication() {
    if (coordinator.results === publishedRaw) return;
    const entries = Object.entries(coordinator.results);
    const pending = entries.some(([, result]) => result.state === "loading");
    const firstData = entries.some(([key, result]) => result.data.length && !publishedDataTypes.has(JSON.parse(key)[0]));
    // First results and loading/completion transitions are immediate. Coalesce bursts.
    if (!entries.length || firstData || pending !== publishedPending) publish();
    else if (publishTimer === undefined) publishTimer = setTimeout(publish, 50);
}

const coordinator = new AggregateSearch<ICommon.IMediaBase>(schedulePublication, trackSourceKey);

export function resetSearch(query = "", scope?: string) {
    currentScope = scope;
    coordinator.reset(query);
    getDefaultStore().set(searchSessionAtom, value => value + 1);
}

export function updateSearchSources(scope?: string) {
    const store = getDefaultStore();
    const query = coordinator.query;
    resetSearch(query, scope);
    if (query && store.get(pageStatusAtom) !== PageStatus.EDITING) {
        runSearch(undefined, undefined, "music", undefined, scope, "ensure");
    }
}

export function runSearch(
    query?: string,
    page?: number,
    type: ICommon.SupportMediaType = "music",
    pluginHash?: string,
    scope?: string,
    operation?: SearchOperation,
) {
    const store = getDefaultStore();
    const keyword = query ?? (coordinator.query || store.get(queryAtom));
    if (currentScope !== scope || coordinator.query !== keyword
        || store.get(searchResultsAtom) === initSearchResults
        || (query !== undefined && page === 1 && !pluginHash)) {
        resetSearch(keyword, scope);
    }
    const plugins = scopeSearchPlugins(PluginManager.getSortedSearchablePlugins(type), pluginHash ?? scope)
        .filter(plugin => plugin.hash && plugin.instance.platform);
    if (!plugins.length) {
        const anySources = scopeSearchPlugins(PluginManager.getSearchablePlugins(), scope);
        if (!anySources.length) store.set(pageStatusAtom, PageStatus.NO_PLUGIN);
        else if (store.get(pageStatusAtom) !== PageStatus.EDITING) store.set(pageStatusAtom, PageStatus.RESULT);
        return Promise.resolve();
    }
    if (store.get(pageStatusAtom) !== PageStatus.EDITING) store.set(pageStatusAtom, PageStatus.RESULT);
    const sources = plugins.map(plugin => ({
        key: JSON.stringify([type, plugin.hash]),
        search: (term: string, requestedPage: number) => plugin.methods.search(term, requestedPage, type),
    }));
    const inferred = page === 1 ? "refresh" : query === undefined ? "next" : "refresh";
    return coordinator.request(sources, operation ?? inferred, page);
}
