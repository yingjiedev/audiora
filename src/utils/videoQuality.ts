export type VideoQualityOption = IPlugin.IVideoQualityOption;
export type VideoQualityInput = string | VideoQualityOption;

function definedFields<T extends object>(value: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(value).filter(([, field]) => field !== undefined),
    ) as Partial<T>;
}

export function normalizeVideoQualityOption(
    input: VideoQualityInput,
): VideoQualityOption | null {
    if (typeof input === "string") {
        const key = input.trim();
        return key ? { key } : null;
    }

    const key = input.key?.trim();
    if (!key) {
        return null;
    }

    const label = input.label?.trim();
    return {
        ...definedFields(input),
        key,
        ...(label ? { label } : {}),
    };
}

export function getVideoQualityHeight(option: VideoQualityOption): number {
    if (option.height) {
        return option.height;
    }

    const name = `${option.key} ${option.label ?? ""}`;
    if (/(?:^|\W)8k(?:\W|$)/i.test(name)) {
        return 4320;
    }
    if (/(?:^|\W)4k(?:\W|$)/i.test(name)) {
        return 2160;
    }

    return Number.parseInt(
        name.match(/(?:^|[^0-9])(\d{3,4})p?(?:[^0-9]|$)/i)?.[1] ?? "0",
        10,
    );
}

export function getVideoDynamicRange(
    option: VideoQualityOption,
): IPlugin.VideoDynamicRange | undefined {
    if (option.dynamicRange) {
        return option.dynamicRange;
    }

    const description = `${option.key} ${option.label ?? ""} ${option.codec ?? ""}`;
    if (
        /dolby[\s_-]*vision|dovi|dvhe|dvh1|(?:^|[\s_-])dv(?:[\s_-]|$)|杜比视界/i.test(
            description,
        )
    ) {
        return "dolby-vision";
    }
    if (/hdr[\s_-]*10|hdr10\+|hdr|高动态范围/i.test(description)) {
        return "hdr10";
    }
    if (/(?:^|\W)sdr(?:\W|$)/i.test(description)) {
        return "sdr";
    }
    return undefined;
}

export function isHighFrameRate(option: VideoQualityOption): boolean {
    const description = `${option.key} ${option.label ?? ""}`;
    return (
        /hfr|high[\s_-]*frame|高帧/i.test(description) ||
        /(?:^|[^0-9])(60|90|120|144)\s*(?:fps|帧)(?:[^0-9]|$)/i.test(
            description,
        )
    );
}

function dynamicRangeRank(option: VideoQualityOption): number {
    switch (getVideoDynamicRange(option)) {
    case "dolby-vision":
        return 3;
    case "hdr10":
        return 2;
    case "sdr":
        return 1;
    default:
        return 0;
    }
}

/**
 * Merge qualities without allowing a later undefined field to erase metadata.
 * Sorting prioritizes resolution, then dynamic range, then HFR, width and
 * bitrate. This keeps a low-resolution HDR stream below a higher-resolution
 * stream while preferring richer variants at the same resolution.
 */
export function mergeVideoQualityOptions(
    ...groups: Array<VideoQualityInput[] | undefined>
): VideoQualityOption[] {
    const merged = new Map<string, VideoQualityOption>();

    groups.flatMap(group => group ?? []).forEach(input => {
        const option = normalizeVideoQualityOption(input);
        if (!option) {
            return;
        }
        const previous = merged.get(option.key);
        merged.set(option.key, {
            ...previous,
            ...definedFields(option),
        } as VideoQualityOption);
    });

    return [...merged.values()].sort((left, right) => {
        return (
            getVideoQualityHeight(right) - getVideoQualityHeight(left) ||
            dynamicRangeRank(right) - dynamicRangeRank(left) ||
            Number(isHighFrameRate(right)) - Number(isHighFrameRate(left)) ||
            (right.width ?? 0) - (left.width ?? 0) ||
            (right.bitrate ?? 0) - (left.bitrate ?? 0) ||
            right.key.localeCompare(left.key)
        );
    });
}

export function videoSourceQualityOption(
    source: IPlugin.IVideoSourceResult,
    fallbackKey?: string,
): VideoQualityOption | undefined {
    const key = source.videoQuality || fallbackKey;
    if (!key) {
        return undefined;
    }
    return {
        key,
        label: source.videoQuality || fallbackKey,
        width: source.width,
        height: source.height,
        bitrate: source.bitrate,
        size: source.size,
        codec: source.codec,
        mimeType: source.mimeType,
        dynamicRange: source.dynamicRange,
    };
}

export function getVideoQualityLabel(option: VideoQualityOption): string {
    return option.label || (option.height ? `${option.height}p` : option.key);
}

function formatBitrate(value: number): string {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)} Mbps`;
    }
    if (value >= 1_000) {
        return `${Math.round(value / 1_000)} kbps`;
    }
    return `${value} bps`;
}

function formatFileSize(value: number | string): string {
    if (typeof value === "string") {
        return value;
    }
    if (value >= 1024 * 1024 * 1024) {
        return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (value >= 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (value >= 1024) {
        return `${Math.round(value / 1024)} KB`;
    }
    return `${value} B`;
}

export function formatVideoQualityDetails(option: VideoQualityOption): string {
    const details: string[] = [];
    if (option.width && option.height) {
        details.push(`${option.width}x${option.height}`);
    } else if (option.height) {
        details.push(`${option.height}p`);
    }
    if (option.bitrate) {
        details.push(formatBitrate(option.bitrate));
    }
    if (option.size !== undefined && option.size !== null && option.size !== "") {
        details.push(formatFileSize(option.size));
    }

    const dynamicRange = getVideoDynamicRange(option);
    if (dynamicRange === "dolby-vision") {
        details.push("Dolby Vision");
    } else if (dynamicRange === "hdr10") {
        details.push("HDR10");
    }
    if (isHighFrameRate(option)) {
        details.push("HFR");
    }
    if (option.codec) {
        details.push(option.codec);
    }
    return [...new Set(details)].join(" · ");
}
