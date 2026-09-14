import { describe, expect, it } from "@jest/globals";

import { normalizeLyric } from "../lyricFormat";

const WORD_TIMED_XML = `<?xml version="1.0" encoding="utf-8"?>
<QrcInfos>
<QrcHeadInfo><SaveTime>0</SaveTime></QrcHeadInfo>
<LyricInfo LyricContent="[0,1000]Hello(0,200)World(200,300)&#10;[2000,1200]Second(2000,200)Line(2200,300)&#10;" />
</QrcInfos>`;

describe("normalizeLyric", () => {
    it("空内容返回空字符串", async () => {
        await expect(normalizeLyric("")).resolves.toBe("");
    });

    it("标准 LRC 原样返回", async () => {
        const lrc = "[00:01.00]hello\n[00:02.50]world\n";
        await expect(normalizeLyric(lrc)).resolves.toBe(lrc);
    });

    it("把逐字时间轴 XML 转为 LRC", async () => {
        const result = await normalizeLyric(WORD_TIMED_XML);

        expect(result).not.toContain("<QrcInfos>");
        expect(result).toContain("Hello");
        expect(result).toContain("Second");
        expect(result).toMatch(/\[\d{2}:\d{2}\.\d{2,3}\]/);
    });

    it("逐字模式保留逐字时间戳", async () => {
        const result = await normalizeLyric(WORD_TIMED_XML, true);

        expect(result).not.toContain("<QrcInfos>");
        expect(result).toContain("Hello");
        expect(result).toContain("<00:");
    });
});
