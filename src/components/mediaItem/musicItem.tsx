import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import rpx from "@/utils/rpx";
import { radius, spacing } from "@/constants/designSystem";
import { iconSizeConst } from "@/constants/uiConst";
import LocalMusicSheet from "@/core/localMusicSheet";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import { useI18N } from "@/core/i18n";
import TrackPlayer, { useCurrentMusic } from "@/core/trackPlayer";
import { isSameMediaItem } from "@/utils/mediaUtils";
import { showPanel } from "../panels/usePanel";
import ThemeText from "../base/themeText";
import Icon, { IIconName } from "../base/icon";
import FastImage from "../base/fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import Badge from "../base/badge";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";
import { resolveArtwork } from "@/utils/artwork";
import { canPlayMusicVideo } from "@/utils/musicVideo";
import { getQualityBadge } from "./musicItemQuality";
import { splitTitleHighlight } from "./musicItemTitle";

export type MusicItemAction = "favorite" | "addNext" | "more";
export const MUSIC_ITEM_HEIGHT = rpx(120);

interface IMusicItemProps {
    index?: string | number;
    musicItem: IMusic.IMusicItem;
    titleTagSubText?: string;
    musicSheet?: IMusic.IMusicSheetItem;
    onItemPress?: (musicItem: IMusic.IMusicItem) => void;
    onItemLongPress?: () => void;
    itemPaddingRight?: number;
    itemPaddingLeft?: number;
    left?: React.ReactNode;
    /** Defined only when the row selects music instead of playing it. */
    checked?: boolean | "mixed";
    containerStyle?: StyleProp<ViewStyle>;
    highlight?: boolean;
    highlightText?: string;
    /** Aggregate rows keep the source inside their existing two text lines. */
    source?: { name: string; count: number; playing?: boolean; onPress?: () => void };
    /** All scenes share this row; only leading content and actions vary. */
    actions?: readonly MusicItemAction[];
    showCover?: boolean;
    /** Compact previews keep the shared content and interactions with less spacing. */
    density?: "default" | "compact";
    /** Favorites add listening counts and actual metadata to the discovery layout. */
    presentation?: "library" | "discovery" | "favorites";
    playCount?: number;
    sourceName?: string;
}

function RowAction(props: { icon: IIconName; label: string; onPress: () => void; color?: string; disabled?: boolean; selected?: boolean }) {
    const colors = useColors();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.label}
            accessibilityState={{ disabled: !!props.disabled, selected: props.selected }}
            disabled={props.disabled}
            onPress={props.onPress}
            style={({ pressed }) => [styles.action, (pressed || props.disabled) && styles.muted]}>
            <Icon name={props.icon} size={iconSizeConst.light} color={props.color ?? colors.textSecondary ?? colors.text} />
        </Pressable>
    );
}

function FavoriteAction({ musicItem }: { musicItem: IMusic.IMusicItem }) {
    const isFavorite = useFavorite(musicItem);
    const grouped = !!MusicSheet.favorites.groupFor(musicItem);
    const colors = useColors();
    const { t } = useI18N();
    const pending = useRef(false);
    const [busy, setBusy] = useState(false);
    const toggle = async () => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        try {
            await MusicSheet.favorites.toggle(musicItem);
        } catch {
            Toast.warn(t(isFavorite ? "toast.deleteFailed" : "panel.addToMusicSheet.toast.fail"));
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };
    return (
        <RowAction
            icon={isFavorite ? "heart" : "heart-outline"}
            label={t(isFavorite ? (grouped ? "aggregate.unfavoriteGroup" : "musicDetail.a11y.unfavorite") : "musicDetail.a11y.favorite")}
            color={isFavorite ? colors.favorite : undefined}
            onPress={toggle}
            disabled={busy}
            selected={isFavorite}
        />
    );
}

export default function MusicItem(props: IMusicItemProps) {
    const {
        musicItem, index, titleTagSubText, onItemPress, onItemLongPress,
        musicSheet, itemPaddingRight, itemPaddingLeft, left, checked, containerStyle,
        highlight, highlightText, source, actions = ["addNext", "more"], showCover = false, density = "default", presentation = "library", playCount, sourceName,
    } = props;
    const colors = useColors();
    const { t } = useI18N();
    const currentMusic = useCurrentMusic();
    const active = highlight ?? isSameMediaItem(musicItem, currentMusic);
    const isLocal = LocalMusicSheet.useIsLocal(musicItem);
    const localMusicItem = isLocal ? LocalMusicSheet.isLocalMusic(musicItem) : undefined;
    const qualityBadge = useMemo(() => getQualityBadge(musicItem, localMusicItem), [localMusicItem, musicItem]);
    const titleParts = useMemo(() => splitTitleHighlight(musicItem.title, highlightText), [musicItem.title, highlightText]);
    const hasMv = useMemo(() => canPlayMusicVideo(musicItem), [musicItem]);
    const album = typeof musicItem.album === "string" ? musicItem.album.trim() : "";
    const showAlbum = album && album !== String(musicItem.title ?? "").trim();
    const compact = density === "compact";
    const discovery = presentation !== "library";
    const favorites = presentation === "favorites";
    const plays = typeof playCount === "number" && Number.isFinite(playCount) ? Math.max(0, Math.floor(playCount)) : 0;
    const favoriteSourceName = favorites ? sourceName?.trim() : undefined;
    const artist = [musicItem.artist?.trim(), showAlbum ? album : undefined].filter(Boolean).join(" · ");
    const titleSize = compact && !favorites ? "subTitle" : "content";
    const [sourceAnchor, setSourceAnchor] = useState<number | null>(null);
    const canChooseSource = !!source?.onPress && source.count > 1;
    const play = () => onItemPress ? onItemPress(musicItem) : TrackPlayer.play(musicItem);
    const mainStyle = [styles.main, compact && styles.compactMain, discovery && styles.discoveryMain, favorites && styles.favoriteMain, source && styles.sourceMain];
    const favoriteHint = favorites ? [showAlbum ? album : undefined, favoriteSourceName, t("listening.playCount", { count: plays })].filter(Boolean).join(" · ") : undefined;
    const sourceHint = source ? t(source.playing ? "aggregate.playingSource" : "aggregate.currentSource", { name: source.name }) : undefined;
    const playProps = {
        accessibilityRole: checked === undefined ? "button" as const : "checkbox" as const,
        accessibilityLabel: [musicItem.title, musicItem.artist].filter(Boolean).join(" - "),
        accessibilityHint: [favoriteHint, sourceHint].filter(Boolean).join(" · ") || undefined,
        accessibilityState: { selected: active, checked },
        onLongPress: onItemLongPress,
        onPress: play,
    };
    const content = (
        <>
            {left}
            {index !== undefined ? (
                <ThemeText pointerEvents={source ? "none" : undefined} fontColor={active ? "primary" : "textSecondary"} style={[styles.index, compact && styles.compactIndex, checked !== undefined && styles.selectionIndex]}>
                    {index}
                </ThemeText>
            ) : null}
            {showCover ? (
                <View pointerEvents={source ? "none" : undefined}>
                    <FastImage style={[styles.cover, discovery && styles.discoveryCover, favorites && styles.favoriteCover]} source={resolveArtwork(musicItem) ?? musicItem.artwork} placeholderSource={ImgAsset.albumDefault} />
                </View>
            ) : null}
            <View style={[styles.content, source && styles.sourceContent]} pointerEvents={source ? "box-none" : undefined}>
                <View style={[styles.titleLine, favorites && styles.favoriteHeading]} pointerEvents={source ? "box-none" : undefined}>
                    <ThemeText pointerEvents={source ? "none" : undefined} style={[styles.title, favorites && styles.favoriteTitle]} fontColor={active ? "primary" : "text"} fontSize={titleSize} numberOfLines={1}>
                        {titleParts.map((part, partIndex) => (
                            <ThemeText key={partIndex} fontSize={titleSize} fontColor={active || part.highlight ? "primary" : "text"}>
                                {part.text}
                            </ThemeText>
                        ))}
                    </ThemeText>
                    {favorites && plays > 0 ? (
                        <View testID="music-play-count" pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.playCount, { backgroundColor: colors.tonalSurface }]}>
                            <Icon name="play" size={rpx(20)} color={colors.onTonal} />
                            <ThemeText fontSize="description" color={colors.onTonal} style={styles.playCountText}>{plays > 99 ? "99+" : String(plays)}</ThemeText>
                        </View>
                    ) : null}
                    {canChooseSource ? <View pointerEvents="none" style={styles.sourceSpace} onLayout={event => setSourceAnchor(event.nativeEvent.layout.x)} /> : null}
                </View>
                <View pointerEvents={source ? "none" : undefined} style={[styles.metadata, compact && styles.compactMetadata]}>
                    {source ? <>
                        {source.playing ? <Icon name="speaker-wave" size={rpx(24)} color={colors.primaryText} style={styles.metadataIcon} /> : null}
                        <ThemeText numberOfLines={1} fontSize="description" fontColor={source.playing ? "primary" : "textSecondary"}
                            accessibilityLabel={t(source.playing ? "aggregate.playingSource" : "aggregate.currentSource", { name: source.name })} style={styles.sourceName}>{source.name}</ThemeText>
                        <ThemeText fontSize="description" fontColor="textSecondary" style={styles.metadataSeparator}> · </ThemeText>
                    </> : null}
                    <ThemeText numberOfLines={1} fontSize={compact && !discovery ? "tag" : "description"} fontColor="textSecondary" style={styles.artist}>
                        {favorites ? artist : musicItem.artist}{showAlbum && !discovery ? ` · ${album}` : ""}
                    </ThemeText>
                    {favoriteSourceName ? (
                        <ThemeText numberOfLines={1} fontSize="description" fontColor="textSecondary" style={styles.favoriteSourceName}>{artist ? ` | ${favoriteSourceName}` : favoriteSourceName}</ThemeText>
                    ) : null}
                    {!discovery && !source && isLocal ? <Icon name="check-circle-outline" size={rpx(24)} color={colors.primaryText} style={styles.metadataIcon} /> : null}
                    {!discovery && !source && qualityBadge ? <Badge type={qualityBadge.type}>{qualityBadge.text}</Badge> : null}
                    {!discovery && !source && musicItem.fee === 1 ? <Badge type="vip">VIP</Badge> : null}
                    {!discovery && !source && hasMv ? <Badge type="source">MV</Badge> : null}
                    {titleTagSubText ? <ThemeText fontSize="description" fontColor="textSecondary" style={styles.duration}>{titleTagSubText}</ThemeText> : null}
                </View>
                {canChooseSource && sourceAnchor !== null ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={t("aggregate.chooseSource", { count: source.count })}
                        accessibilityHint={t(source.playing ? "aggregate.playingSource" : "aggregate.currentSource", { name: source.name })}
                        onPress={source.onPress} style={[styles.sourceTarget, { left: sourceAnchor }]}>
                        {({ pressed }) => <View pointerEvents="none" style={[styles.sourceCount, { backgroundColor: colors.tonalSurface }]}>
                            {pressed ? <Icon name="arrows-left-right" size={rpx(24)} color={colors.onTonal} />
                                : <ThemeText fontSize="tag" color={colors.onTonal}>{source.count}</ThemeText>}
                        </View>}
                    </Pressable>
                ) : null}
            </View>
        </>
    );

    return (
        <View style={[styles.row, compact && styles.compactRow, discovery && styles.discoveryRow, favorites && styles.favoriteRow, containerStyle, itemPaddingRight !== undefined && { paddingRight: itemPaddingRight }, itemPaddingLeft !== undefined && { paddingLeft: itemPaddingLeft }]}>
            {source ? (
                <View style={mainStyle}>
                    {/* Sibling responders keep source selection out of the playback button. */}
                    <Pressable {...playProps}
                        style={({ pressed }) => [StyleSheet.absoluteFill, pressed && { backgroundColor: colors.listActive }]} />
                    {content}
                </View>
            ) : (
                <Pressable {...playProps} style={({ pressed }) => [...mainStyle, pressed && { backgroundColor: colors.listActive }]}>{content}</Pressable>
            )}
            <View style={styles.actions}>
                {actions.map(action => action === "favorite" ? (
                    <FavoriteAction key={action} musicItem={musicItem} />
                ) : (
                    <RowAction
                        key={action}
                        icon={action === "addNext" ? "motion-play" : "ellipsis-vertical"}
                        label={t(action === "addNext" ? "musicListEditor.addToNextPlay" : "musicDetail.a11y.more")}
                        onPress={() => {
                            if (action === "addNext") {
                                TrackPlayer.addNext(musicItem);
                                Toast.success(t("toast.addToNextPlay"));
                            } else {
                                showPanel("MusicItemOptions", { musicItem, musicSheet });
                            }
                        }}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", minHeight: MUSIC_ITEM_HEIGHT, paddingLeft: spacing.xxl, paddingRight: spacing.xs },
    main: { flex: 1, minWidth: 0, minHeight: MUSIC_ITEM_HEIGHT, flexDirection: "row", alignItems: "center", paddingVertical: spacing.lg },
    content: { flex: 1, minWidth: 0 },
    favoriteHeading: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    favoriteTitle: { flexShrink: 1, minWidth: 0 },
    playCount: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: spacing.xxs, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, borderRadius: radius.xs },
    playCountText: { fontVariant: ["tabular-nums"] },
    favoriteSourceName: { flexShrink: 1, minWidth: 0, maxWidth: "40%" },
    sourceMain: { paddingVertical: 0 },
    sourceContent: { minHeight: 44 },
    titleLine: { flexDirection: "row", alignItems: "center" },
    title: { flexShrink: 1, minWidth: 0 },
    sourceSpace: { width: 44, height: 0, flexShrink: 0 },
    sourceTarget: { position: "absolute", top: 0, width: 44, height: 44, alignItems: "flex-start", paddingLeft: spacing.sm, paddingTop: spacing.xxs },
    sourceCount: { minWidth: rpx(34), minHeight: rpx(34), paddingHorizontal: spacing.xxs, borderRadius: spacing.xs, alignItems: "center", justifyContent: "center" },
    sourceName: { maxWidth: "42%", flexShrink: 0 },
    metadataSeparator: { flexShrink: 0 },
    metadata: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
    artist: { flexShrink: 1, minWidth: 0, marginRight: spacing.xs },
    index: { width: rpx(64), textAlign: "center", marginRight: spacing.sm },
    selectionIndex: { width: "auto", minWidth: rpx(40), marginRight: spacing.xs },
    cover: { width: rpx(80), height: rpx(80), borderRadius: spacing.sm, marginRight: spacing.xl },
    metadataIcon: { marginRight: spacing.xs },
    duration: { flexShrink: 0 },
    actions: { flexDirection: "row", alignItems: "center", flexShrink: 0, marginLeft: spacing.xs },
    action: { width: 44, minHeight: 48, justifyContent: "center", alignItems: "center" },
    muted: { opacity: 0.4 },
    compactRow: { minHeight: Math.max(44, rpx(96)), paddingLeft: 0, paddingRight: 0 },
    compactMain: { minHeight: Math.max(44, rpx(96)), paddingVertical: spacing.sm },
    compactIndex: { width: rpx(32), marginRight: spacing.xs },
    compactMetadata: { marginTop: spacing.xxs },
    discoveryRow: { minHeight: Math.max(44, rpx(116)), paddingLeft: 0, paddingRight: 0 },
    discoveryMain: { minHeight: Math.max(44, rpx(116)), paddingVertical: spacing.xs },
    discoveryCover: { width: rpx(100), height: rpx(100), marginRight: spacing.lg },
    favoriteRow: { minHeight: Math.max(44, rpx(128)) },
    favoriteMain: { minHeight: Math.max(44, rpx(128)) },
    favoriteCover: { width: rpx(104), height: rpx(104) },
});
