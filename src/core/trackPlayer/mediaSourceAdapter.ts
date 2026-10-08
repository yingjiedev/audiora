import { getLocalStreamUrlIfNeeded } from "@/service/mflac/proxy";

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
