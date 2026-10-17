import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { spacing } from "@/constants/designSystem";
import repeatModeConst from "@/constants/repeatModeConst";
import { useI18N } from "@/core/i18n";
import TrackPlayer, { useRepeatMode } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";

export type PlaybackTab = "queue" | "history" | "sheets";

interface IHeaderProps {
    tab: PlaybackTab;
    counts: Record<PlaybackTab, number>;
    onSelectTab: (tab: PlaybackTab) => void;
    onDownload: () => void;
    onAdd: () => void;
    onClear: () => void;
}

export function QueueAction(props: { icon: IIconName; label: string; onPress: () => void; disabled?: boolean }) {
    const colors = useColors();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.label}
            accessibilityState={{ disabled: !!props.disabled }}
            disabled={props.disabled}
            onPress={props.onPress}
            style={({ pressed }) => [styles.action, (pressed || props.disabled) && styles.muted]}>
            <Icon name={props.icon} size={rpx(40)} color={colors.textSecondary ?? colors.text} />
        </Pressable>
    );
}

export default function Header(props: IHeaderProps) {
    const { tab, counts, onSelectTab, onDownload, onAdd, onClear } = props;
    const repeatMode = useRepeatMode();
    const colors = useColors();
    const { t } = useI18N();
    const tabs: PlaybackTab[] = ["queue", "history", "sheets"];
    const empty = counts[tab] === 0;

    return (
        <View style={styles.header}>
            <View accessibilityRole="tablist" style={styles.tabs}>
                {tabs.map(name => (
                    <Pressable
                        key={name}
                        testID={`playback-tab-${name}`}
                        accessibilityRole="tab"
                        accessibilityLabel={t(`panel.playList.tab.${name}`)}
                        accessibilityState={{ selected: tab === name }}
                        onPress={() => onSelectTab(name)}
                        style={styles.tab}>
                        <View style={styles.tabLabel}>
                            <ThemeText fontSize="title" color={tab === name ? colors.text : colors.textSecondary}>
                                {t(`panel.playList.tab.${name}`)}
                            </ThemeText>
                            <ThemeText fontSize="description" color={tab === name ? colors.text : colors.textSecondary} style={styles.count}>
                                {counts[name] > 999 ? "999+" : counts[name]}
                            </ThemeText>
                        </View>
                        {tab === name ? <View style={[styles.underline, { backgroundColor: colors.text }]} /> : null}
                    </Pressable>
                ))}
            </View>
            <View style={styles.toolbar}>
                {tab === "queue" ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={t(("repeatMode." + repeatMode) as any)} onPress={() => TrackPlayer.toggleRepeatMode()} style={styles.mode}>
                        <Icon name={repeatModeConst[repeatMode].icon} size={rpx(38)} color={colors.textSecondary ?? colors.text} />
                        <ThemeText fontSize="content" fontColor="textSecondary" style={styles.modeText}>
                            {t(("repeatMode." + repeatMode) as any)}
                        </ThemeText>
                    </Pressable>
                ) : (
                    <ThemeText fontSize="content" fontColor="textSecondary" style={styles.mode}>
                        {t("panel.playList.recentFirst")}
                    </ThemeText>
                )}
                {tab !== "sheets" ? (
                    <>
                        <QueueAction icon="arrow-down-tray" label={t("common.download")} onPress={onDownload} disabled={empty} />
                        <QueueAction icon="plus" label={t("panel.playList.addAll")} onPress={onAdd} disabled={empty} />
                    </>
                ) : null}
                <QueueAction icon="trash-outline" label={t("common.clear")} onPress={onClear} disabled={empty} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: spacing.xxxl, paddingTop: spacing.xxxl },
    tabs: { flexDirection: "row", justifyContent: "space-between" },
    tab: { minHeight: 48, justifyContent: "center", paddingBottom: spacing.md },
    tabLabel: { flexDirection: "row", alignItems: "center" },
    count: { marginLeft: spacing.xs },
    underline: { position: "absolute", bottom: spacing.xs, left: 0, right: 0, height: 2, borderRadius: 1 },
    toolbar: { flexDirection: "row", alignItems: "center", minHeight: 48, marginTop: spacing.sm },
    mode: { flex: 1, flexDirection: "row", alignItems: "center", minHeight: 48, justifyContent: "flex-start" },
    modeText: { marginLeft: spacing.sm },
    action: { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
    muted: { opacity: 0.35 },
});
