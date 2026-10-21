jest.mock("@/utils/log", () => ({ devLog: jest.fn() }));
import { isScriptSourceCode, parseCapabilities, parseScriptInfo, readSourceRecord, scriptRevision } from "./metadata";

describe("custom source metadata", () => {
    it("recognizes event scripts, legacy aliases and escaped host properties", () => {
        expect(isScriptSourceCode("const api = globalThis.lx;")).toBe(true);
        expect(isScriptSourceCode("window['lx'].send('inited', {});")).toBe(true);
        expect(isScriptSourceCode(String.raw`globalThis['\x6c\x78']`)).toBe(true);
        expect(isScriptSourceCode("/*!\n * @name Bundled\n */\nfunction bundled(){ module.exports = {}; }" )).toBe(true);
    });

    it("keeps CommonJS music plugins on their existing installation path", () => {
        expect(isScriptSourceCode("/**\n * @name Catalog\n */\nmodule.exports = { platform: 'catalog', search(){} };" )).toBe(false);
        expect(isScriptSourceCode({ sources: {} })).toBe(false);
    });

    it("preserves arbitrary versions and non-URL homepage metadata", () => {
        const info = parseScriptInfo("\uFEFF/*!\r\n * @name Example\r\n * @version release 9 custom\r\n * @homepage Updates here\r\n */");
        expect(info).toMatchObject({ name: "Example", version: "release 9 custom", homepage: "Updates here", author: "" });
    });

    it("does not consume the next annotation when a metadata field is blank", () => {
        const info = parseScriptInfo("/**\n * @name Example\n * @description\n * @version custom version\n */");
        expect(info.description).toBe("");
        expect(info.version).toBe("custom version");
    });

    it("negotiates each platform separately and ignores unsupported extensions", () => {
        expect(parseCapabilities({ sources: {
            kw: { type: "music", actions: ["musicUrl"], qualitys: ["flac24bit", "320k", "unknown"] },
            tx: { type: "music", actions: ["musicUrl", "lyric"], qualitys: ["master"] },
            qs: { type: "music", actions: ["musicSearch"], qualitys: ["flac"] },
        } })).toEqual({ kw: { qualitys: ["320k", "flac24bit"] }, tx: { qualitys: ["master"] } });
        expect(() => parseCapabilities({ sources: { kw: { type: "music", actions: ["search"], qualitys: ["320k"] } } })).toThrow("播放解析能力");
    });

    it("validates persisted records and recomputes their content revision", () => {
        const script = "/**\n * @name Example\n */\nwindow.lx";
        const record = readSourceRecord(JSON.stringify({
            format: "audiora-script-source-v1", id: "test-id", revision: "stale", displayName: "Custom source 1",
            script, srcUrl: "file:///private", providers: { wy: { qualitys: ["320k"] } },
        }));
        expect(record.revision).toBe(scriptRevision(script));
        expect(record.srcUrl).toBeUndefined();
        expect(() => readSourceRecord(JSON.stringify({ ...record, id: "../invalid" }))).toThrow();
        expect(() => readSourceRecord(JSON.stringify({ ...record, script: "<html>page</html>" }))).toThrow();
    });
});
