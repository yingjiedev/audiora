import Config from "@/core/appConfig";
import { backupToWebdav, getWebdavBackupStatus, getWebdavConfig } from "@/core/webdavBackup";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import NetInfo from "@react-native-community/netinfo";
import { AppState, AppStateStatus } from "react-native";

const DAY = 24 * 60 * 60 * 1000;
const CHECK_INTERVAL = 60_000;
const RETRY_INTERVAL = 15 * 60 * 1000;

/** Starts only after bootstrap has loaded sheets, configuration and plugins. */
export function startWebdavAutoBackup() {
    let disposed = false;
    let checking = false;
    let connected = false;
    let appState: AppStateStatus = AppState.currentState;
    let timer: ReturnType<typeof setInterval> | undefined;
    let configTimer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
        if (disposed || checking || appState !== "active" || !connected ||
            !Config.getConfig("backup.webdavAutoEnabled") || !getWebdavConfig()) {
            return;
        }
        const now = Date.now();
        const status = getWebdavBackupStatus();
        const interval = Config.getConfig("backup.webdavAutoInterval") === "weekly" ? 7 * DAY : DAY;
        const elapsed = (timestamp?: number) =>
            typeof timestamp === "number" && timestamp > 0 && timestamp <= now
                ? now - timestamp
                : Infinity;
        if (elapsed(status?.lastSuccessAt) < interval ||
            (status?.result === "failed" && elapsed(status.lastAttemptAt) < RETRY_INTERVAL)) {
            return;
        }
        checking = true;
        try {
            await backupToWebdav();
        } catch {
            // The shared uploader persists failure state; automatic work is silent.
        } finally {
            checking = false;
        }
    }

    function refresh() {
        if (timer !== undefined) {
            clearInterval(timer);
            timer = undefined;
        }
        if (!disposed && appState === "active") {
            void check();
            timer = setInterval(() => void check(), CHECK_INTERVAL);
        }
    }

    const appSubscription = AppState.addEventListener("change", state => {
        appState = state;
        refresh();
    });
    const unsubscribeNetwork = NetInfo.addEventListener(state => {
        // An unreachable public internet probe must not block a LAN WebDAV server.
        connected = state.isConnected !== false;
        refresh();
    });
    const configSubscription = getOrCreateMMKV("App.config").addOnValueChangedListener(key => {
        if (key.startsWith("webdav.") || key.startsWith("backup.webdavAuto")) {
            clearTimeout(configTimer);
            // Batch URL/username/password writes from the settings panel.
            configTimer = setTimeout(refresh, 0);
        }
    });
    refresh();

    return () => {
        disposed = true;
        clearInterval(timer);
        clearTimeout(configTimer);
        appSubscription.remove();
        unsubscribeNetwork();
        configSubscription.remove();
    };
}
