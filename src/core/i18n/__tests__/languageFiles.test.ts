import { readFileSync } from "fs";
import { join } from "path";
import enUS from "@/core/i18n/languages/en-us.json";
import zhCN from "@/core/i18n/languages/zh-cn.json";
import zhTW from "@/core/i18n/languages/zh-tw.json";

/**
 * 语言包是 `.json`，Metro / Jest 都走严格 `JSON.parse`：
 * 一行 `// 注释` 或尾逗号就能让整个语言包加载失败（表现为全站文案变成 key）。
 * 这里把「合法 JSON + 三语 key 对齐 + 无空文案」锁成断言。
 */
const languageFiles = [
    { locale: "zh-CN", file: "zh-cn.json", data: zhCN as Record<string, string> },
    { locale: "zh-TW", file: "zh-tw.json", data: zhTW as Record<string, string> },
    { locale: "en-US", file: "en-us.json", data: enUS as Record<string, string> },
];

const languagesDir = join(__dirname, "..", "languages");

describe("语言包文件", () => {
    it("每个语言包都是严格合法的 JSON（不允许注释、尾逗号）", () => {
        languageFiles.forEach(({ file }) => {
            const raw = readFileSync(join(languagesDir, file), "utf8");
            expect(() => JSON.parse(raw)).not.toThrow();
        });
    });

    it("每种语言的 key 集合完全一致", () => {
        const [base, ...rest] = languageFiles;
        const baseKeys = new Set(Object.keys(base.data));

        rest.forEach(({ locale, data }) => {
            const keys = new Set(Object.keys(data));
            // 少 key = 该语言下会回落成另一门语言；多 key = 拼写写错，都算失败
            const missing = [...baseKeys].filter(key => !keys.has(key));
            const extra = [...keys].filter(key => !baseKeys.has(key));
            expect({ locale, missing, extra }).toEqual({
                locale,
                missing: [],
                extra: [],
            });
        });
    });

    it("没有空文案或占位残留", () => {
        languageFiles.forEach(({ locale, data }) => {
            const empty = Object.entries(data)
                .filter(([, value]) => typeof value !== "string" || !value.trim())
                .map(([key]) => key);
            expect({ locale, empty }).toEqual({ locale, empty: [] });
        });
    });

    it("下载管理页需要的失败原因文案三语齐全", () => {
        const requiredKeys = [
            "downloading.title",
            "downloading.tab.downloading",
            "downloading.tab.completed",
            "downloading.tab.failed",
            "downloading.section.today",
            "downloading.section.yesterday",
            "downloading.downloadFailReason.networkOffline",
            "downloading.downloadFailReason.notAllowToDownloadInCellular",
            "downloading.downloadFailReason.noWritePermission",
            "downloading.downloadFailReason.failToFetchSource",
            "downloading.downloadFailReason.unknown",
        ];

        languageFiles.forEach(({ locale, data }) => {
            const missing = requiredKeys.filter(key => !data[key]);
            expect({ locale, missing }).toEqual({ locale, missing: [] });
        });
    });
});
