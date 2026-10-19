import Config from "@/core/appConfig";
import Backup from "@/core/backup";
import PersistStatus from "@/utils/persistStatus";
import { AuthType, createClient } from "webdav";

const BACKUP_DIR = "/Audiora";
export const WEBDAV_BACKUP_FILE = `${BACKUP_DIR}/AudioraBackup.json`;
const REQUEST_TIMEOUT = 60_000;

export interface WebdavBackupStatus {
    url: string;
    username: string;
    lastSuccessAt?: number;
    lastAttemptAt: number;
    result: "success" | "failed";
}

export function getWebdavConfig() {
    const url = Config.getConfig("webdav.url")?.trim();
    const username = Config.getConfig("webdav.username")?.trim();
    const password = Config.getConfig("webdav.password");
    if (!url || !username || !password) {
        return null;
    }
    try {
        if (!["http:", "https:"].includes(new URL(url).protocol)) {
            return null;
        }
    } catch {
        return null;
    }
    return { url, username, password };
}

export function getWebdavBackupStatus() {
    const config = getWebdavConfig();
    const status = PersistStatus.get("backup.webdavStatus");
    return config && status?.url === config.url && status.username === config.username
        ? status
        : null;
}

let pending: {
    config: NonNullable<ReturnType<typeof getWebdavConfig>>;
    promise: Promise<void>;
} | null = null;

/** Manual and automatic backups share a single upload and success timestamp. */
export function backupToWebdav(): Promise<void> {
    const config = getWebdavConfig();
    if (!config) {
        return Promise.reject(new Error("WebDAV configuration is incomplete or invalid"));
    }
    if (pending) {
        if (JSON.stringify(pending.config) === JSON.stringify(config)) {
            return pending.promise;
        }
        // A destination change must wait for the old upload before starting.
        return pending.promise.catch(() => undefined).then(() => backupToWebdav());
    }

    const promise = Promise.resolve().then(async () => {
        const previous = getWebdavBackupStatus();
        let result: WebdavBackupStatus["result"] = "failed";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        try {
            const raw = await Backup.backup();
            const client = createClient(config.url, {
                authType: AuthType.Password,
                username: config.username,
                password: config.password,
            });
            if (!(await client.exists(BACKUP_DIR, { signal: controller.signal }))) {
                await client.createDirectory(BACKUP_DIR, { signal: controller.signal });
            }
            if (JSON.stringify(config) !== JSON.stringify(getWebdavConfig())) {
                throw new Error("WebDAV configuration changed during backup");
            }
            const uploaded = await client.putFileContents(WEBDAV_BACKUP_FILE, raw, {
                overwrite: true,
                signal: controller.signal,
            });
            if (!uploaded) {
                throw new Error("WebDAV backup upload failed");
            }
            result = "success";
        } finally {
            clearTimeout(timeout);
            // Never credit an upload to a newly selected server/account.
            if (JSON.stringify(config) === JSON.stringify(getWebdavConfig())) {
                const completedAt = Date.now();
                PersistStatus.set("backup.webdavStatus", {
                    url: config.url,
                    username: config.username,
                    lastAttemptAt: completedAt,
                    lastSuccessAt: result === "success" ? completedAt : previous?.lastSuccessAt,
                    result,
                });
            }
        }
    }).finally(() => {
        pending = null;
    });
    pending = { config, promise };
    return promise;
}
