import CryptoJS from "crypto-js";
import { BUILTIN_QUALITY_KEYS } from "@/utils/qualities";
import {
    ScriptInfo, ScriptSourceError, ScriptSourceRecord, SourceCapabilities,
    SOURCE_PROVIDERS,
} from "./types";

export function parseScriptInfo(script: string): ScriptInfo {
    const header = script.replace(/^\uFEFF/, "").match(/^\s*\/\*[!*]?[\s\S]*?\*\//)?.[0] ?? "";
    const read = (key: string) => header.match(new RegExp(`(?:^|\\n)[ \\t]*\\*?[ \\t]*@${key}[ \\t]+([^\\r\\n]*)`))?.[1]?.trim() ?? "";
    return {
        name: read("name"),
        description: read("description"),
        version: read("version"),
        author: read("author"),
        homepage: read("homepage"),
    };
}

/** Classification never executes code in the application runtime. */
export function isScriptSourceCode(script: unknown): script is string {
    if (typeof script !== "string") {
        return false;
    }
    const decoded = script.replace(/\\x([\da-f]{2})|\\u([\da-f]{4})/gi,
        (_match, hex, unicode) => String.fromCharCode(parseInt(hex ?? unicode, 16)));
    if (/(?:globalThis|window|global)\s*(?:\.\s*lx\b|\[\s*["']lx["']\s*\])/.test(decoded)) {
        return true;
    }
    // Bundled sources can conceal the host property and contain internal CJS exports.
    return !!parseScriptInfo(script).name &&
        !(/(?:module\s*\.\s*exports|exports\s*\.\s*default)\s*=/.test(decoded) &&
            /(?:\bplatform|["']platform["'])\s*:/.test(decoded));
}

export function scriptRevision(script: string): string {
    return CryptoJS.SHA256(script).toString();
}

export function validateScript(script: string) {
    if (typeof script !== "string" || !script.trim() || script.length > 1024 * 1024 || /^\s*<!?(?:doctype|html)/i.test(script)) {
        throw new ScriptSourceError("音源脚本内容无效或超过大小限制");
    }
}

export function parseCapabilities(raw: unknown): SourceCapabilities {
    const sources = raw && typeof raw === "object" ? (raw as any).sources : null;
    const providers: SourceCapabilities = {};
    for (const provider of SOURCE_PROVIDERS) {
        const entry = sources?.[provider];
        if (entry?.type !== "music" || !Array.isArray(entry.actions) ||
            !entry.actions.includes("musicUrl") || !Array.isArray(entry.qualitys)) {
            continue;
        }
        const qualitys = BUILTIN_QUALITY_KEYS.filter(key => entry.qualitys.includes(key));
        if (qualitys.length) {
            providers[provider] = { qualitys };
        }
    }
    if (!Object.keys(providers).length) {
        throw new ScriptSourceError("音源脚本没有声明可用的播放解析能力");
    }
    return providers;
}

export function readSourceRecord(content: string): ScriptSourceRecord {
    const record = JSON.parse(content) as ScriptSourceRecord;
    if (record?.format !== "audiora-script-source-v1" || typeof record.id !== "string" ||
        !/^[\w-]{1,100}$/.test(record.id) || typeof record.script !== "string" ||
        typeof record.displayName !== "string" || !record.displayName.trim()) {
        throw new ScriptSourceError("自定义音源记录无效");
    }
    validateScript(record.script);
    const providers = parseCapabilities({ sources: Object.fromEntries(
        Object.entries(record.providers ?? {}).map(([key, value]) => [key, {
            type: "music", actions: ["musicUrl"], qualitys: value.qualitys,
        }]),
    ) });
    return {
        ...record,
        revision: scriptRevision(record.script),
        scriptInfo: parseScriptInfo(record.script),
        srcUrl: /^https?:\/\//i.test(record.srcUrl ?? "") ? record.srcUrl : undefined,
        providers,
    };
}
