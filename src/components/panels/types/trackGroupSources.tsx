import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import { PageAction } from "@/components/base/pageSection";
import { radius, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";
import { useCurrentMusic } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import timeformat from "@/utils/timeformat";
import Toast from "@/utils/toast";
import { TrackGroup, trackSourceKey } from "@/utils/trackGroup";
import type { FavoriteGroupActions } from "@/components/musicList/groupedMusicList";
import PanelBase from "../base/panelBase";
import { hidePanel } from "../usePanel";

interface TrackGroupSourcesProps {
    group: TrackGroup;
    selected: IMusic.IMusicItem;
    onSelect: (key: string) => void;
    favoriteActions?: FavoriteGroupActions;
}

/** Source selection never starts playback or interrupts the current source. */
export default function TrackGroupSources({ group, selected, onSelect, favoriteActions }: TrackGroupSourcesProps) {
    const { t } = useI18N();
    const colors = useColors();
    const getDisplayName = usePluginDisplayNameResolver();
    const current = useCurrentMusic();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const selectedKey = trackSourceKey(selected);
    const pending = useRef(false);
    const [busy, setBusy] = useState(false);
    const closeAndRun = (action: () => void) => {
        if (pending.current) return;
        pending.current = true;
        hidePanel();
        action();
    };
    return (
        <PanelBase borderTopRadius={radius.sheet}
            height={Math.min(height * 0.75, rpx(300 + Math.min(group.candidates.length, 5) * 120 + (favoriteActions ? 240 : 0)) + insets.bottom)}
            renderBody={() => <>
                <View style={styles.header}>
                    <ThemeText allowFontScaling fontSize="title" fontWeight="semibold" style={styles.heading}>{t("aggregate.sourcePickerTitle")}</ThemeText>
                    <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} onPress={hidePanel} style={styles.close}>
                        <Icon name="x-mark" size={rpx(40)} color={colors.textSecondary} />
                    </Pressable>
                </View>
                <ScrollView style={styles.body} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
                    <ThemeText allowFontScaling numberOfLines={1} fontWeight="medium">{selected.title}</ThemeText>
                    <ThemeText allowFontScaling numberOfLines={1} fontSize="description" fontColor="textSecondary">{selected.artist}</ThemeText>
                    <View accessibilityRole="radiogroup" style={styles.choices}>
                        {group.candidates.map(candidate => {
                            const key = trackSourceKey(candidate);
                            const checked = key === selectedKey;
                            const playing = !!current && trackSourceKey(current) === key;
                            const name = getDisplayName(candidate.platform);
                            const detail = [candidate.album, Number.isFinite(candidate.duration) && candidate.duration > 0 ? timeformat(candidate.duration) : undefined].filter(Boolean).join(" · ");
                            return <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked, disabled: busy }} disabled={busy}
                                accessibilityLabel={[name, detail, checked ? t("aggregate.sourceSelected") : undefined, playing ? t("aggregate.sourcePlaying") : undefined].filter(Boolean).join(" · ")}
                                onPress={() => closeAndRun(() => onSelect(key))}
                                style={({ pressed }) => [styles.choice, { borderBottomColor: colors.divider, backgroundColor: pressed ? colors.listActive : colors.backdrop }]}>
                                <View style={styles.candidate}>
                                    <View style={styles.nameLine}>
                                        <ThemeText allowFontScaling numberOfLines={1} color={checked ? colors.active : colors.text} style={styles.name}>{name}</ThemeText>
                                        {playing ? <View style={styles.playing}>
                                            <Icon name="speaker-wave" size={rpx(24)} color={colors.primaryText} />
                                            <ThemeText allowFontScaling fontSize="description" fontColor="primary">{t("aggregate.sourcePlaying")}</ThemeText>
                                        </View> : null}
                                    </View>
                                    {detail ? <ThemeText allowFontScaling numberOfLines={1} fontSize="description" fontColor="textSecondary">{detail}</ThemeText> : null}
                                </View>
                                {checked ? <Icon name="check-circle" size={rpx(40)} color={colors.active} /> : null}
                            </Pressable>;
                        })}
                    </View>
                    <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">{t("aggregate.sourceSelectionHint")}</ThemeText>
                    {favoriteActions ? <View style={styles.favoriteActions}>
                        {group.groupId ? <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">{t("aggregate.groupHeartHint")}</ThemeText> : null}
                        <PageAction allowFontScaling variant="text" disabled={busy} title={t(group.groupId ? "aggregate.splitFavorites" : "aggregate.linkFavorites")}
                            onPress={() => closeAndRun(() => group.groupId ? favoriteActions.split(group) : favoriteActions.link(group, selected))} />
                        {group.groupId ? <PageAction allowFontScaling variant="text" title={t("aggregate.removeSource")} disabled={busy} onPress={async () => {
                            if (pending.current) return;
                            pending.current = true;
                            setBusy(true);
                            try {
                                await favoriteActions.removeSource(selected);
                                hidePanel();
                            } catch {
                                Toast.warn(t("aggregate.updateFailed"));
                            } finally {
                                pending.current = false;
                                setBusy(false);
                            }
                        }} /> : null}
                    </View> : null}
                </ScrollView>
            </>}
        />
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", paddingLeft: spacing.xxl, paddingRight: spacing.sm, paddingVertical: spacing.xs },
    heading: { flex: 1 },
    close: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
    body: { flex: 1 },
    content: { paddingHorizontal: spacing.xxl, gap: spacing.xs },
    choices: { marginVertical: spacing.md },
    choice: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
    candidate: { flex: 1, minWidth: 0, gap: spacing.xs },
    nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    name: { flexShrink: 1 },
    playing: { flexDirection: "row", alignItems: "center", gap: spacing.xxs, flexShrink: 0 },
    favoriteActions: { alignItems: "flex-start", gap: spacing.xs, marginTop: spacing.md },
});
