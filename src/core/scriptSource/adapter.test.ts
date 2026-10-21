jest.mock("@/utils/log", () => ({ devLog: jest.fn() }));
jest.mock("./runtime", () => ({ getSourceRuntime: jest.fn() }));
import { createSourceDefinition, getSourceQualityScope } from "./adapter";
import { getSourceRuntime } from "./runtime";
import type { ScriptSourceRecord } from "./types";

const record: ScriptSourceRecord = {
    format: "audiora-script-source-v1", id: "fixture", revision: "revision", script: "script",
    displayName: "Custom source 1", providers: { tx: { qualitys: ["320k", "flac24bit"] }, wy: { qualitys: ["flac"] } },
    scriptInfo: { name: "Third-party name", author: "Author", version: "9 arbitrary", description: "Private", homepage: "" },
};

describe("custom source plugin adapter", () => {
    it("exposes only playback resolution and neutral metadata", () => {
        const definition = createSourceDefinition(record, () => "tx");
        expect(definition.search).toBeUndefined();
        expect(definition.author).toBeUndefined();
        expect(definition.description).toBeUndefined();
        expect(definition.platform).toBe("script-source:fixture");
        expect(definition.qualityMode).toBe("extended");
    });

    it("keeps per-platform quality scopes independent of the catalog plugin's four tiers", () => {
        const definition = createSourceDefinition(record, () => "tx");
        expect(getSourceQualityScope(definition, { id: "42", platform: "QQ音乐" })).toEqual(["320k", "flac24bit"]);
        expect(getSourceQualityScope(definition, { id: "42", platform: "网易云" })).toEqual(["flac"]);
        expect(getSourceQualityScope(definition, { id: "42", platform: "unknown" })).toEqual([]);
    });

    it("dispatches platform-native song IDs with the unchanged extended quality key", async () => {
        const resolve = jest.fn(async (_request: any) => "https://example.invalid/audio");
        (getSourceRuntime as jest.Mock).mockReturnValue({ initialize: async () => record.providers, resolve });
        const definition = createSourceDefinition(record, () => "tx");
        const result = await definition.getMediaSource!({ id: "42", songId: 42, songmid: "song-mid", title: "Song", platform: "Catalog" }, "flac24bit");
        expect(result).toEqual({ url: "https://example.invalid/audio" });
        expect(resolve.mock.calls[0][0]).toMatchObject({ source: "tx", action: "musicUrl", info: { type: "flac24bit", musicInfo: { id: 42, songmid: "song-mid" } } });
        await expect(definition.getMediaSource!({ id: "42", platform: "Catalog" }, "master")).rejects.toThrow("不支持该音质");
    });
});
