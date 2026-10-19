export type SearchFailureKind = "timeout" | "network" | "authentication" | "rateLimited" | "unavailable" | "configuration" | "invalidResponse" | "plugin";

/** Safe diagnostics only: never retain plugin messages, URLs, headers or credentials. */
export interface SearchFailure {
    kind: SearchFailureKind;
    retryable: boolean;
    status?: number;
}

export class SearchRequestError extends Error {
    constructor(public failure: SearchFailure) {
        super(failure.kind);
    }
}

export function classifySearchError(error: unknown): SearchFailure {
    if (error instanceof SearchRequestError) return error.failure;
    const value = error as { code?: string; message?: string; response?: { status?: number } } | null;
    const status = value?.response?.status;
    if (typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599) {
        const kind = status === 401 || status === 403 ? "authentication" : status === 408 ? "timeout" : status === 429 ? "rateLimited" : "unavailable";
        return { kind, retryable: status === 408 || status === 429 || status >= 500, status };
    }
    const code = value?.code;
    const message = typeof value?.message === "string" ? value.message : "";
    if (code === "ECONNABORTED" || code === "ETIMEDOUT" || /timed?\s*out|timeout/i.test(message)) {
        return { kind: "timeout", retryable: true };
    }
    if (["ERR_NETWORK", "ENOTFOUND", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN"].includes(code ?? "") || /network|offline|failed to fetch/i.test(message)) {
        return { kind: "network", retryable: true };
    }
    return { kind: "plugin", retryable: false };
}
