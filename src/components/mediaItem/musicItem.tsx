import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import rpx from "@/utils/rpx";
import { spacing } from "@/constants/designSystem";
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
    left?: React.ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
    highlight?: boolean;
    highlightText?: string;
    /** All scenes share this row; only leading content and actions vary. */
    actions?: readonly MusicItemAction[];
    showCover?: boolean;
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
    const colors = useColors();
    const { t } = useI18N();
    const pending = useRef(false);
    const [busy, setBusy] = useState(false);
    const toggle = async () => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        try {
            if (isFavorite) {
                await MusicSheet.removeMusic(MusicSheet.defaultSheet.id, musicItem);
            } else {
                await MusicSheet.addMusic(MusicSheet.defaultSheet.id, musicItem);
            }
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
            label={t(isFavorite ? "musicDetail.a11y.unfavorite" : "musicDetail.a11y.favorite")}
            color={isFavorite ? colors.danger ?? colors.primary : undefined}
            onPress={toggle}
            disabled={busy}
            selected={isFavorite}
        />
    );
}

export default function MusicItem(props: IMusicItemProps) {
    const {
        musicItem, index, titleTagSubText, onItemPress, onItemLongPress,
        musicSheet, itemPaddingRight, left, containerStyle,
        highlight, highlightText, actions = ["addNext", "more"], showCover = false,
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

    return (
        <View style={[styles.row, containerStyle, itemPaddingRight !== undefined && { paddingRight: itemPaddingRight }]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={[musicItem.title, musicItem.artist].filter(Boolean).join(" - ")}
                accessibilityState={{ selected: active }}
                onLongPress={onItemLongPress}
                onPress={() => onItemPress ? onItemPress(musicItem) : TrackPlayer.play(musicItem)}
                style={({ pressed }) => [styles.main, pressed && { backgroundColor: colors.listActive }]}>
                {left}
                {index !== undefined ? (
                    <ThemeText fontColor={active ? "primary" : "textSecondary"} style={styles.index}>
                        {index}
                    </ThemeText>
                ) : null}
                {showCover ? (
                    <FastImage style={styles.cover} source={resolveArtwork(musicItem) ?? musicItem.artwork} placeholderSource={ImgAsset.albumDefault} />
                ) : null}
                <View style={styles.content}>
                    <ThemeText fontColor={active ? "primary" : "text"} numberOfLines={1}>
                        {titleParts.map((part, partIndex) => (
                            <ThemeText key={partIndex} fontColor={active || part.highlight ? "primary" : "text"}>
                                {part.text}
                            </ThemeText>
                        ))}
                    </ThemeText>
                    <View style={styles.metadata}>
                        <ThemeText numberOfLines={1} fontSize="description" fontColor="textSecondary" style={styles.artist}>
                            {musicItem.artist}{showAlbum ? ` · ${album}` : ""}
                        </ThemeText>
                        {isLocal ? <Icon name="check-circle-outline" size={rpx(24)} color={colors.primary} style={styles.metadataIcon} /> : null}
                        {qualityBadge ? <Badge type={qualityBadge.type}>{qualityBadge.text}</Badge> : null}
                        {musicItem.fee === 1 ? <Badge type="vip">VIP</Badge> : null}
                        {hasMv ? <Badge type="source">MV</Badge> : null}
                        {titleTagSubText ? <ThemeText fontSize="description" fontColor="textSecondary" style={styles.duration}>{titleTagSubText}</ThemeText> : null}
                    </View>
                </View>
            </Pressable>
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
    metadata: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
    artist: { flexShrink: 1, minWidth: 0, marginRight: spacing.xs },
    index: { width: rpx(64), textAlign: "center", marginRight: spacing.sm },
    cover: { width: rpx(80), height: rpx(80), borderRadius: spacing.sm, marginRight: spacing.xl },
    metadataIcon: { marginRight: spacing.xs },
    duration: { flexShrink: 0 },
    actions: { flexDirection: "row", alignItems: "center", flexShrink: 0, marginLeft: spacing.xs },
    action: { width: 44, minHeight: 48, justifyContent: "center", alignItems: "center" },
    muted: { opacity: 0.4 },
});
