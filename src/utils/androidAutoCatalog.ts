import { NativeModules, Platform } from "react-native";

/** An opaque identity; platform and id must never be matched independently. */
export function getAndroidAutoMediaId(item: Pick<IMusic.IMusicItem, "platform" | "id">) {
    return `${encodeURIComponent(item.platform)}:${encodeURIComponent(item.id)}`;
}

export function createAndroidAutoCatalog(
    playList: IMusic.IMusicItem[],
    currentMusic?: IMusic.IMusicItem | null,
) {
    const currentMediaId = currentMusic ? getAndroidAutoMediaId(currentMusic) : null;
    return {
        currentMediaId,
        items: playList.map(item => {
            const mediaId = getAndroidAutoMediaId(item);
            const metadata = mediaId === currentMediaId ? { ...item, ...currentMusic } : item;
            const artwork = typeof metadata.artwork === "string" ? metadata.artwork.trim() : "";
            return {
                mediaId,
                title: String(metadata.title || "Audiora"),
                artist: String(metadata.artist || ""),
                album: String(metadata.album || ""),
                artwork: artwork.startsWith("//") ? `https:${artwork}` : artwork,
            };
        }),
    };
}

export function publishAndroidAutoCatalog(
    playList: IMusic.IMusicItem[],
    currentMusic?: IMusic.IMusicItem | null,
) {
    if (Platform.OS !== "android" || !NativeModules.AndroidAuto) {
        return;
    }
    // Only browsing metadata crosses the bridge. Audio URLs, request headers,
    // keys and progress are never persisted in the car catalog.
    NativeModules.AndroidAuto.publishCatalog(
        JSON.stringify(createAndroidAutoCatalog(playList, currentMusic)),
    ).catch(() => undefined);
}
