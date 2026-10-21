jest.mock("@/utils/log", () => ({ devLog: jest.fn() }));
jest.mock("@/native/scriptSource", () => ({ __esModule: true, default: {} }));
jest.mock("react-native-background-timer", () => ({
    __esModule: true,
    default: {
        setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
        clearTimeout: (timer: any) => clearTimeout(timer),
    },
}));
const mockHttp = jest.fn();
jest.mock("axios", () => ({ __esModule: true, default: {
    create: () => ({ request: (...args: any[]) => mockHttp(...args) }),
} }));

import { SourceRuntime } from "./runtime";
import { deflate } from "pako";
import type { ScriptSourceRecord } from "./types";

const record: ScriptSourceRecord = {
    format: "audiora-script-source-v1", id: "fixture", revision: "revision", script: "fixture script",
    displayName: "Custom source 1", providers: {},
    scriptInfo: { name: "Fixture", version: "custom", author: "", homepage: "", description: "" },
};
const capabilities = { sources: { wy: { type: "music", actions: ["musicUrl"], qualitys: ["320k"] } } };

function fixture() {
    let listener: ((payload: string) => void) | undefined;
    const transport = {
        create: jest.fn(async () => undefined),
        post: jest.fn(),
        destroy: jest.fn(async () => undefined),
        subscribe: jest.fn((_id, callback) => {
            listener = callback;
            return jest.fn();
        }),
    };
    const runtime = new SourceRuntime(record, transport);
    const emit = (message: any) => {
        listener?.(JSON.stringify(message));
        if (message.type === "inited") {
            listener?.(JSON.stringify({ type: "evaluated" }));
        }
    };
    const sent = () => transport.post.mock.calls.map(call => JSON.parse(call[1]));
    return { runtime, transport, emit, sent };
}

describe("custom source lifecycle", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockHttp.mockReset();
    });
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("coalesces initialization and waits for the asynchronous capability event", async () => {
        const host = fixture();
        const init = host.runtime.initialize();
        expect(host.runtime.initialize()).toBe(init);
        expect(host.transport.create).toHaveBeenCalledTimes(1);
        host.emit({ type: "inited", data: capabilities });
        await expect(init).resolves.toEqual({ wy: { qualitys: ["320k"] } });
        host.runtime.dispose();
    });

    it("times out initialization and destroys the failed native instance", async () => {
        const host = fixture();
        const init = host.runtime.initialize();
        const error = init.catch(reason => reason);
        jest.advanceTimersByTime(20_000);
        await expect(error).resolves.toHaveProperty("message", "音源脚本初始化超时");
        expect(host.transport.destroy).toHaveBeenCalledTimes(1);
    });

    it("rejects a top-level exception even if the script already sent inited", async () => {
        const host = fixture();
        const init = host.runtime.initialize();
        const listener = host.transport.subscribe.mock.calls[0][1];
        listener(JSON.stringify({ type: "inited", data: capabilities }));
        const error = init.catch(reason => reason);
        host.emit({ type: "runtimeError", message: "fixture failed after inited" });
        await expect(error).resolves.toHaveProperty("message", "音源脚本运行失败");
    });

    it("correlates concurrent responses and ignores late messages after disposal", async () => {
        const host = fixture();
        const init = host.runtime.initialize();
        host.emit({ type: "inited", data: capabilities });
        await init;
        const first = host.runtime.resolve({ song: 1 });
        const second = host.runtime.resolve({ song: 2 });
        await Promise.resolve();
        const requests = host.sent();
        host.emit({ type: "result", id: requests[1].id, result: "https://example.invalid/second" });
        host.emit({ type: "result", id: requests[0].id, result: "https://example.invalid/first" });
        await expect(second).resolves.toContain("second");
        await expect(first).resolves.toContain("first");
        host.runtime.dispose();
        host.emit({ type: "timer", id: 99, delay: 1 });
        expect(jest.getTimerCount()).toBe(0);
    });

    it("preserves HTTP status, parsed body, text bodies and raw JSON request strings", async () => {
        const host = fixture();
        const init = host.runtime.initialize();
        host.emit({ type: "inited", data: capabilities });
        await init;
        mockHttp.mockResolvedValueOnce({ data: "{\"error\":\"denied\"}", status: 403, statusText: "Forbidden", headers: {} });
        host.emit({ type: "http", id: 7, url: "https://example.invalid/api", options: {
            method: "POST", body: "{\"id\":42}", headers: { "Content-Type": "application/json" },
        } });
        await Promise.resolve();
        expect(mockHttp.mock.calls[0][0].data).toBe("{\"id\":42}");
        expect(mockHttp.mock.calls[0][0].validateStatus(403)).toBe(true);
        const rawBody = "  {\"id\":42}  ";
        expect(mockHttp.mock.calls[0][0].transformRequest[0](rawBody, {})).toBe(rawBody);
        expect(host.sent()[0].response).toMatchObject({ statusCode: 403, body: { error: "denied" } });
        mockHttp.mockResolvedValueOnce({ data: "plain text", status: 200, headers: {} });
        host.emit({ type: "http", id: 8, url: "https://example.invalid/text", options: {} });
        await Promise.resolve();
        expect(host.sent()[1].response.body).toBe("plain text");
        host.runtime.dispose();
    });

    it("rejects local schemes and cancels HTTP work and timers on shutdown", async () => {
        const host = fixture();
        const init = host.runtime.initialize();
        host.emit({ type: "inited", data: capabilities });
        await init;
        host.emit({ type: "http", id: 1, url: "file:///private", options: {} });
        expect(mockHttp).not.toHaveBeenCalled();
        mockHttp.mockImplementation(() => new Promise(() => {}));
        host.emit({ type: "http", id: 2, url: "https://example.invalid", options: {} });
        const signal = mockHttp.mock.calls[0][0].signal;
        host.emit({ type: "timer", id: 3, delay: 1000 });
        const pending = host.runtime.resolve({ song: 3 });
        await Promise.resolve();
        const error = pending.catch(reason => reason);
        host.runtime.dispose();
        await expect(error).resolves.toHaveProperty("message", "音源脚本已停止");
        expect(signal.aborted).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("preserves binary response bytes without a text conversion", async () => {
        const host = fixture();
        const init = host.runtime.initialize();
        host.emit({ type: "inited", data: capabilities });
        await init;
        mockHttp.mockResolvedValueOnce({ data: new Uint8Array([0, 255, 128]), status: 200, headers: {} });
        host.emit({ type: "http", id: 6, url: "https://example.invalid/binary", options: { binary: true } });
        await Promise.resolve();
        expect(host.sent()[0].response).toMatchObject({ binary: true, body: "AP+A" });
        host.runtime.dispose();
    });

    it("bounds decompression before accepting an expanded payload", async () => {
        const host = fixture();
        const init = host.runtime.initialize();
        host.emit({ type: "inited", data: capabilities });
        await init;
        const compressed = Buffer.from(deflate(new Uint8Array(4 * 1024 * 1024 + 1))).toString("base64");
        host.emit({ type: "utility", id: 7, method: "inflate", data: compressed });
        expect(host.sent()[0]).toMatchObject({ type: "utility", id: 7, error: "Decompressed data exceeds limit" });
        host.runtime.dispose();
    });

    it("expires unresolved requests and releases an otherwise idle runtime", async () => {
        const host = fixture();
        const init = host.runtime.initialize();
        host.emit({ type: "inited", data: capabilities });
        await init;
        const pending = host.runtime.resolve({ song: 1 });
        await Promise.resolve();
        const error = pending.catch(reason => reason);
        jest.advanceTimersByTime(25_000);
        await expect(error).resolves.toHaveProperty("message", "播放地址解析超时");
        expect(host.runtime.disposed).toBe(true);
    });
});
