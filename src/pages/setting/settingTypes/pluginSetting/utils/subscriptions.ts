export interface Subscription {
    name: string;
    url: string;
}

export function parseSubscriptions(value?: string): Subscription[] {
    const text = value?.trim();
    if (!text) {
        return [];
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        parsed = [{ url: text }];
    }
    if (!Array.isArray(parsed)) {
        throw new Error("Invalid subscription settings");
    }
    return parsed.map(item => {
        if (typeof item?.url !== "string" || !/^https?:\/\/\S+$/i.test(item.url.trim())) {
            throw new Error("Invalid subscription URL");
        }
        return { name: typeof item.name === "string" ? item.name.trim() : "", url: item.url.trim() };
    });
}

export function subscriptionName(item: Subscription): string {
    return item.name.trim() || item.url.match(/^https?:\/\/(?:[^/@]+@)?([^/?#]+)/i)?.[1] || item.url;
}
