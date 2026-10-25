import useContentDimensions from "@/hooks/useContentDimensions";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import AppBar from "@/components/base/appBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView";
import SortableFlatList from "@/components/base/SortableFlatList";
import ThemeText from "@/components/base/themeText";
import { PageAction, PageState, PageSummary } from "@/components/base/pageSection";
import { radius, spacing } from "@/constants/designSystem";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import PluginManager, { usePluginDisplayNameResolver, useSortedPlugins } from "@/core/pluginManager";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
export default function PluginSort() {
    const plugins = useSortedPlugins();
    const [sortingPlugins, setSortingPlugins] = useState([...plugins]);
    const getDisplayName = usePluginDisplayNameResolver();
    const colors = useColors();
    const { t } = useI18N();
    const { fontScale } = useContentDimensions();
    const itemHeight = Math.max(52, rpx(128) * fontScale);
    return <>
        <AppBar actionComponent={<PageAction title={t("common.done")} variant="primary" disabled={!sortingPlugins.length} onPress={() => {
            PluginManager.setPluginOrder(sortingPlugins); Toast.success(t("toast.saveSuccess"));
        }} />}>{t("pluginSetting.menu.sort")}</AppBar>
        <PageSummary title={t("subpage.pluginCount", { count: sortingPlugins.length })} description={t("subpage.sortHint")} />
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            {sortingPlugins.length ? <SortableFlatList data={sortingPlugins} activeBackgroundColor={colors.tonalSurface} itemHeight={itemHeight}
                itemJustifyContent="space-between" onSortEnd={setSortingPlugins}
                renderItem={({ item }) => <View style={[styles.row, { minHeight: itemHeight, backgroundColor: colors.card }]}><ThemeText numberOfLines={2} fontWeight="medium">{getDisplayName(item)}</ThemeText></View>} /> : <PageState title={t("common.emptyList")} />}
        </HorizontalSafeAreaView>
    </>;
}
const styles = StyleSheet.create({ row: { flex: 1, minWidth: 0, marginLeft: spacing.xxxl, marginRight: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.lg, justifyContent: "center" } });
