export const SOURCE_PROVIDERS = ["kw", "kg", "tx", "wy", "mg"] as const;
export type SourceProvider = typeof SOURCE_PROVIDERS[number];

export interface ScriptInfo {
    name: string;
    description: string;
    version: string;
    author: string;
    homepage: string;
}

export interface SourceCapability {
    qualitys: string[];
}

export type SourceCapabilities = Partial<Record<SourceProvider, SourceCapability>>;

export interface ScriptSourceDescriptor {
    id: string;
    revision: string;
    displayName: string;
    providers: SourceCapabilities;
}

export interface ScriptSourceRecord extends ScriptSourceDescriptor {
    format: "audiora-script-source-v1";
    script: string;
    scriptInfo: ScriptInfo;
    srcUrl?: string;
    updatedAt?: number;
}

export function isSourceProvider(value: unknown): value is SourceProvider {
    return typeof value === "string" && SOURCE_PROVIDERS.includes(value as SourceProvider);
}

export class ScriptSourceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ScriptSourceError";
    }
}
