/**
 * 歌词格式规范化
 *
 * Audiora 不内置任何第三方平台的专用密钥、凭据或绕过逻辑。
 * 歌词内容由用户选择的插件或自建服务提供，本模块只负责把
 * 纯文本歌词（LRC / 带逐字时间的 XML）转换成统一的 LRC 文本，
 * 不做任何解密、不持有任何密钥材料。
 */

import { devLog } from "@/utils/log";
import { convertQrcXmlToLrc, convertQrcXmlToWordByWord, isQrcXml } from "@/utils/qrcXmlToLrc";

/**
 * 将歌词统一为标准 LRC 文本
 *
 * 仅处理纯文本形态：
 * - 带逐字时间轴的 XML 歌词 -> LRC（可选保留逐字时间轴）
 * - 其余内容原样返回
 *
 * @param lyrics - 插件或自建服务返回的歌词文本
 * @param enableWordByWord - 是否保留逐字时间戳（默认 false）
 * @returns Promise<string> - 规范化后的歌词文本
 */
export async function normalizeLyric(
    lyrics: string,
    enableWordByWord: boolean = false,
): Promise<string> {
    if (!lyrics) {
        return "";
    }

    if (isQrcXml(lyrics)) {
        devLog("info", "[歌词] 检测到逐字时间轴 XML，转换为 LRC", { enableWordByWord });
        return enableWordByWord
            ? convertQrcXmlToWordByWord(lyrics)
            : convertQrcXmlToLrc(lyrics);
    }

    return lyrics;
}
