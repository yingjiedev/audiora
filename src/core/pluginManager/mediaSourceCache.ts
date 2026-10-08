/** Preserve decryption metadata when replaying a cached source, including opaque URLs. */
export function readCachedMediaSource(
    source: IMusic.IMediaSource,
    legacy: { headers?: Record<string, string>; userAgent?: string },
): IPlugin.IMediaSourceResult {
    const headers = source.headers ?? legacy.headers;
    return {
        ...source,
        headers,
        userAgent: source.userAgent ?? legacy.userAgent ?? headers?.["user-agent"],
    };
}
