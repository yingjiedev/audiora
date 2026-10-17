import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Config, { useAppConfig } from "@/core/appConfig";
import { FlatList } from "react-native-gesture-handler";
import Empty from "@/components/base/empty";
import { PageAction, PageSummary } from "@/components/base/pageSection";
import SettingRow from "../../../components/settingRow";
import { radius, spacing } from "@/constants/designSystem";
import useColors from "@/hooks/useColors";

import Toast from "@/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import { showDialog } from "@/components/dialogs/useDialog";
import AppBar from "@/components/base/appBar";
import Loading from "@/components/base/loading";
import useUpdateSubscriptions from "../hooks/useUpdateSubscriptions";

import { useI18N } from "@/core/i18n";

interface ISubscribeItem {
    name: string;
    url: string;
}


export default function PluginSubscribe() {
    const urls = useAppConfig("plugin.subscribeUrl") ?? "";
    const [subscribes, setSubscribes] = useState<Array<ISubscribeItem>>([]);

    const { t } = useI18N();
    const colors = useColors();
    const { updating, updateSubscriptions } = useUpdateSubscriptions();

    useEffect(() => {
        try {
            const parsed = JSON.parse(urls);
            if (Array.isArray(parsed)) {
                setSubscribes(parsed);
            } else {
                throw new Error();
            }
        } catch {
            if (urls.length) {
                setSubscribes([
                    {
                        name: t("common.default"),
                        url: urls,
                    },
                ]);
            } else {
                setSubscribes([]);
            }
        }
    }, [urls, t]);

    const onSubmit = (
        subscribeItem: ISubscribeItem,
        hideDialog: () => void,
        editingIndex?: number,
    ) => {
        if (
            subscribeItem.url.endsWith(".js") ||
            subscribeItem.url.endsWith(".json")
        ) {
            if (editingIndex !== undefined) {
                Config.setConfig(
                    "plugin.subscribeUrl",
                    JSON.stringify([
                        ...subscribes.slice(0, editingIndex),
                        subscribeItem,
                        ...subscribes.slice(editingIndex + 1),
                    ]),
                );
            } else {
                Config.setConfig(
                    "plugin.subscribeUrl",
                    JSON.stringify([...subscribes, subscribeItem]),
                );
            }
            hideDialog();
        } else {
            Toast.warn(t("toast.subscriptionHaveToEndWithJs"));
        }
    };

    const addSubscription = () => showDialog("SubscribePluginDialog", { onSubmit });
    return <>
        <AppBar>{t("pluginSetting.menu.subscriptionSetting")}</AppBar>
        <PageSummary title={t("subpage.subscribeCount", { count: subscribes.length })} description={t("subpage.subscriptionHint")}
            action={<PageAction title={t("subpage.addSubscription")} icon="plus" disabled={updating} onPress={addSubscription} />} />
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            <View style={style.actions}>
                <PageAction title={t("pluginSetting.fabOptions.updateSubscription")} icon="arrow-path"
                    disabled={updating || !subscribes.length} onPress={updateSubscriptions} />
            </View>
            {updating ? <Loading /> : <FlatList contentContainerStyle={style.content} ListEmptyComponent={Empty} data={subscribes}
                keyExtractor={(_item, index) => String(index)} renderItem={({ item, index }) => <SettingRow
                    title={item.name} description={item.url} descriptionLines={2} style={[style.row, { backgroundColor: colors.card }]}
                    right={<PageAction title={t("subpage.copy")} onPress={() => {
                        Clipboard.setString(item.url); Toast.success(t("toast.copiedToClipboard"));
                    }} />}
                    onPress={() => showDialog("SubscribePluginDialog", { subscribeItem: item, onSubmit, editingIndex: index,
                        onDelete(editingIndex, hideDialog) {
                            Config.setConfig("plugin.subscribeUrl", JSON.stringify([...subscribes.slice(0, editingIndex), ...subscribes.slice(editingIndex + 1)])); hideDialog(); Toast.success(t("toast.deleteSuccess"));
                        },
                    })} />} />}
        </HorizontalSafeAreaView>
    </>;
}
const style = StyleSheet.create({
    actions: { paddingHorizontal: spacing.xxxl, paddingBottom: spacing.md, flexDirection: "row", flexWrap: "wrap" },
    content: { paddingHorizontal: spacing.xxxl, paddingBottom: spacing.xxxl },
    row: { borderRadius: radius.lg, marginBottom: spacing.xs },
});
