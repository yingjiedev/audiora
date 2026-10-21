import axios from "axios";
import { Buffer } from "buffer";
import * as pako from "pako";
import qs from "qs";
import BackgroundTimer from "react-native-background-timer";
import nativeTransport, { SourceRuntimeTransport } from "@/native/scriptSource";
import { devLog } from "@/utils/log";
import { createSourceBootstrap } from "./bootstrap";
import { parseCapabilities, validateScript } from "./metadata";
import { ScriptSourceError, ScriptSourceRecord, SourceCapabilities } from "./types";

const http = axios.create();
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
let nextSession = 0;

export class SourceRuntime {
    readonly sessionId: string;
    disposed = false;
    lastUsed = Date.now();
    private init?: Promise<SourceCapabilities>;
    private resolveInit?: (capabilities: SourceCapabilities) => void;
    private rejectInit?: (error: Error) => void;
    private initTimer?: number;
    private evaluated = false;
    private capabilities?: SourceCapabilities;
    private unsubscribe?: () => void;
    private sequence = 0;
    private pending = new Map<number, {
        resolve: (url: string) => void;
        reject: (error: Error) => void;
        timeout: number;
    }>();
    private requests = new Map<number, AbortController>();
    private timers = new Map<number, number>();

    constructor(
        readonly record: ScriptSourceRecord,
        private transport: SourceRuntimeTransport = nativeTransport,
    ) {
        this.sessionId = `${record.id}_${record.revision.slice(0, 12)}_${++nextSession}`;
    }

    get busy(): boolean {
        return this.pending.size > 0 || !!this.resolveInit;
    }

    initialize(): Promise<SourceCapabilities> {
        if (this.disposed) {
            return Promise.reject(new ScriptSourceError("音源脚本已停止"));
        }
        if (this.init) {
            return this.init;
        }
        this.init = new Promise((resolve, reject) => {
            this.resolveInit = resolve;
            this.rejectInit = reject;
        });
        try {
            validateScript(this.record.script);
            this.unsubscribe = this.transport.subscribe(this.sessionId, payload => this.receive(payload));
            this.initTimer = BackgroundTimer.setTimeout(() => {
                this.dispose(new ScriptSourceError("音源脚本初始化超时"));
            }, 20_000);
            void this.transport.create(this.sessionId, createSourceBootstrap(this.record), this.record.script)
                .catch(error => {
                    devLog("error", "自定义音源运行组件失败", error?.message);
                    this.dispose(new ScriptSourceError("音源脚本初始化失败"));
                });
        } catch (error: any) {
            this.dispose(new ScriptSourceError(error?.message ?? "音源脚本初始化失败"));
        }
        return this.init;
    }

    async resolve(data: unknown): Promise<string> {
        await this.initialize();
        if (this.disposed || this.pending.size >= 8) {
            throw new ScriptSourceError("音源脚本忙，请稍后重试");
        }
        this.lastUsed = Date.now();
        return new Promise((resolve, reject) => {
            const id = ++this.sequence;
            const timeout = BackgroundTimer.setTimeout(() => {
                this.pending.delete(id);
                reject(new ScriptSourceError("播放地址解析超时"));
                if (!this.busy) {
                    this.dispose();
                }
            }, 25_000);
            this.pending.set(id, { resolve, reject, timeout });
            this.post({ type: "request", id, data });
        });
    }

    dispose(error = new ScriptSourceError("音源脚本已停止")) {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        if (this.initTimer !== undefined) {
            BackgroundTimer.clearTimeout(this.initTimer);
        }
        this.rejectInit?.(error);
        this.resolveInit = undefined;
        this.rejectInit = undefined;
        this.pending.forEach(target => {
            BackgroundTimer.clearTimeout(target.timeout);
            target.reject(error);
        });
        this.pending.clear();
        this.requests.forEach(controller => controller.abort());
        this.requests.clear();
        this.timers.forEach(timer => BackgroundTimer.clearTimeout(timer));
        this.timers.clear();
        this.unsubscribe?.();
        try {
            void this.transport.destroy(this.sessionId).catch(() => {});
        } catch {}
    }

    private post(message: unknown) {
        if (!this.disposed) {
            try {
                this.transport.post(this.sessionId, JSON.stringify(message));
            } catch {
                this.dispose(new ScriptSourceError("音源脚本通信失败"));
            }
        }
    }

    private receive(payload: string) {
        if (this.disposed) {
            return;
        }
        try {
            const message = JSON.parse(payload);
            switch (message.type) {
            case "evaluated":
                this.evaluated = true;
                this.completeInitialization();
                break;
            case "inited": {
                if (!this.resolveInit) {
                    break;
                }
                const capabilities = parseCapabilities(message.data);
                if (message.data?.status === false) {
                    throw new ScriptSourceError("音源脚本初始化失败");
                }
                this.capabilities = capabilities;
                this.completeInitialization();
                break;
            }
            case "result": {
                const target = this.pending.get(message.id);
                if (!target) {
                    break;
                }
                this.pending.delete(message.id);
                BackgroundTimer.clearTimeout(target.timeout);
                if (typeof message.result === "string" && /^https?:\/\//i.test(message.result)) {
                    target.resolve(message.result);
                } else {
                    devLog("warn", "自定义音源解析失败", String(message.error ?? ""));
                    target.reject(new ScriptSourceError("音源脚本无法解析该歌曲"));
                }
                break;
            }
            case "http":
                void this.request(message);
                break;
            case "cancelHttp":
                this.requests.get(message.id)?.abort();
                this.requests.delete(message.id);
                break;
            case "timer": {
                if (this.timers.size >= 128 || !Number.isSafeInteger(message.id) || this.timers.has(message.id)) {
                    throw new ScriptSourceError("音源脚本定时器超过限制");
                }
                const timer = BackgroundTimer.setTimeout(() => {
                    this.timers.delete(message.id);
                    this.post({ type: "timer", id: message.id });
                }, Math.min(2147483647, Math.max(1, Number(message.delay) || 1)));
                this.timers.set(message.id, timer);
                break;
            }
            case "clearTimer": {
                const timer = this.timers.get(message.id);
                if (timer !== undefined) {
                    BackgroundTimer.clearTimeout(timer);
                    this.timers.delete(message.id);
                }
                break;
            }
            case "utility":
                this.utility(message);
                break;
            case "runtimeError":
                devLog("error", "自定义音源脚本错误", String(message.message ?? ""));
                this.dispose(new ScriptSourceError("音源脚本运行失败"));
                break;
            }
        } catch (error: any) {
            this.dispose(new ScriptSourceError(error?.message ?? "音源脚本消息无效"));
        }
    }

    private completeInitialization() {
        if (!this.evaluated || !this.capabilities || !this.resolveInit) {
            return;
        }
        if (this.initTimer !== undefined) {
            BackgroundTimer.clearTimeout(this.initTimer);
        }
        this.resolveInit(this.capabilities);
        this.resolveInit = undefined;
        this.rejectInit = undefined;
    }

    private async request(message: any) {
        const { id, url } = message;
        let controller: AbortController | undefined;
        try {
            if (!Number.isSafeInteger(id) || this.requests.has(id) || this.requests.size >= 8 ||
                typeof url !== "string" || url.length > 16384 || !/^https?:\/\//i.test(url)) {
                throw new Error("Invalid or excessive HTTP request");
            }
            const options = message.options ?? {};
            const headers: Record<string, string> = {};
            for (const [key, value] of Object.entries(options.headers ?? {})) {
                if (typeof value === "string" || typeof value === "number") {
                    headers[key] = String(value);
                }
            }
            let data = options.body;
            if (data === undefined && options.form) {
                data = qs.stringify(options.form);
                headers["Content-Type"] ??= "application/x-www-form-urlencoded";
            } else if (data === undefined && options.formData) {
                const form = new FormData();
                for (const [key, value] of Object.entries(options.formData)) {
                    if (typeof value !== "string" && typeof value !== "number") {
                        throw new Error("Only text form data is supported");
                    }
                    form.append(key, String(value));
                }
                data = form;
            }
            controller = new AbortController();
            this.requests.set(id, controller);
            const response = await http.request({
                url, method: String(options.method ?? "GET"), headers, data,
                timeout: Math.min(20_000, Math.max(1, Number(options.timeout) || 10_000)),
                signal: controller.signal,
                responseType: options.binary ? "arraybuffer" : "text",
                transformRequest: [function (value, requestHeaders) {
                    if (typeof value === "string") {
                        return value;
                    }
                    const defaults = http.defaults.transformRequest;
                    for (const transform of Array.isArray(defaults) ? defaults : [defaults]) {
                        if (transform) {
                            value = transform.call(this, value, requestHeaders);
                        }
                    }
                    return value;
                }],
                transformResponse: [value => value],
                validateStatus: () => true,
                maxContentLength: MAX_RESPONSE_BYTES,
            });
            const binary = options.binary === true;
            const bytes = response.data instanceof ArrayBuffer
                ? Buffer.from(new Uint8Array(response.data))
                : ArrayBuffer.isView(response.data)
                    ? Buffer.from(response.data.buffer, response.data.byteOffset, response.data.byteLength)
                    : Buffer.from(String(response.data ?? ""));
            if (bytes.length > MAX_RESPONSE_BYTES) {
                throw new Error("Response exceeds size limit");
            }
            let body: unknown = binary ? bytes.toString("base64") : bytes.toString("utf8");
            if (!binary) {
                try {
                    body = JSON.parse(body as string);
                } catch {}
            }
            this.post({
                type: "http", id, response: {
                    statusCode: response.status,
                    statusMessage: response.statusText,
                    headers: response.headers,
                    body, binary,
                },
            });
        } catch (error: any) {
            if (!controller?.signal.aborted) {
                this.post({ type: "http", id, error: String(error?.message ?? "HTTP request failed") });
            }
        } finally {
            if (this.requests.get(id) === controller) {
                this.requests.delete(id);
            }
        }
    }

    private utility(message: any) {
        try {
            if (typeof message.data !== "string" || message.data.length > MAX_RESPONSE_BYTES) {
                throw new Error("Utility input exceeds limit");
            }
            const input = Buffer.from(message.data, "base64");
            let output: Uint8Array;
            if (message.method === "inflate") {
                const chunks: Uint8Array[] = [];
                let total = 0;
                const inflater = new pako.Inflate({ chunkSize: 65536 });
                inflater.onData = (chunk: Uint8Array) => {
                    total += chunk.length;
                    if (total > MAX_RESPONSE_BYTES) {
                        throw new Error("Decompressed data exceeds limit");
                    }
                    chunks.push(chunk);
                };
                inflater.push(input, true);
                if (inflater.err) {
                    throw new Error("Invalid compressed data");
                }
                output = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
            } else if (message.method === "deflate") {
                output = pako.deflate(input);
            } else {
                throw new Error("Unsupported utility");
            }
            this.post({ type: "utility", id: message.id, data: Buffer.from(output).toString("base64") });
        } catch (error: any) {
            this.post({ type: "utility", id: message.id, error: String(error?.message ?? "Utility failed") });
        }
    }
}

const runtimes = new Map<string, SourceRuntime>();

export function getSourceRuntime(record: ScriptSourceRecord): SourceRuntime {
    const key = `${record.id}:${record.revision}`;
    const existing = runtimes.get(key);
    if (existing && !existing.disposed) {
        return existing;
    }
    for (const [entryKey, runtime] of runtimes) {
        if (runtime.disposed || (!runtime.busy && runtimes.size >= 4)) {
            runtime.dispose();
            runtimes.delete(entryKey);
        }
    }
    const runtime = new SourceRuntime(record);
    runtimes.set(key, runtime);
    return runtime;
}

export function disposeSourceRuntime(id: string, revision?: string) {
    for (const [key, runtime] of runtimes) {
        if (runtime.record.id === id && (!revision || runtime.record.revision === revision)) {
            runtime.dispose();
            runtimes.delete(key);
        }
    }
}
