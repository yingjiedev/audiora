import { getLocalStreamUrlIfNeeded } from "@/service/mflac/proxy";
import { resolveSongKey } from "@/service/mflac/songKey";
import { isMflacUrl } from "@/utils/mflac";

/** Refresh legacy or unadapted encrypted tracks before resuming playback. */
export function canReuseMediaSourceForPlayback(source: IPlugin.IMediaSourceResult): boolean {
    try {
        const rawSongKey = resolveSongKey(source);
        if (isMflacUrl(source.url)) {
            return false;
        }
        return !rawSongKey && !source.cek || /^http:\/\/127\.0\.0\.1(?::\d+)?\//.test(source.url ?? "");
    } catch {
        return false;
    }
}

/** Never fall back to encrypted bytes when source adaptation fails. */
export async function adaptMediaSourceForPlayback(
    source: IPlugin.IMediaSourceResult,
): Promise<IPlugin.IMediaSourceResult> {
    const localUrl = await getLocalStreamUrlIfNeeded(
        source.url,
        source.ekey,
        source.headers,
        source.cek,
        source.qmcRawKey,
    );
    return localUrl
        ? { ...source, url: localUrl, headers: undefined }
        : source;
}
