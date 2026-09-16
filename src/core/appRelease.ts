import axios from "axios";
import { compare } from "compare-versions";
import DeviceInfo from "react-native-device-info";

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

export async function checkAppRelease() {
    const { data } = await axios.get<IAppRelease>(RELEASE_URL, {
        timeout: 12_000,
    });
    const currentVersion = normalizeVersion(DeviceInfo.getVersion());
    const latestVersion = normalizeVersion(data.version);

    if (!latestVersion || !Array.isArray(data.changeLog)) {
        throw new Error("Invalid release metadata");
    }

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
    const { data } = await axios.get<IAnnouncementsPayload>(ANNOUNCEMENTS_URL, {
        timeout: 12_000,
    });

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
