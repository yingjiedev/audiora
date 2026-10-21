import { getQualityKeys, getPluginQualityScope } from "@/utils/qualities";
import { resolveSourceProvider, toScriptMusicInfo } from "./musicInfo";
import { getSourceRuntime } from "./runtime";
import { ScriptSourceError, ScriptSourceRecord, SourceProvider } from "./types";

export function sourcePlatform(id: string) {
    return `script-source:${id}`;
}

export function getSourceQualityScope(
    definition: IPlugin.IPluginDefine | undefined,
    item: IMusic.IMusicItemBase,
    override?: SourceProvider | null,
    providerId?: string,
): string[] {
    if (!definition?.scriptSource) {
        return getPluginQualityScope(definition);
    }
    try {
        const provider = resolveSourceProvider(item, override, providerId);
        const declared = definition.scriptSource.providers[provider]?.qualitys ?? [];
        return getQualityKeys().filter(quality => declared.includes(quality));
    } catch {
        return [];
    }
}

export function createSourceDefinition(
    record: ScriptSourceRecord,
    getProvider: (item: IMusic.IMusicItemBase) => SourceProvider | undefined,
): IPlugin.IPluginDefine {
    const definition: IPlugin.IPluginDefine = {
        platform: sourcePlatform(record.id),
        // Third-party metadata stays in the record and script context.
        version: record.revision.slice(0, 8),
        srcUrl: record.srcUrl,
        cacheControl: "no-cache",
        qualityMode: "extended",
        supportedQualities: Array.from(new Set(Object.values(record.providers).flatMap(value => value.qualitys))),
        scriptSource: {
            id: record.id, revision: record.revision,
            displayName: record.displayName, providers: record.providers,
        },
        async getMediaSource(item, quality) {
            const provider = resolveSourceProvider(item, getProvider(item));
            const musicInfo = toScriptMusicInfo(item, provider);
            if (!record.providers[provider]?.qualitys.includes(quality)) {
                throw new ScriptSourceError(record.providers[provider]
                    ? "自定义音源不支持该音质" : "自定义音源不支持该平台");
            }
            const runtime = getSourceRuntime(record);
            const providers = await runtime.initialize();
            definition.scriptSource!.providers = providers;
            if (!providers[provider]) {
                throw new ScriptSourceError("自定义音源不支持该平台");
            }
            if (!providers[provider]!.qualitys.includes(quality)) {
                throw new ScriptSourceError("自定义音源不支持该音质");
            }
            const url = await runtime.resolve({
                source: provider, action: "musicUrl",
                info: { type: quality, musicInfo },
            });
            return { url };
        },
    };
    return definition;
}
