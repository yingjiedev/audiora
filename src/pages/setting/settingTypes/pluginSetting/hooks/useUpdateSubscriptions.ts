import { useRef, useState } from "react";
import Config from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import { showDialog } from "@/components/dialogs/useDialog";
import { IInstallPluginResult } from "@/types/core/pluginManager";
import Toast from "@/utils/toast";
import installPluginFromUrl from "../utils/installPluginFromUrl";

export default function useUpdateSubscriptions() {
    const { t } = useI18N();
    const [updating, setUpdating] = useState(false);
    const inProgress = useRef(false);

    async function updateSubscriptions() {
        if (inProgress.current) {
            return;
        }
        const configuredUrls = Config.getConfig("plugin.subscribeUrl")?.trim();
        if (!configuredUrls) {
            Toast.warn(t("toast.noSubscription"));
            return;
        }

        let subscriptions: unknown;
        try {
            subscriptions = JSON.parse(configuredUrls);
        } catch {
            // Older settings store a single subscription URL without JSON.
            subscriptions = [{ url: configuredUrls }];
        }
        if (!Array.isArray(subscriptions)) {
            Toast.warn(t("toast.subscriptionInvalid"));
            return;
        }
        if (!subscriptions.length) {
            Toast.warn(t("toast.noSubscription"));
            return;
        }

        inProgress.current = true;
        setUpdating(true);
        try {
            const results: IInstallPluginResult[] = [];
            for (const subscription of subscriptions) {
                const url = typeof subscription?.url === "string" ? subscription.url.trim() : "";
                if (!url) {
                    results.push({ success: false, message: t("toast.subscriptionInvalid") });
                    continue;
                }
                const installed = await installPluginFromUrl(url);
                results.push(...(installed.length ? installed : [{
                    success: false,
                    pluginUrl: url,
                    message: t("toast.subscriptionInvalid"),
                }]));
            }
            const failures = results.filter(result => !result.success);
            if (!failures.length) {
                Toast.success(t("toast.updatePluginSuccess"));
            } else {
                Toast.warn(t(failures.length < results.length ? "toast.partialPluginUpdateFailed" : "toast.allPluginUpdateFailed"), {
                    actionText: t("common.view"),
                    onActionClick: () => showDialog("SimpleDialog", {
                        title: t("pluginSetting.menu.pluginUpdateFailedDialogTitle"),
                        content: t("pluginSetting.pluginUpdateFailedDialogContent", {
                            detail: failures.map(result => (result.pluginUrl ?? "") + "\n" + t("pluginSetting.failReason", {
                                reason: result.message ?? "",
                            })).join("\n-----\n"),
                        }),
                    }),
                });
            }
        } catch (e: any) {
            Toast.warn(t("toast.unknownError", { reason: e?.message ?? e }));
        } finally {
            inProgress.current = false;
            setUpdating(false);
        }
    }

    return { updating, updateSubscriptions };
}
