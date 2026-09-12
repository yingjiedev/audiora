/** Apply playback-only URL adaptations while preserving the plugin response. */
export async function adaptMediaSourceForPlayback(
    source: IPlugin.IMediaSourceResult,
): Promise<IPlugin.IMediaSourceResult> {
    try {
        const { getLocalStreamUrlIfNeeded } = require("@/service/mflac/proxy");
        const localUrl = await getLocalStreamUrlIfNeeded(
            source.url,
            source.ekey,
            source.headers,
            source.cek,
        );
        return localUrl
            ? { ...source, url: localUrl, headers: undefined }
            : source;
    } catch {
        return source;
    }
}
