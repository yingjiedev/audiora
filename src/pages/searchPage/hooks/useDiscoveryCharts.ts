import PluginManager, { useSortedPlugins } from "@/core/pluginManager";
import { useParams } from "@/core/router";
import { pluginsTopListAtom } from "@/pages/topList/store/atoms";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import type { DiscoveryMusic } from "../common/searchDiscovery";
import { scopeSearchPlugins } from "../common/searchScope";
import { loadChartDiscovery } from "../common/topListDiscovery";

export default function useDiscoveryCharts() {
    const params = useParams<"search-page">();
    const plugins = useSortedPlugins();
    const topLists = useAtomValue(pluginsTopListAtom);
    const sources = useMemo(() => scopeSearchPlugins(plugins, params?.pluginHash).filter(plugin =>
        PluginManager.isPluginEnabled(plugin) && plugin.supportedMethods.has("search") &&
        plugin.supportedMethods.has("getTopLists") && plugin.supportedMethods.has("getTopListDetail"),
    ).slice(0, 2), [plugins, params?.pluginHash]);
    const [result, setResult] = useState<{ sources: typeof sources; music: DiscoveryMusic[] }>({ sources, music: [] });

    useEffect(() => {
        let active = true;
        const groups = Object.fromEntries(Object.entries(topLists).map(([hash, value]) => [hash, value.data]));
        loadChartDiscovery(sources, groups).then(music => {
            if (active) setResult({ sources, music });
        }).catch(() => {
            if (active) setResult({ sources, music: [] });
        });
        return () => {
            active = false;
        };
    }, [sources, topLists]);

    // Hide old-provider results immediately when the search scope changes.
    return result.sources === sources ? result.music : [];
}
