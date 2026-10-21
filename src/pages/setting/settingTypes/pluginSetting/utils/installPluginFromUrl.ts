import axios from "axios";
import Config from "@/core/appConfig";
import PluginManager from "@/core/pluginManager";
import { IInstallPluginResult } from "@/types/core/pluginManager";

export interface SubscriptionProgress {
    phase: "fetching" | "updating";
    total?: number;
    results: IInstallPluginResult[];
}

export interface SubscriptionInstallOptions {
    signal?: AbortSignal;
    scriptSource?: boolean;
    pluginUrls?: string[];
    onProgress?: (progress: SubscriptionProgress) => void;
}

const headers = { "Cache-Control": "no-cache", Pragma: "no-cache", Expires: "0" };

export default async function installPluginFromUrl(text: string, options: SubscriptionInstallOptions = {}): Promise<IInstallPluginResult[]> {
    const inputUrl = text.trim();
    const controller = new AbortController();
    const signal = options.signal ?? controller.signal;
    const timer = options.signal ? undefined : setTimeout(() => controller.abort(), 120_000);
    const results: IInstallPluginResult[] = [];
    try {
        if (signal.aborted) {
            return results;
        }
        options.onProgress?.({ phase: "fetching", results: [] });
        let urls = options.pluginUrls;
        if (!urls) {
            if (!options.scriptSource && /\.json(?:[?#]|$)/i.test(inputUrl)) {
                const { data } = await axios.get(inputUrl, { headers, timeout: 10_000, signal });
                if (!Array.isArray(data?.plugins)) {
                    throw new Error("Invalid subscription manifest");
                }
                urls = data.plugins.map((plugin: { url?: unknown } | null) => plugin?.url);
            } else {
                urls = [inputUrl];
            }
        }
        if (!urls?.length || urls.some(url => typeof url !== "string" || !/^https?:\/\/\S+$/i.test(url))) {
            throw new Error("Invalid or empty subscription manifest");
        }
        const pluginUrls = [...new Set(urls.map(url => url.trim()))];
        const publish = () => options.onProgress?.({ phase: "updating", total: pluginUrls.length, results: [...results] });
        publish();
        let nextIndex = 0;
        async function worker() {
            while (!signal.aborted && nextIndex < pluginUrls.length) {
                const url = pluginUrls[nextIndex++];
                let result: IInstallPluginResult;
                try {
                    const { data } = await axios.get(url, { headers, timeout: 10_000, signal });
                    if (signal.aborted) {
                        break;
                    }
                    // Downloads overlap; the manager serializes plugin-list writes.
                    result = await PluginManager.installPluginFromCode(data, url, {
                        notCheckVersion: Config.getConfig("basic.notCheckPluginVersion"),
                        signal,
                        scriptSource: options.scriptSource,
                    });
                } catch (e: any) {
                    result = { success: false, message: e?.message ?? "", pluginUrl: url };
                }
                // Keep a write that finished after cancellation; stop before starting another.
                if (signal.aborted && !result.success) {
                    break;
                }
                results.push({ ...result, pluginUrl: result.pluginUrl ?? url });
                publish();
            }
        }
        await Promise.all(Array.from({ length: Math.min(3, pluginUrls.length) }, worker));
        if (controller.signal.aborted && !options.signal) {
            results.push({ success: false, pluginUrl: inputUrl, message: "Subscription update timed out" });
        }
        return results;
    } catch (e: any) {
        if (options.signal?.aborted) {
            return results;
        }
        return [{ success: false, message: e?.message ?? "", pluginUrl: inputUrl }];
    } finally {
        clearTimeout(timer);
    }
}
