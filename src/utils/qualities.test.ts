import {
    OFFICIAL_QUALITY_SCOPE,
    fromOfficialQuality,
    getPluginQualityScope,
    isOfficialQualityKey,
    pickSupportedQuality,
    resolvePluginQualityMode,
    toOfficialQuality,
} from "./qualities";

describe("pickSupportedQuality", () => {
    it("returns undefined when the plugin declares nothing", () => {
        expect(pickSupportedQuality("master", undefined)).toBeUndefined();
        expect(pickSupportedQuality("master", [])).toBeUndefined();
    });

    it("keeps the preferred quality when the plugin declares it", () => {
        expect(pickSupportedQuality("320k", ["320k", "128k"])).toBe("320k");
    });

    it("steps down to the best declared quality below the preference", () => {
        // 默认音质 master，插件只声明到 320k：不该拿 master 去试
        expect(pickSupportedQuality("master", ["320k", "128k"])).toBe("320k");
        expect(pickSupportedQuality("flac", ["320k", "128k"])).toBe("320k");
    });

    it("falls back to a higher declared quality when nothing below exists", () => {
        expect(pickSupportedQuality("128k", ["320k", "flac"])).toBe("320k");
    });

    it("falls back to the first declared quality for unknown preferences", () => {
        // 自定义音质键不在标准列表里
        expect(pickSupportedQuality("custom-hd" as any, ["flac", "320k"])).toBe(
            "flac",
        );
    });
});

describe("官方协议 / 扩展协议判定", () => {
    it("only low/standard/high/super are official keys", () => {
        for (const key of ["low", "standard", "high", "super"]) {
            expect(isOfficialQualityKey(key)).toBe(true);
        }
        for (const key of ["128k", "320k", "flac", "master", "lossless", ""]) {
            expect(isOfficialQualityKey(key)).toBe(false);
        }
        expect(isOfficialQualityKey(undefined)).toBe(false);
    });

    it("treats a plugin without declaration as official", () => {
        // QQ 插件声明的是旧版 supportedAudioQuality，app 不解析 → 落到官方模式
        expect(resolvePluginQualityMode(undefined)).toBe("official");
        expect(resolvePluginQualityMode({})).toBe("official");
        expect(
            resolvePluginQualityMode({
                supportedQualities: ["low", "standard", "high", "super"],
            }),
        ).toBe("official");
    });

    it("treats a plugin declaring extended keys as extended", () => {
        expect(
            resolvePluginQualityMode({
                supportedQualities: ["128k", "320k", "flac", "master"],
            }),
        ).toBe("extended");
        // 混合声明里只要有一个扩展键就算扩展
        expect(
            resolvePluginQualityMode({
                supportedQualities: ["low", "master"],
            }),
        ).toBe("extended");
    });

    it("honours a cached qualityMode over re-detection", () => {
        expect(
            resolvePluginQualityMode({
                qualityMode: "official",
                supportedQualities: ["master"],
            }),
        ).toBe("official");
    });
});

describe("音质键映射（app 内部 ⇄ MusicFree 官方）", () => {
    it("maps internal keys down to the 4 official keys", () => {
        expect(toOfficialQuality("96k")).toBe("low");
        expect(toOfficialQuality("128k")).toBe("low");
        expect(toOfficialQuality("192k")).toBe("standard");
        expect(toOfficialQuality("320k")).toBe("high");
        expect(toOfficialQuality("flac")).toBe("super");
        expect(toOfficialQuality("master")).toBe("super");
        // 官方键原样透传
        expect(toOfficialQuality("super")).toBe("super");
    });

    it("maps official keys back to internal keys", () => {
        expect(fromOfficialQuality("low")).toBe("128k");
        expect(fromOfficialQuality("standard")).toBe("192k");
        expect(fromOfficialQuality("high")).toBe("320k");
        expect(fromOfficialQuality("super")).toBe("flac");
        expect(fromOfficialQuality("master")).toBe("master");
    });
});

describe("getPluginQualityScope", () => {
    it("narrows to the official 4 tiers for official plugins", () => {
        expect(getPluginQualityScope(undefined)).toEqual(OFFICIAL_QUALITY_SCOPE);
        expect(getPluginQualityScope({})).toEqual(OFFICIAL_QUALITY_SCOPE);
        expect(getPluginQualityScope(undefined)).toEqual([
            "128k",
            "192k",
            "320k",
            "flac",
        ]);
    });

    it("keeps the declared tiers for extended plugins", () => {
        expect(
            getPluginQualityScope({
                supportedQualities: ["128k", "320k", "master"],
            }),
        ).toEqual(["128k", "320k", "master"]);
    });

    it("never returns a tier the plugin did not declare", () => {
        const scope = getPluginQualityScope({
            supportedQualities: ["128k", "320k", "flac"],
        });
        expect(scope).not.toContain("master");
        expect(scope).not.toContain("hires");
    });
});

describe("官方模式下的档位选择", () => {
    it("clamps the default preference into the official scope", () => {
        // 默认播放音质是 master，官方插件不认识 → 落在最高档 flac（发给插件即 super）
        expect(pickSupportedQuality("master", OFFICIAL_QUALITY_SCOPE)).toBe("flac");
        expect(toOfficialQuality("flac")).toBe("super");
    });
});
