import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import MusicItem from "@/components/mediaItem/musicItem";
import ThemeText from "@/components/base/themeText";
import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";
import { RequestStateCode } from "@/constants/commonConst";
import { useI18N } from "@/core/i18n";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";
import { useCurrentMusic } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
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
    favoriteActions?: {
        link(group: TrackGroup, selected: IMusic.IMusicItem): void;
        split(group: TrackGroup): void;
        removeSource(item: IMusic.IMusicItem): Promise<unknown>;
        prefer(item: IMusic.IMusicItem): Promise<unknown>;
    };
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
    const [expanded, setExpanded] = useState(false);
    useEffect(() => {
        setExpanded(false);
    }, [group.key]);
    const getDisplayName = usePluginDisplayNameResolver();
    const { t } = useI18N();
    const colors = useColors();
    const current = useCurrentMusic();
    const playing = current && group.candidates.some(candidate => trackSourceKey(candidate) === trackSourceKey(current));
    const [busy, setBusy] = useState(false);
    const name = getDisplayName(selected.platform);
    return (
        <View>
            <MusicItem
                musicItem={selected}
                musicSheet={musicSheet}
                highlightText={query}
                highlight={!!playing}
                actions={["favorite", "addNext", "more"]}
                titleTagSubText={Number.isFinite(selected.duration) && selected.duration > 0 ? timeformat(selected.duration) : undefined}
                onItemPress={() => onPlay(selected)}
            />
            <View style={styles.sourceLine}>
                <ThemeText fontColor="textSecondary" fontSize="description" style={styles.sourceName} numberOfLines={1}>
                    {t("aggregate.currentSource", { name })}
                </ThemeText>
                {group.candidates.length > 1 ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("aggregate.chooseSource", { count: group.candidates.length })}
                        accessibilityState={{ expanded }}
                        onPress={() => setExpanded(value => !value)}
                        style={styles.sourceButton}>
                        <ThemeText fontColor="primary" fontSize="description">
                            {t("aggregate.chooseSource", { count: group.candidates.length })}
                        </ThemeText>
                    </Pressable>
                ) : null}
            </View>
            {playing && current && trackSourceKey(current) !== trackSourceKey(selected) ? (
                <View style={styles.sourceLine}>
                    <ThemeText fontColor="textSecondary" fontSize="description">{t("aggregate.playingSource", { name: getDisplayName(current.platform) })}</ThemeText>
                </View>
            ) : null}
            {expanded ? (
                <View accessibilityRole="radiogroup" style={styles.sources}>
                    {group.candidates.map(candidate => {
                        const key = trackSourceKey(candidate);
                        const checked = key === trackSourceKey(selected);
                        return (
                            <Pressable
                                key={key}
                                accessibilityRole="radio"
                                accessibilityState={{ checked }}
                                onPress={() => onSelect(group, key)}
                                style={[styles.choice, { backgroundColor: colors.surface, borderColor: checked ? colors.active : colors.divider }]}>
                                <ThemeText color={checked ? colors.active : colors.text} fontSize="description">
                                    {getDisplayName(candidate.platform)}
                                </ThemeText>
                                <ThemeText fontColor="textSecondary" fontSize="description" numberOfLines={1}>
                                    {[candidate.album, candidate.duration > 0 ? timeformat(candidate.duration) : undefined].filter(Boolean).join(" · ")}
                                </ThemeText>
                            </Pressable>
                        );
                    })}
                    {favoriteActions ? (
                        <View>
                            {group.groupId ? <ThemeText fontColor="textSecondary" fontSize="description">{t("aggregate.groupHeartHint")}</ThemeText> : null}
                            <Pressable accessibilityRole="button" accessibilityLabel={t(group.groupId ? "aggregate.splitFavorites" : "aggregate.linkFavorites")} style={styles.sourceButton} onPress={() => {
                                if (group.groupId) favoriteActions.split(group);
                                else favoriteActions.link(group, selected);
                            }}>
                                <ThemeText fontColor="primary">{t(group.groupId ? "aggregate.splitFavorites" : "aggregate.linkFavorites")}</ThemeText>
                            </Pressable>
                            {group.groupId ? (
                                <Pressable accessibilityRole="button" accessibilityLabel={t("aggregate.removeSource")} disabled={busy} accessibilityState={{ disabled: busy }} style={styles.sourceButton} onPress={async () => {
                                    if (busy) return;
                                    setBusy(true);
                                    try {
                                        await favoriteActions.removeSource(selected);
                                    } finally {
                                        setBusy(false);
                                    }
                                }}>
                                    <ThemeText fontColor="textSecondary">{t("aggregate.removeSource")}</ThemeText>
                                </Pressable>
                            ) : null}
                        </View>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
});

/** Every action receives the original source; confirmed groups also save selection. */
export default function GroupedMusicList(props: GroupedMusicListProps) {
    const [selection, setSelection] = useState<Record<string, string>>({});
    const selected = useMemo(() => props.groups.map(group =>
        group.candidates.find(item => trackSourceKey(item) === (selection[group.key] ?? group.preferredKey)) ?? group.candidates[0],
    ), [props.groups, selection]);
    const latest = useRef({ selected, onPlay: props.onPlay, actions: props.favoriteActions });
    useLayoutEffect(() => {
        latest.current = { selected, onPlay: props.onPlay, actions: props.favoriteActions };
    }, [selected, props.onPlay, props.favoriteActions]);
    const onPlay = useCallback((item: IMusic.IMusicItem) => latest.current.onPlay(item, [...latest.current.selected]), []);
    const onSelect = useCallback((group: TrackGroup, key: string) => {
        setSelection(previous => ({ ...previous, [group.key]: key }));
        if (group.groupId) {
            const candidate = group.candidates.find(item => trackSourceKey(item) === key);
            if (candidate) latest.current.actions?.prefer(candidate);
        }
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

const styles = StyleSheet.create({
    sourceLine: { flexDirection: "row", alignItems: "center", paddingLeft: rpx(32), paddingRight: rpx(24) },
    sourceName: { flex: 1, minWidth: 0, paddingVertical: rpx(8) },
    sourceButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: rpx(12) },
    sources: { paddingHorizontal: rpx(24), paddingBottom: rpx(12), gap: rpx(8) },
    choice: { minHeight: 44, paddingHorizontal: rpx(16), paddingVertical: rpx(10), borderRadius: rpx(12), borderWidth: 1 },
});
