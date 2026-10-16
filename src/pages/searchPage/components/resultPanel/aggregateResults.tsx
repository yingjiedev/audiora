import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useAtomValue } from "jotai";
import GroupedMusicList from "@/components/musicList/groupedMusicList";
import useFavoriteGroupActions from "@/components/musicList/useFavoriteGroupActions";
import { trackSourceKey } from "@/utils/trackGroup";
import ThemeText from "@/components/base/themeText";
import Button from "@/components/base/textButton";
import { RequestStateCode } from "@/constants/commonConst";
import Config from "@/core/appConfig";
import TrackPlayer from "@/core/trackPlayer";
import { useSearchablePlugins, usePluginDisplayNameResolver } from "@/core/pluginManager";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import { groupTracks, interleaveTracks, TrackGroup } from "@/utils/trackGroup";
import rpx from "@/utils/rpx";
import { scopeSearchPlugins } from "../../common/searchScope";
import useSearch from "../../hooks/useSearch";
import { queryAtom, searchResultsAtom, searchSessionAtom } from "../../store/atoms";

export default function AggregateResults() {
    const params = useParams<"search-page">();
    const plugins = scopeSearchPlugins(useSearchablePlugins("music"), params?.pluginHash);
    const sourceKey = plugins.map(plugin => plugin.hash).join("|");
    const results = useAtomValue(searchResultsAtom).music;
    const query = useAtomValue(queryAtom);
    const session = useAtomValue(searchSessionAtom);
    const search = useSearch();
    const { t } = useI18N();
    const getDisplayName = usePluginDisplayNameResolver();
    const { state: favorites, actions } = useFavoriteGroupActions();
    const previous = useRef<{ session: number; groups: TrackGroup[] }>({ session, groups: [] });
    const groups = useMemo(() => groupTracks(
        interleaveTracks(plugins.map(plugin => (results[plugin.hash]?.data ?? []) as IMusic.IMusicItem[])),
        previous.current.session === session ? previous.current.groups : [],
    // The source key tracks the ordered source snapshot, rather than array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [results, sourceKey, session]);
    useEffect(() => {
        previous.current = { session, groups };
    }, [session, groups]);
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
    const completed = states.filter(value => value !== undefined && value !== RequestStateCode.PENDING_FIRST_PAGE && value !== RequestStateCode.PENDING_REST_PAGE).length;
    return (
        <GroupedMusicList
            key={session}
            groups={groups.map(group => {
                const saved = favorites.groups.find(value => group.candidates.every(item => value.memberKeys.includes(trackSourceKey(item))));
                return saved ? { ...group, groupId: saved.id, preferredKey: saved.preferredKey } : group;
            })}
            favoriteActions={actions}
            query={query}
            state={state}
            renderHeader={() => (
                <View style={styles.summary}>
                    <ThemeText fontColor="textSecondary" fontSize="description">
                        {t("aggregate.searchProgress", { done: completed, total: plugins.length })}
                    </ThemeText>
                    {failed.map(plugin => (
                        <Button key={plugin.hash} onPress={() => {
                            search(undefined, undefined, "music", plugin.hash, "retry");
                        }}>
                            {t("aggregate.retrySource", { name: getDisplayName(plugin) })}
                        </Button>
                    ))}
                </View>
            )}
            onPlay={(item, list) => {
                if (Config.getConfig("basic.clickMusicInSearch") === "playMusicAndReplace") {
                    TrackPlayer.playWithReplacePlayList(item, list);
                } else {
                    TrackPlayer.play(item);
                }
            }}
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
