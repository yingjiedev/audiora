import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import Clipboard from "@react-native-clipboard/clipboard";
import Config, { useAppConfig } from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import AppBar from "@/components/base/appBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView";
import { PageAction, PageState, PageSummary } from "@/components/base/pageSection";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import { radius, spacing } from "@/constants/designSystem";
import globalStyle from "@/constants/globalStyle";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";
import SubscriptionStatus from "../components/subscriptionStatus";
import useUpdateSubscriptions from "../hooks/useUpdateSubscriptions";
import { parseSubscriptions, Subscription, subscriptionName } from "../utils/subscriptions";

export default function PluginSubscribe() {
    const configuredUrls = useAppConfig("plugin.subscribeUrl");
    const { t } = useI18N();
    const colors = useColors();
    const { updating, cancelling, updates, updateSubscriptions, cancelUpdate } = useUpdateSubscriptions();
    const { subscriptions, invalid } = useMemo(() => {
        try {
            return { subscriptions: parseSubscriptions(configuredUrls), invalid: false };
        } catch {
            return { subscriptions: [], invalid: true };
        }
    }, [configuredUrls]);

    function onSubmit(item: Subscription, hideDialog: () => void, editingIndex?: number) {
        const url = item.url.trim();
        if (!/^https?:\/\/\S+\.(?:js|json)(?:[?#]\S*)?$/i.test(url)) {
            Toast.warn(t("toast.subscriptionHaveToEndWithJs"));
            return;
        }
        const subscription = { name: item.name.trim(), url };
        const next = [...subscriptions];
        if (editingIndex === undefined) {
            next.push(subscription);
        } else {
            next[editingIndex] = subscription;
        }
        Config.setConfig("plugin.subscribeUrl", JSON.stringify(next));
        hideDialog();
    }

    function editSubscription(item?: Subscription, index?: number) {
        showDialog("SubscribePluginDialog", {
            subscribeItem: item,
            editingIndex: index,
            onSubmit,
            onDelete(editingIndex, hideDialog) {
                Config.setConfig("plugin.subscribeUrl", JSON.stringify(subscriptions.filter((_item, i) => i !== editingIndex)));
                hideDialog();
                Toast.success(t("toast.deleteSuccess"));
            },
        });
    }

    return (
        <>
            <AppBar>{t("pluginSetting.menu.subscriptionSetting")}</AppBar>
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                <FlatList
                    contentContainerStyle={styles.content}
                    data={subscriptions}
                    keyExtractor={(item, index) => `${index}:${item.url}`}
                    ListHeaderComponent={
                        <>
                            <PageSummary title={t("subpage.subscribeCount", { count: subscriptions.length })}
                                action={<PageAction allowFontScaling title={t("subpage.addSubscription")} icon="plus" variant="text"
                                    disabled={updating || invalid} onPress={() => editSubscription()} />} />
                            {subscriptions.length > 1 || updating ? <View style={styles.toolbar}>
                                {subscriptions.length > 1 ? <PageAction allowFontScaling title={t("subscription.updateAll")} icon="arrow-path" variant="primary"
                                    disabled={updating} onPress={() => updateSubscriptions()} /> : null}
                                {updating ? <>
                                    <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary" style={styles.taskHint}>{t("subscription.backgroundHint")}</ThemeText>
                                    <PageAction allowFontScaling title={t(cancelling ? "subscription.stopping" : "subscription.stop")} variant="text"
                                        disabled={cancelling} onPress={cancelUpdate} />
                                </> : null}
                            </View> : null}
                        </>
                    }
                    ListEmptyComponent={<PageState title={t(invalid ? "toast.subscriptionInvalid" : "toast.noSubscription")}
                        description={invalid ? undefined : t("subscription.emptyHint")} />}
                    renderItem={({ item, index }) => {
                        const update = updates[item.url];
                        const failures = update?.results.filter(result => !result.success) ?? [];
                        const active = update && ["queued", "fetching", "updating"].includes(update.phase);
                        return (
                            <View style={[styles.card, { backgroundColor: colors.card }]}>
                                <View style={styles.cardHeader}>
                                    <ThemeText allowFontScaling fontWeight="semibold" numberOfLines={2} style={styles.name}>{subscriptionName(item)}</ThemeText>
                                    <PageAction allowFontScaling title={t("subscription.edit")} icon="pencil-outline" variant="text"
                                        disabled={updating} onPress={() => editSubscription(item, index)} />
                                </View>
                                <ThemeText allowFontScaling selectable numberOfLines={2} fontSize="description" fontColor="textSecondary">{item.url}</ThemeText>
                                <View style={styles.status}><SubscriptionStatus update={update} /></View>
                                <View style={styles.cardActions}>
                                    <PageAction allowFontScaling title={t("subpage.copy")} variant="text" onPress={() => {
                                        Clipboard.setString(item.url);
                                        Toast.success(t("toast.copiedToClipboard"));
                                    }} />
                                    {!active && failures.length ? <>
                                        <PageAction allowFontScaling title={t("subscription.details")} variant="text" onPress={() => showDialog("SimpleDialog", {
                                            title: t("pluginSetting.menu.pluginUpdateFailedDialogTitle"),
                                            content: failures.map(result => `${result.pluginName ?? result.pluginUrl ?? item.url}\n${result.message ?? ""}`).join("\n-----\n"),
                                        })} />
                                        <PageAction allowFontScaling title={t("subscription.retryFailed")} variant="text" disabled={updating}
                                            onPress={() => updateSubscriptions([item], true)} />
                                    </> : null}
                                    <PageAction allowFontScaling title={t(active ? "subscription.updating" : "pluginSetting.fabOptions.updateSubscription")}
                                        icon="arrow-path" variant="primary" disabled={updating} onPress={() => updateSubscriptions([item])} />
                                </View>
                            </View>
                        );
                    }}
                />
            </HorizontalSafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    content: { paddingBottom: spacing.xxxl },
    toolbar: { paddingHorizontal: spacing.xxxl, paddingBottom: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
    taskHint: { flex: 1, minWidth: 120 },
    card: { marginHorizontal: spacing.xxxl, marginBottom: spacing.md, padding: spacing.xl, borderRadius: radius.lg },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    name: { flex: 1, minWidth: 0 },
    status: { marginTop: spacing.lg },
    cardActions: { marginTop: spacing.sm, flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "flex-end" },
});
