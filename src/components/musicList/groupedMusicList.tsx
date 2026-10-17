import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import MusicItem from "@/components/mediaItem/musicItem";
import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";
import { RequestStateCode } from "@/constants/commonConst";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";
import { useCurrentMusic } from "@/core/trackPlayer";
import { showPanel } from "@/components/panels/usePanel";
import timeformat from "@/utils/timeformat";
import { TrackGroup, trackSourceKey } from "@/utils/trackGroup";

interface GroupedMusicListProps {
    groups: TrackGroup[];
    state: RequestStateCode;
    musicSheet?: IMusic.IMusicSheetItem;
    query?: string;
    renderHeader?: (selected: IMusic.IMusicItem[]) => React.ReactElement;
    onPlay: (item: IMusic.IMusicItem, list: IMusic.IMusicItem[]) => void;
    onLoadMore?: () => void;
    onRetry?: () => void;
    onRefresh?: () => void;
    emptyComponent?: React.ReactElement;
    footerComponent?: React.ReactElement | null;
    favoriteActions?: FavoriteGroupActions;
}

export interface FavoriteGroupActions {
    link(group: TrackGroup, selected: IMusic.IMusicItem): void;
    split(group: TrackGroup): void;
    removeSource(item: IMusic.IMusicItem): Promise<unknown>;
    prefer(item: IMusic.IMusicItem): Promise<unknown>;
}

const GroupRow = memo(function TrackGroupRow({ group, selected, onSelect, onPlay, musicSheet, query, favoriteActions }: {
    group: TrackGroup;
    selected: IMusic.IMusicItem;
    onSelect: (group: TrackGroup, key: string) => void;
    onPlay: (item: IMusic.IMusicItem) => void;
    musicSheet?: IMusic.IMusicSheetItem;
    query?: string;
    favoriteActions?: GroupedMusicListProps["favoriteActions"];
}) {
    const getDisplayName = usePluginDisplayNameResolver();
    const current = useCurrentMusic();
    const playing = current && group.candidates.some(candidate => trackSourceKey(candidate) === trackSourceKey(current));
    return (
        <MusicItem
            musicItem={selected}
            musicSheet={musicSheet}
            highlightText={query}
            highlight={!!playing}
            actions={["favorite", "addNext", "more"]}
            source={{
                name: getDisplayName(playing && current ? current.platform : selected.platform),
                count: group.candidates.length,
                playing: !!playing,
                onPress: group.candidates.length > 1 ? () => showPanel("TrackGroupSources", {
                    group,
                    selected,
                    onSelect: key => onSelect(group, key),
                    favoriteActions,
                }) : undefined,
            }}
            titleTagSubText={Number.isFinite(selected.duration) && selected.duration > 0 ? timeformat(selected.duration) : undefined}
            onItemPress={() => onPlay(selected)}
        />
    );
});

/** Every action receives the original source; confirmed groups also save selection. */
export default function GroupedMusicList(props: GroupedMusicListProps) {
    const [selection, setSelection] = useState<Record<string, string>>({});
    const selected = useMemo(() => props.groups.map(group =>
        group.candidates.find(item => trackSourceKey(item) === (selection[group.key] ?? group.preferredKey)) ?? group.candidates[0],
    ), [props.groups, selection]);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const latest = useRef({ groups: props.groups, selected, onPlay: props.onPlay, actions: props.favoriteActions });
    useLayoutEffect(() => {
        latest.current = { groups: props.groups, selected, onPlay: props.onPlay, actions: props.favoriteActions };
    }, [props.groups, selected, props.onPlay, props.favoriteActions]);
    const onPlay = useCallback((item: IMusic.IMusicItem) => latest.current.onPlay(item, [...latest.current.selected]), []);
    const onSelect = useCallback((group: TrackGroup, key: string) => {
        // A panel can outlive a search result or a source removed from favorites.
        const activeGroup = latest.current.groups.find(item => item.key === group.key);
        const candidate = activeGroup?.candidates.find(item => trackSourceKey(item) === key);
        if (!mounted.current || !activeGroup || !candidate) return;
        setSelection(previous => ({ ...previous, [group.key]: key }));
        if (activeGroup.groupId) latest.current.actions?.prefer(candidate);
    }, []);
    const renderItem = useCallback(({ item: group, index }: { item: TrackGroup; index: number }) => (
        <GroupRow
            group={group}
            selected={selected[index]}
            onSelect={onSelect}
            onPlay={onPlay}
            musicSheet={props.musicSheet}
            query={props.query}
            favoriteActions={props.favoriteActions}
        />
    ), [selected, onSelect, onPlay, props.musicSheet, props.query, props.favoriteActions]);
    return (
        <FlashList
            data={props.groups}
            extraData={selection}
            keyExtractor={group => group.key}
            ListHeaderComponent={props.renderHeader?.(selected)}
            ListEmptyComponent={props.emptyComponent ?? <ListEmpty state={props.state} onRetry={props.onRetry} />}
            ListFooterComponent={props.footerComponent === undefined
                ? (props.groups.length ? <ListFooter state={props.state} onRetry={props.onRetry} /> : null)
                : props.footerComponent}
            refreshing={false}
            onRefresh={props.onRefresh}
            onEndReached={() => {
                if (props.state === RequestStateCode.PARTLY_DONE) props.onLoadMore?.();
            }}
            onEndReachedThreshold={0.1}
            renderItem={renderItem}
        />
    );
}
