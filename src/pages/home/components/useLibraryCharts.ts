import { RequestStateCode } from "@/constants/commonConst";
import PluginManager, { Plugin } from "@/core/pluginManager";
import { pluginsTopListAtom } from "@/pages/topList/store/atoms";
import { getDefaultStore, useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const chartPreviewLimit = 10;
type PreviewState = "loading" | "ready" | "error";
export interface LibraryChartPreview {
    state: PreviewState;
    musicList: IMusic.IMusicItem[];
    sheet: IMusic.IMusicSheetItemBase;
}

const catalogRequests = new Map<string, Promise<void>>();

/** Share the existing catalog cache; concurrent mounts request each source once. */
async function loadCatalog(plugin: Plugin, force = false) {
    if (catalogRequests.has(plugin.hash)) return catalogRequests.get(plugin.hash);
    const store = getDefaultStore();
    const cached = store.get(pluginsTopListAtom)[plugin.hash];
    if (!force && (cached?.data.length || cached?.state === RequestStateCode.FINISHED)) return;
    const update = (state: RequestStateCode, data: IMusic.IMusicSheetGroupItem[]) => {
        store.set(pluginsTopListAtom, previous => ({ ...previous, [plugin.hash]: { state, data } }));
    };
    update(RequestStateCode.PENDING_FIRST_PAGE, cached?.data ?? []);
    const request = Promise.resolve().then(async () => {
        try {
            const data = await plugin.methods.getTopLists();
            update(RequestStateCode.FINISHED, Array.isArray(data) ? data : []);
        } catch {
            update(RequestStateCode.ERROR, cached?.data ?? []);
        } finally {
            catalogRequests.delete(plugin.hash);
        }
    });
    catalogRequests.set(plugin.hash, request);
    return request;
}

export function libraryChartKey(sheet: IMusic.IMusicSheetItemBase) {
    return JSON.stringify([sheet.platform, sheet.id]);
}

/** Load only the current card and its neighbour; retain scoped details while switching sources. */
export default function useLibraryCharts(plugin: Plugin | undefined, visibleIndex: number) {
    const catalogs = useAtomValue(pluginsTopListAtom);
    const previews = useRef(new Map<string, LibraryChartPreview>());
    const mounted = useRef(true);
    const [, setRevision] = useState(0);
    const hash = plugin?.hash;
    const hasCatalog = !!plugin?.supportedMethods.has("getTopLists");
    const hasDetails = !!plugin?.supportedMethods.has("getTopListDetail");
    const catalog = hash ? catalogs[hash] : undefined;
    const charts = useMemo(() => {
        if (!hasCatalog) return [];
        const seen = new Set<string>();
        return (catalog?.data ?? []).flatMap(group => group.data ?? []).filter(sheet => {
            if (!sheet || sheet.id == null) return false;
            const key = libraryChartKey(sheet);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [catalog?.data, hasCatalog]);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (plugin && hasCatalog) loadCatalog(plugin);
    }, [plugin, hasCatalog]);

    const previewKey = useCallback((sheet: IMusic.IMusicSheetItemBase) => JSON.stringify([hash, libraryChartKey(sheet)]), [hash]);
    const loadPreview = useCallback(async (sheet: IMusic.IMusicSheetItemBase, force = false) => {
        if (!plugin || !hasDetails || !PluginManager.isPluginEnabled(plugin)) return;
        const key = previewKey(sheet);
        const existing = previews.current.get(key);
        if (existing?.state === "loading" || (!force && existing)) return;
        previews.current.set(key, { state: "loading", musicList: [], sheet });
        if (mounted.current) setRevision(value => value + 1);
        try {
            const result = await plugin.methods.getTopListDetail(sheet, 1);
            const seen = new Set<string>();
            const musicList = (result.musicList ?? []).filter(music => {
                if (!music || music.id == null) return false;
                const identity = JSON.stringify([music.platform, music.id]);
                if (seen.has(identity)) return false;
                seen.add(identity);
                return true;
            }).slice(0, chartPreviewLimit);
            previews.current.set(key, { state: "ready", musicList, sheet: { ...sheet, ...result.topListItem } });
        } catch {
            previews.current.set(key, { state: "error", musicList: [], sheet });
        }
        if (mounted.current) setRevision(value => value + 1);
    }, [plugin, hasDetails, previewKey]);

    useEffect(() => {
        charts.slice(visibleIndex, visibleIndex + 2).forEach(sheet => {
            loadPreview(sheet);
        });
    }, [charts, visibleIndex, loadPreview]);

    return {
        charts,
        hasCatalog,
        hasDetails,
        loading: hasCatalog && (!catalog || catalog.state === RequestStateCode.PENDING_FIRST_PAGE || catalog.state === RequestStateCode.PENDING_REST_PAGE),
        hasError: catalog?.state === RequestStateCode.ERROR,
        getPreview: (sheet: IMusic.IMusicSheetItemBase) => previews.current.get(previewKey(sheet)),
        retryCatalog: () => plugin && hasCatalog ? loadCatalog(plugin, true) : Promise.resolve(),
        retryPreview: (sheet: IMusic.IMusicSheetItemBase) => loadPreview(sheet, true),
    };
}
