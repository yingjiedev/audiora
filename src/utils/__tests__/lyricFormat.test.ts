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

        expect(result).toBe("[00:00.00]HelloWorld\n[00:02.00]SecondLine");
    });

    it("逐字模式保留逐字时间戳", async () => {
        const result = await normalizeLyric(WORD_TIMED_XML, true);

        expect(result).toBe(
            "[00:00.000]<00:00.000>Hello<00:00.200>World<00:00.500>\n" +
            "[00:02.000]<00:02.000>Second<00:02.200>Line<00:02.500>",
        );
    });
});

// 不识别、不解密不受支持的数据，避免改变插件提供的内容。
describe("normalizeLyric passthrough", () => {
    it.each([
        "0123456789abcdef".repeat(4),
        "dHA9Y29udGVudA0KDQplbmNvZGVkLWx5cmlj",
        "普通歌词\n第二行",
        "  [00:01.00]保留空白\r\n",
        "[00:01.000]<00:01.000>逐<00:01.500>字<00:02.000>",
        "<QrcInfos><LyricInfo LyricContent=\"unterminated",
        "<QrcInfos><LyricInfo LyricContent=\"\" /></QrcInfos>",
        "<other value=\"text\" />",
    ])("保留不需要转换或无法解析的内容 %s", async content => {
        await expect(normalizeLyric(content)).resolves.toBe(content);
        await expect(normalizeLyric(content, true)).resolves.toBe(content);
    });
});
