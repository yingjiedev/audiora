import type { ScriptSourceRecord } from "./types";

// Keep this as source text: Metro must not introduce helpers from the app realm.
export const SOURCE_BOOTSTRAP = String.raw`(function (scriptInfo) {
    "use strict";
    const nativeSend = globalThis.__sourceSend;
    const nativeCrypto = globalThis.__sourceCrypto;
    delete globalThis.__sourceSend;
    delete globalThis.__sourceCrypto;
    const send = value => nativeSend(JSON.stringify(value));
    const callbacks = new Map();
    const timers = new Map();
    const utilities = new Map();
    let sequence = 0;
    let handler = null;
    let initialized = false;
    let updateSent = false;
    const base64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function encodeBytes(bytes, encoding) {
        encoding = String(encoding || "utf8").toLowerCase().replace(/[-_]/g, "");
        if (encoding === "hex") return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
        if (encoding === "base64") {
            let result = "";
            for (let i = 0; i < bytes.length; i += 3) {
                const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
                result += base64[n >>> 18] + base64[(n >>> 12) & 63] +
                    (i + 1 < bytes.length ? base64[(n >>> 6) & 63] : "=") +
                    (i + 2 < bytes.length ? base64[n & 63] : "=");
            }
            return result;
        }
        if (encoding === "latin1" || encoding === "binary" || encoding === "ascii") {
            return Array.from(bytes, b => String.fromCharCode(encoding === "ascii" ? b & 127 : b)).join("");
        }
        if (encoding !== "utf8") throw new Error("Unsupported text encoding");
        let result = "";
        for (let i = 0; i < bytes.length;) {
            const b = bytes[i++];
            if (b < 128) { result += String.fromCharCode(b); continue; }
            const count = b >= 240 && b <= 244 ? 3 : b >= 224 && b <= 239 ? 2 : b >= 194 && b <= 223 ? 1 : 0;
            if (!count || i + count > bytes.length) { result += "\ufffd"; continue; }
            let code = b & (count === 3 ? 7 : count === 2 ? 15 : 31);
            let valid = true;
            for (let j = 0; j < count; j++) {
                const next = bytes[i + j];
                if ((next & 192) !== 128) { valid = false; break; }
                code = (code << 6) | (next & 63);
            }
            if (!valid || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ||
                code < (count === 3 ? 0x10000 : count === 2 ? 0x800 : 0x80)) {
                result += "\ufffd"; continue;
            }
            i += count;
            result += String.fromCodePoint(code);
        }
        return result;
    }

    class SourceBuffer extends Uint8Array {
        static from(input, encoding) {
            if (typeof input === "string") {
                encoding = String(encoding || "utf8").toLowerCase().replace(/[-_]/g, "");
                const output = [];
                if (encoding === "base64") {
                    let bits = 0, value = 0;
                    for (const ch of input.replace(/-/g, "+").replace(/_/g, "/")) {
                        const n = base64.indexOf(ch);
                        if (n < 0) continue;
                        value = (value << 6) | n; bits += 6;
                        if (bits >= 8) { bits -= 8; output.push((value >>> bits) & 255); }
                    }
                } else if (encoding === "hex") {
                    for (let i = 0; i + 1 < input.length; i += 2) {
                        if (!/^[0-9a-f]{2}$/i.test(input.slice(i, i + 2))) break;
                        output.push(parseInt(input.slice(i, i + 2), 16));
                    }
                } else if (encoding === "latin1" || encoding === "binary" || encoding === "ascii") {
                    for (let i = 0; i < input.length; i++) output.push(input.charCodeAt(i) & 255);
                } else {
                    if (encoding !== "utf8") throw new Error("Unsupported text encoding");
                    for (const ch of input) {
                        let code = ch.codePointAt(0);
                        if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
                        if (code < 128) output.push(code);
                        else if (code < 2048) output.push(192 | (code >> 6), 128 | (code & 63));
                        else if (code < 65536) output.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
                        else output.push(240 | (code >> 18), 128 | ((code >> 12) & 63), 128 | ((code >> 6) & 63), 128 | (code & 63));
                    }
                }
                return new SourceBuffer(output);
            }
            if (input instanceof ArrayBuffer) return new SourceBuffer(input);
            if (ArrayBuffer.isView(input)) return new SourceBuffer(new Uint8Array(input.buffer, input.byteOffset, input.byteLength));
            if (Array.isArray(input)) return new SourceBuffer(input);
            throw new TypeError("Invalid buffer input");
        }
        static alloc(size, fill) {
            if (!Number.isInteger(size) || size < 0 || size > 1048576) throw new RangeError("Invalid buffer size");
            const result = new SourceBuffer(size);
            if (fill) result.fill(fill);
            return result;
        }
        static isBuffer(value) { return value instanceof SourceBuffer; }
        static concat(values) {
            const result = SourceBuffer.alloc(values.reduce((sum, bytes) => sum + bytes.length, 0));
            let offset = 0;
            for (const bytes of values) { result.set(bytes, offset); offset += bytes.length; }
            return result;
        }
        toString(encoding, start, end) { return encodeBytes(this.subarray(start, end), encoding); }
    }
    const bytes = value => SourceBuffer.from(value);
    const b64 = value => bytes(value).toString("base64");
    const crypto = request => {
        const result = JSON.parse(nativeCrypto(JSON.stringify(request)));
        if (result.error) throw new Error(result.error);
        return result.data;
    };
    const zip = (method, value) => new Promise((resolve, reject) => {
        if (utilities.size >= 8) return reject(new Error("Too many utility requests"));
        const id = ++sequence;
        utilities.set(id, { resolve, reject });
        send({ type: "utility", id, method, data: b64(value) });
    });
    const utils = {
        buffer: { from: SourceBuffer.from, bufToString: (value, encoding) => bytes(value).toString(encoding) },
        crypto: {
            md5: text => crypto({ operation: "md5", text: String(text) }),
            randomBytes: size => SourceBuffer.from(crypto({ operation: "randomBytes", size }), "base64"),
            aesEncrypt: (data, mode, key, iv) => SourceBuffer.from(crypto({ operation: "aesEncrypt", data: b64(data), mode, key: b64(key), iv: b64(iv || []) }), "base64"),
            rsaEncrypt: (data, key) => SourceBuffer.from(crypto({ operation: "rsaEncrypt", data: b64(data), key }), "base64"),
        },
        zlib: { inflate: value => zip("inflate", value), deflate: value => zip("deflate", value) },
    };
    const api = {
        EVENT_NAMES: Object.freeze({ request: "request", inited: "inited", updateAlert: "updateAlert" }),
        env: "mobile",
        version: "2.0.0",
        currentScriptInfo: scriptInfo,
        utils,
        on: (event, callback) => {
            if (event !== "request" || typeof callback !== "function") return Promise.reject(new Error("Unsupported event"));
            handler = callback;
            return Promise.resolve();
        },
        send: (event, data) => {
            if (event === "inited") {
                if (initialized) return Promise.reject(new Error("Script is already initialized"));
                if (!handler) return Promise.reject(new Error("Request handler is missing"));
                initialized = true;
                send({ type: "inited", data });
            } else if (event === "updateAlert") {
                if (updateSent) return Promise.reject(new Error("Update was already reported"));
                updateSent = true;
                // Third-party text and URLs are retained only inside the script.
                send({ type: "updateAvailable" });
            } else return Promise.reject(new Error("Unsupported event"));
            return Promise.resolve();
        },
        request: (url, options, callback) => {
            if (typeof callback !== "function") throw new TypeError("Request callback is required");
            if (callbacks.size >= 8) { callback(new Error("Too many HTTP requests"), null, null); return () => {}; }
            const id = ++sequence;
            callbacks.set(id, callback);
            send({ type: "http", id, url, options: options || {} });
            return () => {
                if (!callbacks.delete(id)) return;
                send({ type: "cancelHttp", id });
            };
        },
    };
    function timeout(callback, delay, ...args) {
        if (typeof callback !== "function") throw new TypeError("Timer callback must be a function");
        if (timers.size >= 128) throw new Error("Too many timers");
        const id = ++sequence;
        timers.set(id, () => callback(...args));
        send({ type: "timer", id, delay: Math.min(2147483647, Math.max(1, Number(delay) || 1)) });
        return id;
    }
    function clearTimer(id) { timers.delete(id); send({ type: "clearTimer", id }); }
    globalThis.setTimeout = timeout;
    globalThis.clearTimeout = clearTimer;
    const intervals = new Map();
    globalThis.setInterval = (callback, delay, ...args) => {
        const id = ++sequence;
        const run = () => {
            if (!intervals.has(id)) return;
            callback(...args);
            if (intervals.has(id)) intervals.set(id, timeout(run, delay));
        };
        intervals.set(id, timeout(run, delay));
        return id;
    };
    globalThis.clearInterval = id => { clearTimer(intervals.get(id)); intervals.delete(id); };
    globalThis.Buffer = SourceBuffer;
    globalThis.TextEncoder = class { encode(value) { return SourceBuffer.from(String(value)); } };
    globalThis.TextDecoder = class {
        constructor(encoding) { this.encoding = encoding || "utf8"; }
        decode(value) { return bytes(value || []).toString(this.encoding); }
    };
    globalThis.atob = text => SourceBuffer.from(text, "base64").toString("latin1");
    globalThis.btoa = text => SourceBuffer.from(text, "latin1").toString("base64");
    // These are aliases within this independent VM, never application globals.
    globalThis.window = globalThis;
    globalThis.global = globalThis;
    Object.defineProperty(globalThis, "lx", { value: Object.freeze(api), writable: false, configurable: false });
    globalThis.console = Object.fromEntries(["log", "info", "warn", "error", "debug", "group", "groupEnd", "table", "trace"].map(key => [key, () => {}]));
    Object.defineProperty(globalThis, "__audioraDispatch", { value: message => {
        if (message.type === "request") {
            if (!initialized || !handler) { send({ type: "result", id: message.id, error: "脚本尚未初始化" }); return; }
            Promise.resolve().then(() => handler.call(api, message.data)).then(result => {
                if (typeof result !== "string" || result.length > 16384 || !/^https?:\/\//i.test(result)) throw new Error("脚本未返回有效的播放地址");
                send({ type: "result", id: message.id, result });
            }).catch(error => send({ type: "result", id: message.id, error: String(error && error.message || error) }));
        } else if (message.type === "http") {
            const callback = callbacks.get(message.id);
            callbacks.delete(message.id);
            if (!callback) return;
            const response = message.response;
            if (response && response.binary) response.body = SourceBuffer.from(response.body, "base64");
            callback(message.error ? new Error(message.error) : null, response, response && response.body);
        } else if (message.type === "timer") {
            const callback = timers.get(message.id);
            timers.delete(message.id);
            if (callback) callback();
        } else if (message.type === "utility") {
            const target = utilities.get(message.id);
            utilities.delete(message.id);
            if (target) {
                if (message.error) target.reject(new Error(message.error));
                else target.resolve(SourceBuffer.from(message.data, "base64"));
            }
        }
    }, writable: false, configurable: false });
})`;

export function createSourceBootstrap(record: Pick<ScriptSourceRecord, "scriptInfo" | "script">): string {
    return `${SOURCE_BOOTSTRAP}(${JSON.stringify({ ...record.scriptInfo, rawScript: record.script })});`;
}
