import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import FastImage from "@/components/base/fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import { openPlayer } from "@/core/playerOverlay";
import TrackPlayer, { useCurrentMusic, useMusicState } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import SeekBar from "@/pages/musicDetail/components/bottom/seekBar";
import { resolveArtwork } from "@/utils/artwork";
import { useMediaExtraProperty } from "@/utils/mediaExtra";
import { musicIsPaused } from "@/utils/trackUtils";
import { showPanel } from "@/components/panels/usePanel";
import { PlaybackPaneTab, playbackPaneTabStore } from "@/core/homeNavigation";

export function PlaybackAction(props: { icon: IIconName; label: string; color: string; onPress: () => void; selected?: boolean }) {
    return <Pressable accessibilityRole="button" accessibilityLabel={props.label} accessibilityState={{ selected: props.selected }} onPress={props.onPress} style={styles.action}>
        <Icon name={props.icon} size={24} color={props.color} />
    </Pressable>;
}

export default function PlayerBar(props: { expanded: boolean; bottom: number; left?: number; right?: number; canShowPane: boolean; paneOpen: boolean; onSelectPane: (tab: PlaybackPaneTab) => void }) {
    const song = useCurrentMusic();
    const state = useMusicState();
    const favorite = useFavorite(song);
    const colors = useColors();
    const { t } = useI18N();
    const paneTab = playbackPaneTabStore.useValue();
    useMediaExtraProperty(song, "associatedArtwork");
    if (!song) return null;
    const paused = musicIsPaused(state);
    const action = (icon: IIconName, label: string, onPress: () => void, selected?: boolean) => <PlaybackAction icon={icon} label={label} onPress={onPress} selected={selected} color={colors.playerText} />;
    return (
        <View testID="tablet-player-bar" style={[styles.bar, { minHeight: 72 + props.bottom, paddingBottom: props.bottom, paddingLeft: 12 + (props.left ?? 0), paddingRight: 12 + (props.right ?? 0), backgroundColor: colors.playerSurface }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("musicBar.a11y.openDetail")} onPress={() => openPlayer()} style={styles.info}>
                <FastImage source={resolveArtwork(song)} placeholderSource={ImgAsset.albumDefault} style={styles.cover} />
                <View style={styles.text}>
                    <ThemeText numberOfLines={1} color={colors.playerText}>{song.title}</ThemeText>
                    <ThemeText numberOfLines={1} fontSize="description" color={colors.playerTextSecondary}>{song.artist}</ThemeText>
                </View>
            </Pressable>
            <PlaybackAction icon={favorite ? "heart" : "heart-outline"} label={t(favorite ? "musicDetail.a11y.unfavorite" : "musicDetail.a11y.favorite")} color={favorite ? colors.favorite : colors.playerText}
                selected={favorite} onPress={() => favorite ? MusicSheet.removeMusic(MusicSheet.defaultSheet.id, song) : MusicSheet.addMusic(MusicSheet.defaultSheet.id, song)} />
            {action("skip-left", t("musicDetail.a11y.skipToPrevious"), () => TrackPlayer.skipToPrevious())}
            {action(paused ? "play" : "pause", t(paused ? "musicDetail.a11y.play" : "musicDetail.a11y.pause"), () => paused ? TrackPlayer.play() : TrackPlayer.pause())}
            {action("skip-right", t("musicDetail.a11y.skipToNext"), () => TrackPlayer.skipToNext())}
            {props.expanded ? <View style={styles.seek}><SeekBar variant="surface" /></View> : null}
            {action("playlist", t("musicBar.a11y.playlist"), () => {
                if (props.canShowPane) {
                    props.onSelectPane("queue");
                } else showPanel("PlayList");
            }, props.paneOpen && paneTab === "queue")}
            {props.canShowPane ? action("lyric", t("adaptive.lyric"), () => props.onSelectPane("lyric"), props.paneOpen && paneTab === "lyric") : null}
            {action("chevron-right", t("musicBar.a11y.openDetail"), () => openPlayer())}
        </View>
    );
}

const styles = StyleSheet.create({
    bar: { minHeight: 72, paddingHorizontal: 12, paddingTop: 8, flexDirection: "row", alignItems: "center" },
    info: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
    cover: { width: 48, height: 48, borderRadius: 8 },
    text: { flex: 1, minWidth: 0 },
    action: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
    seek: { flex: 1, maxWidth: 400, paddingHorizontal: 16 },
});
