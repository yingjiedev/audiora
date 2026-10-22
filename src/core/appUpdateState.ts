import NativeUtils from "@/native/utils";
import { GlobalState } from "@/utils/stateMapper";
import type { IAppRelease } from "./appRelease";
import { downloadAppUpdate, type IAppUpdateProgress } from "./appUpdate";

type UpdatePhase = "downloading" | "cancelling" | "ready" | "installing" |
    "downloadFailed" | "installFailed" | "permissionDenied" | "invalidPackage";

export type AppUpdateState = { phase: "idle" } | {
    phase: UpdatePhase;
    release: IAppRelease;
    progress: IAppUpdateProgress | null;
    apkPath: string | null;
};

/** Owns the task for the app session; views only subscribe to its state. */
export class AppUpdateController {
    readonly state = new GlobalState<AppUpdateState>({ phase: "idle" });
    private activeDownload: {
        cancelled: boolean;
        task?: ReturnType<typeof downloadAppUpdate>;
    } | null = null;

    start = async (release: IAppRelease) => {
        const previous = this.state.getValue();
        if (this.activeDownload || previous.phase === "installing" ||
            (previous.phase !== "idle" && previous.apkPath && previous.release.version === release.version)) {
            return;
        }

        const operation: NonNullable<typeof this.activeDownload> = { cancelled: false };
        this.activeDownload = operation;
        let progress: IAppUpdateProgress | null = null;
        let apkPath: string | null = null;
        let phase: UpdatePhase = "ready";
        this.state.setValue({ phase: "downloading", release, progress, apkPath });
        try {
            operation.task = downloadAppUpdate(release, value => {
                if (this.activeDownload === operation && !operation.cancelled) {
                    progress = value;
                    this.state.setValue({ phase: "downloading", release, progress, apkPath: null });
                }
            });
            apkPath = await operation.task.promise;
        } catch {
            phase = "downloadFailed";
        } finally {
            this.activeDownload = null;
        }
        this.state.setValue(operation.cancelled
            ? { phase: "idle" }
            : { phase, release, progress, apkPath });
    };

    cancel = () => {
        const operation = this.activeDownload;
        const current = this.state.getValue();
        if (!operation || operation.cancelled || current.phase !== "downloading") {
            return;
        }
        operation.cancelled = true;
        // Wait for native cleanup before another download can reuse the file.
        this.state.setValue({ ...current, phase: "cancelling" });
        operation.task?.cancel();
    };

    install = async () => {
        const current = this.state.getValue();
        if (current.phase === "idle" || current.phase === "installing" || !current.apkPath) {
            return;
        }
        this.state.setValue({ ...current, phase: "installing" });
        try {
            await NativeUtils.installAppUpdate(current.apkPath);
            // Opening the installer does not mean the user installed the APK.
            this.state.setValue({ ...current, phase: "ready" });
        } catch (error) {
            const code = (error as { code?: string })?.code;
            this.state.setValue({
                ...current,
                phase: code === "AppUpdatePermissionDenied" ? "permissionDenied"
                    : code === "InvalidAppUpdate" ? "invalidPackage" : "installFailed",
                apkPath: code === "InvalidAppUpdate" ? null : current.apkPath,
            });
        }
    };
}

export const appUpdate = new AppUpdateController();
