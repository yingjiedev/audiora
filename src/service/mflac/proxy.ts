import Mp3Util from "@/native/mp3Util";
import Cenc from "@/native/cenc";
import { EncryptedSourceError, QmcKeyError, resolveSongKey } from "./songKey";

export async function getLocalStreamUrlIfNeeded(
    url?: string,
    ekey?: string,
    headers?: Record<string, string>,
    cek?: string,
    qmcRawKey?: string,
): Promise<string | undefined> {
    if (!url) {
        return undefined;
    }
    if (cek) {
        return Cenc.registerStream(url, cek, headers);
    }
    const rawSongKey = resolveSongKey({ url, ekey, qmcRawKey });
    if (!rawSongKey) {
        return undefined;
    }
    if (url.startsWith("file://") || url.startsWith("/") || url.startsWith("content://")) {
        throw new QmcKeyError();
    }
    try {
        const localUrl = await Mp3Util.registerMflacStream(url, rawSongKey, headers);
        if (typeof localUrl !== "string" || !localUrl) {
            throw new EncryptedSourceError("Encrypted source could not be opened");
        }
        return localUrl;
    } catch {
        throw new EncryptedSourceError("Encrypted source could not be opened");
    }
}
