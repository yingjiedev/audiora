import { useSyncExternalStore } from "react";
import Config from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import Toast from "@/utils/toast";
import { createSubscriptionUpdateStore, SubscriptionUpdate } from "../utils/subscriptionUpdateStore";
import { parseSubscriptions, Subscription } from "../utils/subscriptions";

const storage = getOrCreateMMKV("plugin-subscription-updates");
export const subscriptionUpdates = createSubscriptionUpdateStore({
    read() {
        try {
            const parsed = JSON.parse(storage.getString("history") ?? "{}");
            if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
                return {};
            }
            return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, SubscriptionUpdate] => {
                const [url, value] = entry as [string, SubscriptionUpdate];
                return /^https?:\/\//i.test(url) && !!value && ["finished", "cancelled", "timedOut"].includes(value.phase)
                    && Number.isFinite(value.finishedAt) && (value.total === undefined || Number.isFinite(value.total))
                    && Array.isArray(value.results) && value.results.every(result => result && typeof result.success === "boolean"
                        && (result.pluginUrl === undefined || typeof result.pluginUrl === "string")
                        && (result.pluginName === undefined || typeof result.pluginName === "string")
                        && (result.status === undefined || ["installed", "updated", "unchanged"].includes(result.status))
                        && (result.message === undefined || typeof result.message === "string"));
            }).slice(0, 50));
        } catch {
            return {};
        }
    },
    save(history) {
        storage.set("history", JSON.stringify(history));
    },
});

export default function useUpdateSubscriptions() {
    const state = useSyncExternalStore(subscriptionUpdates.subscribe, subscriptionUpdates.getSnapshot, subscriptionUpdates.getSnapshot);
    const { t } = useI18N();
    function updateSubscriptions(items?: Subscription[], retryOnly = false) {
        try {
            const selected = items ?? parseSubscriptions(Config.getConfig("plugin.subscribeUrl"));
            if (!selected.length) {
                Toast.warn(t("toast.noSubscription"));
                return Promise.resolve();
            }
            return subscriptionUpdates.start(selected, retryOnly);
        } catch {
            Toast.warn(t("toast.subscriptionInvalid"));
            return Promise.resolve();
        }
    }
    return { ...state, updating: state.running, updateSubscriptions, cancelUpdate: subscriptionUpdates.cancel };
}
