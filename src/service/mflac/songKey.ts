import { Buffer } from "buffer";
import { isMflacUrl } from "@/utils/mflac";

export class EncryptedSourceError extends Error {}

export class QmcKeyError extends Error {
    constructor() {
        super("A raw song key is required; ask the source provider for qmcRawKey or an unencrypted audio URL.");
        this.name = "QmcKeyError";
    }
}

/** Canonical base64 avoids guessing whether a base64 string happens to be hex. */
export function normalizeRawSongKey(value: unknown): string {
    if (typeof value !== "string" || value.length > 8200) {
        throw new QmcKeyError();
    }
    const text = value.trim();
    let bytes: Buffer;
    if (text.startsWith("hex:")) {
        const hex = text.slice(4);
        if (!/^(?:[0-9a-fA-F]{2})+$/.test(hex)) {
            throw new QmcKeyError();
        }
        bytes = Buffer.from(hex, "hex");
    } else {
        const base64 = text.startsWith("base64:") ? text.slice(7) : text;
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
            throw new QmcKeyError();
        }
        bytes = Buffer.from(base64, "base64");
        if (bytes.toString("base64") !== base64) {
            throw new QmcKeyError();
        }
    }
    if (!bytes.length || bytes.length > 4096) {
        throw new QmcKeyError();
    }
    return `base64:${bytes.toString("base64")}`;
}

/** Wrapped EKey is deliberately never treated as a raw song key. */
export function resolveSongKey(source: {
    url?: string;
    ekey?: string;
    qmcRawKey?: string;
    cek?: string;
}): string | undefined {
    if (source.cek) {
        return undefined;
    }
    if (source.qmcRawKey !== undefined) {
        return normalizeRawSongKey(source.qmcRawKey);
    }
    if (source.ekey || isMflacUrl(source.url)) {
        throw new QmcKeyError();
    }
    return undefined;
}
