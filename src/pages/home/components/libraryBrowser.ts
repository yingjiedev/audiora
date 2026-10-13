import { getLocalPath } from "@/utils/mediaUtils";

export type LocalBrowserMode = "tracks" | "artists" | "albums" | "folders";
export type LocalGroupMode = Exclude<LocalBrowserMode, "tracks">;

export interface LocalMusicGroup {
    key: string;
    name: string;
    detail?: string;
    musicList: IMusic.IMusicItem[];
}

function text(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function decodePath(path: string) {
    try {
        return decodeURIComponent(path);
    } catch {
        return path;
    }
}

function folderIdentity(item: IMusic.IMusicItem) {
    const legacyExtra = item[Symbol.for("$")] as { localPath?: string } | undefined;
    let path = text(item.localPath) || text(legacyExtra?.localPath) || text(getLocalPath(item));
    if (path.startsWith("content://")) {
        const document = /\/document\/([^?]+)/.exec(path);
        if (!document) return "";
        const documentId = decodePath(document[1]);
        // Opaque provider IDs are not filesystem folders.
        if (documentId.startsWith("primary:")) {
            path = `/storage/emulated/0/${documentId.slice(8)}`;
        } else if (documentId.startsWith("raw:")) {
            path = documentId.slice(4);
        } else {
            if (!documentId.includes("/")) return "";
            path = `${path.split("/document/")[0]}::${documentId}`;
        }
    } else {
        path = decodePath(path.replace(/^file:\/\//, ""));
    }
    path = path.replace(/\\/g, "/").replace(/\/+$/, "");
    const separator = path.lastIndexOf("/");
    return separator < 0 ? "" : path.slice(0, separator) || "/";
}

/** Keep real members and full identities; labels alone cannot identify folders/albums. */
export function groupLocalMusic(
    items: IMusic.IMusicItem[],
    mode: LocalGroupMode,
    locale: string,
): LocalMusicGroup[] {
    const groups = new Map<string, LocalMusicGroup>();
    items.forEach(item => {
        const artist = text(item.artist);
        const name = mode === "artists" ? artist
            : mode === "albums" ? text(item.album) : folderIdentity(item);
        const detail = mode === "albums" && name
            ? text(item.albumArtist) || artist : "";
        const key = JSON.stringify([mode, name, detail]);
        const group = groups.get(key);
        if (group) {
            group.musicList.push(item);
        } else {
            groups.set(key, {
                key,
                name: mode === "folders" ? name.split("/").filter(Boolean).pop() ?? name : name,
                detail: mode === "folders" ? name : detail,
                musicList: [item],
            });
        }
    });
    return Array.from(groups.values()).sort((left, right) => (
        left.name.localeCompare(right.name, locale)
        || (left.detail ?? "").localeCompare(right.detail ?? "", locale)
    ));
}
