import { controlSize, radius, spacing } from "@/constants/designSystem";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import rpx, { fontRpx } from "@/utils/rpx";
import Loading from "@/components/base/loading";
import Icon, { IIconName } from "@/components/base/icon";
import { PageAction } from "@/components/base/pageSection";
import { showDialog } from "@/components/dialogs/useDialog";
import useSearch from "../hooks/useSearch";
import { addHistory, getHistory, removeAllHistory, removeHistory } from "../common/historySearch";
import { buildSearchDiscovery, getDiscoveryBatch } from "../common/searchDiscovery";
import { useSetAtom } from "jotai";
import { PageStatus, initSearchResults, pageStatusAtom, queryAtom, searchResultsAtom } from "../store/atoms";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import { useMusicHistory } from "@/core/musicHistory";
import MusicSheet, { useSheetItem } from "@/core/musicSheet";
import useDiscoveryCharts from "../hooks/useDiscoveryCharts";

function SectionIcon({ name, label, onPress, disabled = false }: { name: IIconName; label: string; onPress: () => void; disabled?: boolean }) {
    const colors = useColors();
    return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
        onPress={onPress} style={({ pressed }) => [styles.iconTarget, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
        <Icon name={name} size={fontRpx(32)} color={colors.textSecondary} />
    </Pressable>;
}

export default function HistoryPanel() {
    const [history, setHistory] = useState<string[] | null>(null);
    const [historyError, setHistoryError] = useState(false);
    const [editing, setEditing] = useState(false);
    const [updating, setUpdating] = useState(false);
    const pending = useRef(false);
    const [batch, setBatch] = useState(0);
    const recentMusic = useMusicHistory();
    const favoriteSheet = useSheetItem(MusicSheet.defaultSheet.id);
    const chartMusic = useDiscoveryCharts();
    const colors = useColors();
    const { width, fontScale } = useWindowDimensions();
    const oneColumn = width < 360 || fontScale > 1.3;
    const search = useSearch();
    const setQuery = useSetAtom(queryAtom);
    const setPageStatus = useSetAtom(pageStatusAtom);
    const setSearchResultsState = useSetAtom(searchResultsAtom);
    const { t } = useI18N();

    const discovery = useMemo(() => buildSearchDiscovery(recentMusic, favoriteSheet.musicList ?? [], history ?? [], chartMusic), [recentMusic, favoriteSheet.musicList, history, chartMusic]);
    const suggestions = useMemo(() => getDiscoveryBatch(discovery, batch), [discovery, batch]);

    useEffect(() => {
        let active = true;
        getHistory().then(items => {
            if (active) setHistory(items);
        }).catch(() => {
            if (active) setHistoryError(true);
        });
        return () => {
            active = false;
        };
    }, []);

    const submit = (keyword: string) => {
        Keyboard.dismiss();
        setSearchResultsState(initSearchResults);
        setQuery(keyword);
        setPageStatus(PageStatus.SEARCHING);
        search(keyword, 1);
        // A history write failure must not prevent searching.
        addHistory(keyword).catch(() => {});
    };

    const updateHistory = async (query?: string) => {
        if (pending.current) return;
        pending.current = true;
        setUpdating(true);
        setHistoryError(false);
        try {
            if (query === undefined) {
                await removeAllHistory();
                setHistory([]);
                setEditing(false);
            } else {
                await removeHistory(query);
                const remaining = (history ?? []).filter(item => item !== query);
                setHistory(remaining);
                if (!remaining.length) setEditing(false);
            }
        } catch {
            setHistoryError(true);
        } finally {
            pending.current = false;
            setUpdating(false);
        }
    };

    const retryHistory = async () => {
        try {
            setHistory(await getHistory());
            setHistoryError(false);
        } catch {
            setHistoryError(true);
        }
    };

    return <ScrollView style={styles.wrapper} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.section}>
            <View style={styles.header}>
                <ThemeText fontSize="title" fontWeight="semibold" allowFontScaling style={styles.heading}>{t("searchPage.history")}</ThemeText>
                {history?.length ? <View style={styles.actions}>
                    {editing ? <>
                        <PageAction title={t("common.clear")} variant="text" textColor={colors.textSecondary} disabled={updating} onPress={() => showDialog("SimpleDialog", {
                            title: t("searchPage.clearHistory"),
                            content: t("searchPage.clearHistoryConfirm"),
                            onOk: () => updateHistory(),
                        })} />
                        <PageAction title={t("common.done")} variant="text" disabled={updating} onPress={() => setEditing(false)} />
                    </> : <SectionIcon name="trash-outline" label={t("searchPage.manageHistory")} onPress={() => setEditing(true)} />}
                </View> : null}
            </View>
            {historyError ? <View style={styles.error}>
                <ThemeText fontSize="description" fontColor="textSecondary" allowFontScaling style={styles.errorText}>{t("searchPage.historyError")}</ThemeText>
                {history === null ? <PageAction title={t("searchPage.retryHistory")} variant="text" onPress={retryHistory} /> : null}
            </View> : history === null ? <View style={styles.loading}><Loading /></View> : null}
            {history?.length ? <View style={styles.historyTags}>
                {history.map(query => <Pressable key={query} accessibilityRole="button" accessibilityLabel={editing ? t("searchPage.removeHistory", { query }) : query}
                    accessibilityHint={editing ? undefined : t("searchPage.historyHint")} accessibilityState={{ disabled: updating }} disabled={updating}
                    onLongPress={() => setEditing(true)} onPress={() => editing ? updateHistory(query) : submit(query)}
                    style={({ pressed }) => [styles.historyTarget, { opacity: pressed ? 0.7 : 1 }]}>
                    <View pointerEvents="none" style={[styles.historyChip, { backgroundColor: colors.card }]}>
                        <ThemeText fontSize="subTitle" allowFontScaling numberOfLines={1} style={styles.historyText}>{query}</ThemeText>
                        {editing ? <Icon name="x-mark" size={fontRpx(24)} color={colors.textSecondary} /> : null}
                    </View>
                </Pressable>)}
            </View> : history !== null ? <ThemeText fontSize="description" fontColor="textSecondary" allowFontScaling style={styles.hint}>{t("searchPage.historyEmpty")}</ThemeText> : null}
        </View>
        <View style={styles.section}>
            <View style={styles.header}>
                <ThemeText fontSize="title" fontWeight="semibold" allowFontScaling style={styles.heading}>{t("searchPage.discovery")}</ThemeText>
                {discovery.length > 8 ? <SectionIcon name="arrow-path" label={t("searchPage.refreshDiscovery")} onPress={() => setBatch(current => current + 1)} /> : null}
            </View>
            {suggestions.length ? <View style={styles.discoveryGrid}>
                {suggestions.map(item => <Pressable key={item.query} accessibilityRole="button"
                    accessibilityLabel={`${item.query}，${t(`searchPage.discovery.${item.source}`)}`} onPress={() => submit(item.query)}
                    style={({ pressed }) => [styles.discoveryTarget, oneColumn && styles.singleColumn, { opacity: pressed ? 0.7 : 1 }]}>
                    <View style={styles.discoveryLine}>
                        <ThemeText fontSize="subTitle" allowFontScaling numberOfLines={1} style={styles.discoveryText}>{item.query}</ThemeText>
                        <ThemeText fontSize="description" fontColor="textSecondary" allowFontScaling numberOfLines={1} style={styles.discoverySource}>{t(`searchPage.discovery.${item.source}`)}</ThemeText>
                    </View>
                </Pressable>)}
            </View> : <ThemeText fontSize="description" fontColor="textSecondary" allowFontScaling style={styles.hint}>{t("searchPage.discoveryEmpty")}</ThemeText>}
        </View>
    </ScrollView>;
}

const minimumTouch = Math.max(44, controlSize.minimumTouch);
const styles = StyleSheet.create({
    wrapper: { flex: 1, width: "100%" },
    content: { paddingHorizontal: spacing.xxxl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xxl },
    section: { width: "100%" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: minimumTouch, gap: spacing.md },
    heading: { flexShrink: 1 },
    actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    iconTarget: { minWidth: minimumTouch, minHeight: minimumTouch, alignItems: "center", justifyContent: "center" },
    historyTags: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.sm },
    historyTarget: { minWidth: minimumTouch, minHeight: minimumTouch, maxWidth: "100%", justifyContent: "center" },
    historyChip: { minHeight: rpx(56), paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: spacing.xs },
    historyText: { flexShrink: 1 },
    hint: { paddingVertical: spacing.sm, lineHeight: fontRpx(34) },
    loading: { height: minimumTouch },
    error: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    errorText: { flex: 1 },
    discoveryGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: "4%" },
    discoveryTarget: { width: "48%", minWidth: 0, minHeight: minimumTouch, justifyContent: "center", paddingVertical: spacing.sm },
    singleColumn: { width: "100%" },
    discoveryLine: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs },
    discoveryText: { flexShrink: 1, minWidth: 0 },
    discoverySource: { flexShrink: 1, maxWidth: "48%" },
});
