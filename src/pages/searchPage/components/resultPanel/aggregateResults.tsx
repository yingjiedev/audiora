import React, { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { getDefaultStore, useAtomValue } from "jotai";
import GroupedMusicList from "@/components/musicList/groupedMusicList";
import useFavoriteGroupActions from "@/components/musicList/useFavoriteGroupActions";
import { FavoriteGroupDecorator } from "@/core/favoriteGroupsModel";
import ThemeText from "@/components/base/themeText";
import { PageState } from "@/components/base/pageSection";
import ListFooter from "@/components/base/listFooter";
import SearchPending from "./searchPending";
import { RequestStateCode } from "@/constants/commonConst";
import Config from "@/core/appConfig";
import TrackPlayer from "@/core/trackPlayer";
import { useSearchablePlugins } from "@/core/pluginManager";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import { TrackGroupIndex } from "@/utils/trackGroup";
import rpx from "@/utils/rpx";
import { scopeSearchPlugins } from "../../common/searchScope";
import useSearch from "../../hooks/useSearch";
import { musicSearchResultsAtom, queryAtom, searchSessionAtom } from "../../store/atoms";
import BatchEditAction from "@/components/musicList/batchEditAction";
import useMusicListSource from "@/hooks/useMusicListSource";

export default function AggregateResults() {
    const params = useParams<"search-page">();
    const plugins = scopeSearchPlugins(useSearchablePlugins("music"), params?.pluginHash);
    const sourceKey = plugins.map(plugin => plugin.hash).join("|");
    const results = useAtomValue(musicSearchResultsAtom);
    const query = useAtomValue(queryAtom);
    const session = useAtomValue(searchSessionAtom);
    const search = useSearch();
    const { t } = useI18N();
    const { state: favorites, actions } = useFavoriteGroupActions();
    // Query/source changes must drop the append index even if no data has arrived yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const grouping = useMemo(() => new TrackGroupIndex(), [session, sourceKey]);
    const decoration = useMemo(() => new FavoriteGroupDecorator(), []);
    const rawGroups = useMemo(() => grouping.sync(plugins.map(plugin => ({
        key: plugin.hash,
        data: (results[plugin.hash]?.data ?? []) as IMusic.IMusicItem[],
        dataVersion: results[plugin.hash]?.dataVersion,
    }))),
    // The source key tracks the ordered source snapshot, rather than array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, sourceKey, grouping]);
    const groups = useMemo(() => decoration.sync(rawGroups, favorites), [decoration, rawGroups, favorites]);
    useEffect(() => {
        search(undefined, undefined, "music", undefined, "ensure");
    }, [search, sourceKey, session]);
    const states = plugins.map(plugin => results[plugin.hash]?.state);
    const pending = states.some(state => state === undefined || state === RequestStateCode.PENDING_FIRST_PAGE || state === RequestStateCode.PENDING_REST_PAGE);
    const ready = states.some(state => state === RequestStateCode.PARTLY_DONE);
    const failed = plugins.filter(plugin => results[plugin.hash]?.state === RequestStateCode.ERROR);
    const state = pending ? (groups.length ? RequestStateCode.PENDING_REST_PAGE : RequestStateCode.PENDING_FIRST_PAGE)
        : ready ? RequestStateCode.PARTLY_DONE
            : failed.length === plugins.length && !groups.length ? RequestStateCode.ERROR : RequestStateCode.FINISHED;
    // Bulk actions retain every original source, including candidates folded into a row.
    const batchMusicList = useMemo(() => groups.flatMap(group => group.candidates), [groups]);
    const { sourceId } = useMusicListSource(
        { musicList: batchMusicList, state: !pending && !ready && failed.length ? RequestStateCode.ERROR : state },
        async retry => {
            await search(undefined, undefined, "music", undefined, retry ? "retry" : "next");
            // A configuration error can make retry a no-op; publish the actual state.
            const current = getDefaultStore().get(musicSearchResultsAtom);
            const currentStates = plugins.map(plugin => current[plugin.hash]?.state);
            const musicList = plugins.flatMap(plugin => (current[plugin.hash]?.data ?? []) as IMusic.IMusicItem[]);
            const loading = currentStates.some(value => value === RequestStateCode.PENDING_FIRST_PAGE || value === RequestStateCode.PENDING_REST_PAGE);
            const nextState = loading ? (musicList.length ? RequestStateCode.PENDING_REST_PAGE : RequestStateCode.PENDING_FIRST_PAGE)
                : currentStates.includes(RequestStateCode.PARTLY_DONE) ? RequestStateCode.PARTLY_DONE
                    : currentStates.includes(RequestStateCode.ERROR) ? RequestStateCode.ERROR : RequestStateCode.FINISHED;
            return { musicList, state: nextState };
        },
    );
    const onPlay = useCallback((item: IMusic.IMusicItem, list: IMusic.IMusicItem[]) => {
        if (Config.getConfig("basic.clickMusicInSearch") === "playMusicAndReplace") TrackPlayer.playWithReplacePlayList(item, list);
        else TrackPlayer.play(item);
    }, []);
    return (
        <GroupedMusicList
            key={session}
            groups={groups}
            renderHeader={() => <BatchEditAction musicList={batchMusicList} sourceId={sourceId} title={`${query} · ${t("aggregate.all")}`} />}
            favoriteActions={actions}
            query={query}
            state={state}
            emptyComponent={pending ? <SearchPending active hasResults={false} session={session} />
                : <PageState title={t(failed.length === plugins.length ? "aggregate.allSourcesIncomplete" : "common.emptyList")}
                    description={failed.length ? t("aggregate.incompleteHint") : undefined} />}
            footerComponent={!groups.length ? null : pending ? <SearchPending active hasResults session={session} />
                : ready ? <View style={styles.summary}><ThemeText fontColor="textSecondary">{t("aggregate.loadMore")}</ThemeText></View>
                    : <ListFooter state={state} />}
            onPlay={onPlay}
            onLoadMore={() => {
                search(undefined, undefined, "music", undefined, "next");
            }}
            onRetry={() => {
                search(undefined, undefined, "music", undefined, "retry");
            }}
            onRefresh={() => {
                search(undefined, 1, "music", undefined, "refresh");
            }}
        />
    );
}

const styles = StyleSheet.create({
    summary: { paddingHorizontal: rpx(24), paddingVertical: rpx(12), gap: rpx(8) },
});
