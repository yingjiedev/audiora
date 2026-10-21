import { isSourceProvider, ScriptSourceError, SourceProvider } from "./types";

const providerNames: Record<SourceProvider, string[]> = {
    kw: ["kw", "kuwo", "酷我", "酷我音乐"],
    kg: ["kg", "kugou", "酷狗", "酷狗音乐"],
    tx: ["tx", "qq", "tencent", "qq音乐", "腾讯音乐"],
    wy: ["wy", "netease", "163", "网易", "网易云", "网易云音乐"],
    mg: ["mg", "migu", "咪咕", "咪咕音乐"],
};

export function inferSourceProvider(value: unknown): SourceProvider | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    return (Object.keys(providerNames) as SourceProvider[]).find(provider =>
        providerNames[provider].some(name => normalized === name ||
            (name.length > 2 && normalized.includes(name))));
}

export function resolveSourceProvider(
    item: IMusic.IMusicItemBase,
    override?: SourceProvider | null,
    pluginProvider?: string,
): SourceProvider {
    const explicit = override ?? item.providerId ?? item.sourceProvider ?? pluginProvider;
    const provider = isSourceProvider(explicit) ? explicit : inferSourceProvider(item.platform);
    if (!provider) {
        throw new ScriptSourceError("请为该音乐插件设置解析平台");
    }
    return provider;
}

function pick(...values: unknown[]): string | number | undefined {
    return values.find(value => (typeof value === "string" && value.trim() !== "") ||
        (typeof value === "number" && Number.isFinite(value))) as string | number | undefined;
}

export function toScriptMusicInfo(item: IMusic.IMusicItemBase, provider: SourceProvider) {
    const meta = item.meta && typeof item.meta === "object" ? item.meta : {};
    let songmid = pick(item.songmid, meta.songId, item.songId, item.mid, item.id);
    if (provider === "kw") {
        songmid = pick(item.rid, item.musicrid, songmid);
        if (typeof songmid === "string") {
            songmid = songmid.replace(/^MUSIC_/i, "");
        }
    }
    const hash = provider === "kg" ? pick(item.hash, meta.hash, item.FileHash, item.fileHash, item.id) : undefined;
    const copyrightId = provider === "mg" ? pick(item.copyrightId, meta.copyrightId, songmid) : undefined;
    songmid = hash ?? copyrightId ?? songmid;
    if (songmid === undefined) {
        throw new ScriptSourceError("歌曲信息不足，无法解析");
    }
    const qualityTypes: Record<string, any> = {
        ...(meta._qualitys ?? {}),
        ...(item._types ?? {}),
    };
    const declaredTypes = item.types ?? meta.qualitys;
    for (const entry of Array.isArray(declaredTypes) ? declaredTypes : []) {
        if (entry && typeof entry.type === "string") {
            qualityTypes[entry.type] = { ...entry };
        }
    }
    for (const [key, value] of Object.entries(item.qualities ?? {})) {
        qualityTypes[key] = { ...qualityTypes[key], ...(value as object) };
    }
    if (provider === "kg") {
        for (const [quality, value] of Object.entries({ "128k": hash, "320k": item["320hash"] ?? item.hqhash, flac: item.sqhash })) {
            if (value) {
                qualityTypes[quality] = { ...qualityTypes[quality], hash: value };
            }
        }
    }
    const durationValue = Number(item.duration);
    const duration = Number.isFinite(durationValue) ? Math.max(0, Math.floor(durationValue)) : 0;
    const interval = item.interval ?? `${String(Math.floor(duration / 60)).padStart(2, "0")}:${String(duration % 60).padStart(2, "0")}`;
    const albumName = item.album ?? item.albumName ?? meta.albumName ?? "";
    const id = provider === "tx" ? pick(item.songId, meta.id, item.id, songmid) : songmid;
    const strMediaMid = pick(item.strMediaMid, meta.strMediaMid, item.mediaMid);
    const albumId = pick(item.albumId, meta.albumId);
    const albumMid = pick(item.albumMid, meta.albumMid);
    const types = Object.entries(qualityTypes).map(([type, value]) => ({ ...value, type }));
    return {
        ...item,
        id,
        source: provider,
        songmid,
        songId: pick(item.songId, meta.id, songmid),
        name: item.title ?? item.name ?? "",
        singer: item.artist ?? item.singer ?? "",
        albumName,
        interval,
        albumId,
        albumMid,
        strMediaMid,
        hash,
        copyrightId,
        types,
        _types: qualityTypes,
        meta: {
            ...meta, songId: songmid, albumName, albumId, albumMid, strMediaMid, hash,
            copyrightId, qualitys: types, _qualitys: qualityTypes,
            picUrl: item.artwork ?? meta.picUrl,
        },
    };
}
