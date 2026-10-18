import axios from "axios";
import { compare, validate } from "compare-versions";
import DeviceInfo from "react-native-device-info";
import { raceGithubResource } from "./githubNetwork";

const RELEASE_URL =
    "https://raw.githubusercontent.com/yingjiedev/audiora/master/release/version.json";
const ANNOUNCEMENTS_URL =
    "https://raw.githubusercontent.com/yingjiedev/audiora/master/release/announcements.json";

export interface IAppRelease {
    version: string;
    changeLog: string[];
    download: string[];
}

export interface IAppAnnouncement {
    id: string;
    title: string;
    content: string[];
    priority?: number;
    minVersion?: string;
    maxVersion?: string;
    expireTime?: string;
    createTime?: string;
}

interface IAnnouncementsPayload {
    announcements: IAppAnnouncement[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === "string");
}

function isAppRelease(value: unknown): value is IAppRelease {
    return isRecord(value) &&
        typeof value.version === "string" &&
        validate(normalizeVersion(value.version)) &&
        isStringArray(value.changeLog) &&
        isStringArray(value.download) &&
        value.download.every(url => /^https:\/\/[^/\s]+\//.test(url));
}

function isAnnouncementsPayload(value: unknown): value is IAnnouncementsPayload {
    return isRecord(value) && Array.isArray(value.announcements) &&
        value.announcements.every(item => isRecord(item) &&
            typeof item.id === "string" && typeof item.title === "string" &&
            isStringArray(item.content) &&
            (item.priority === undefined ||
                (typeof item.priority === "number" && Number.isFinite(item.priority))) &&
            [item.minVersion, item.maxVersion, item.expireTime, item.createTime]
                .every(field => field === undefined || typeof field === "string"));
}

function getGithubJson<T>(
    url: string,
    isValid: (value: unknown) => value is T,
    signal?: AbortSignal,
) {
    const cacheKey = Date.now();
    return raceGithubResource(url, async (candidate, requestSignal) => {
        const { data } = await axios.get<unknown>(candidate, {
            timeout: 6_000,
            signal: requestSignal,
            headers: { "Cache-Control": "no-cache" },
            params: { _: cacheKey },
        });
        if (!isValid(data)) {
            throw new Error("Invalid GitHub metadata");
        }
        return data;
    }, signal);
}

function normalizeVersion(version: string) {
    return version.trim().replace(/^v/i, "");
}

function matchesVersion(announcement: IAppAnnouncement, version: string) {
    const normalizedVersion = normalizeVersion(version);

    try {
        return (
            (!announcement.minVersion ||
                compare(
                    normalizedVersion,
                    normalizeVersion(announcement.minVersion),
                    ">=",
                )) &&
            (!announcement.maxVersion ||
                compare(
                    normalizedVersion,
                    normalizeVersion(announcement.maxVersion),
                    "<=",
                ))
        );
    } catch {
        return false;
    }
}

function hasNotExpired(announcement: IAppAnnouncement, now: Date) {
    if (!announcement.expireTime) {
        return true;
    }

    const expireTime = Date.parse(announcement.expireTime);
    return Number.isFinite(expireTime) && expireTime >= now.getTime();
}

export async function checkAppRelease(signal?: AbortSignal) {
    const data = await getGithubJson(RELEASE_URL, isAppRelease, signal);
    const currentVersion = normalizeVersion(DeviceInfo.getVersion());
    const latestVersion = normalizeVersion(data.version);

    return {
        currentVersion,
        release: data,
        hasUpdate: compare(latestVersion, currentVersion, ">"),
    };
}

export async function getLatestAnnouncement(
    version = DeviceInfo.getVersion(),
    now = new Date(),
) {
    const data = await getGithubJson(ANNOUNCEMENTS_URL, isAnnouncementsPayload);

    return (data.announcements ?? [])
        .filter(item => hasNotExpired(item, now) && matchesVersion(item, version))
        .sort((left, right) => {
            const priority = (right.priority ?? 0) - (left.priority ?? 0);
            if (priority !== 0) {
                return priority;
            }
            const rightCreatedAt = Date.parse(right.createTime ?? "") || 0;
            const leftCreatedAt = Date.parse(left.createTime ?? "") || 0;
            return rightCreatedAt - leftCreatedAt;
        })[0] ?? null;
}
