import axios from "axios";
import Config from "@/core/appConfig";
import PluginManager from "@/core/pluginManager";
import { IInstallPluginResult } from "@/types/core/pluginManager";

export default async function installPluginFromUrl(text: string): Promise<IInstallPluginResult[]> {
    try {
        const inputUrl = text.trim();
        let urls: string[];
        if (inputUrl.endsWith(".json")) {
            const { data } = await axios.get(inputUrl, {
                headers: {
                    "Cache-Control": "no-cache",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            });
            urls = (data?.plugins ?? []).map((plugin: { url: string }) => plugin.url);
        } else {
            urls = [inputUrl];
        }
        const results: IInstallPluginResult[] = [];
        // Installing plugins writes the shared plugin list; avoid concurrent overwrites.
        for (const url of urls) {
            try {
                results.push(await PluginManager.installPluginFromUrl(url, {
                    notCheckVersion: Config.getConfig("basic.notCheckPluginVersion"),
                }));
            } catch (e: any) {
                results.push({ success: false, message: e?.message, pluginUrl: url });
            }
        }
        return results;
    } catch (e: any) {
        return [{ success: false, message: e?.message, pluginUrl: text }];
    }
}
