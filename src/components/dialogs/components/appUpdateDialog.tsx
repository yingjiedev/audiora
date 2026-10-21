import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import Loading from "@/components/base/loading";
import type { IAppRelease } from "@/core/appRelease";
import { downloadAppUpdate, getAppUpdateUrl } from "@/core/appUpdate";
import { useI18N } from "@/core/i18n";
import NativeUtils from "@/native/utils";
import rpx from "@/utils/rpx";
import { hideDialog } from "../useDialog";
import Dialog from "./base";

type UpdatePhase = "prompt" | "downloading" | "installing" |
    "downloadFailed" | "installFailed" | "permissionDenied" | "invalidPackage";

export default function AppUpdateDialog({ release }: { release: IAppRelease }) {
    const { t } = useI18N();
    const [phase, setPhase] = useState<UpdatePhase>("prompt");
    const [progress, setProgress] = useState<number | null>(null);
    const apkPath = useRef<string | null>(null);
    const downloadTask = useRef<ReturnType<typeof downloadAppUpdate> | null>(null);
    const mounted = useRef(true);
    const busy = useRef(false);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            downloadTask.current?.cancel();
        };
    }, []);

    function dismiss() {
        mounted.current = false;
        downloadTask.current?.cancel();
        hideDialog();
    }

    async function install(path: string) {
        setPhase("installing");
        try {
            await NativeUtils.installAppUpdate(path);
            if (mounted.current) {
                hideDialog();
            }
        } catch (error) {
            if (mounted.current) {
                const code = (error as { code?: string })?.code;
                setPhase(code === "AppUpdatePermissionDenied"
                    ? "permissionDenied"
                    : code === "InvalidAppUpdate" ? "invalidPackage" : "installFailed");
                if (code === "InvalidAppUpdate") {
                    apkPath.current = null;
                }
            }
        } finally {
            busy.current = false;
        }
    }

    async function startUpdate() {
        if (busy.current) {
            return;
        }
        busy.current = true;
        if (apkPath.current) {
            await install(apkPath.current);
            return;
        }

        setPhase("downloading");
        setProgress(null);
        let path: string;
        try {
            const task = downloadAppUpdate(release, value => {
                if (mounted.current) {
                    setProgress(value);
                }
            });
            downloadTask.current = task;
            path = await task.promise;
            downloadTask.current = null;
        } catch {
            downloadTask.current = null;
            busy.current = false;
            if (mounted.current) {
                setPhase("downloadFailed");
            }
            return;
        }
        if (mounted.current) {
            apkPath.current = path;
            await install(path);
        }
    }

    const isInstalling = phase === "installing";
    const isDownloading = phase === "downloading";
    const errorKey = phase === "downloadFailed" ? "checkUpdate.error.downloadFailed"
        : phase === "permissionDenied" ? "checkUpdate.error.installPermission"
            : phase === "invalidPackage" ? "checkUpdate.error.invalidPackage"
                : phase === "installFailed" ? "checkUpdate.error.installFailed" : null;

    return (
        <Dialog onDismiss={isInstalling ? undefined : dismiss}>
            <Dialog.Title withDivider>
                {t("checkUpdate.newVersion", { version: release.version })}
            </Dialog.Title>
            <Dialog.Content needScroll={!isDownloading && !isInstalling}>
                {isDownloading || isInstalling ? (
                    <View style={styles.loading}>
                        <Loading text={isInstalling
                            ? t("checkUpdate.installing")
                            : t("checkUpdate.downloading", {
                                progress: progress === null ? "" : `${Math.floor(progress * 100)}%`,
                            })} />
                    </View>
                ) : errorKey ? (
                    <ThemeText>{t(errorKey)}</ThemeText>
                ) : (
                    <View>
                        {release.changeLog.map((item, index) => (
                            <ThemeText key={`${index}-${item}`} style={styles.releaseLine}>
                                {`${index + 1}. ${item}`}
                            </ThemeText>
                        ))}
                        {!getAppUpdateUrl(release) ? (
                            <ThemeText>{t("checkUpdate.error.noDownload")}</ThemeText>
                        ) : null}
                    </View>
                )}
            </Dialog.Content>
            {!isInstalling ? (
                <Dialog.Actions actions={[
                    { title: t("common.cancel"), onPress: dismiss },
                    {
                        title: apkPath.current ? t("checkUpdate.install")
                            : phase === "prompt" ? t("checkUpdate.download") : t("common.clickToRetry"),
                        type: "primary",
                        show: !isDownloading && !!getAppUpdateUrl(release),
                        onPress: startUpdate,
                    },
                ]} />
            ) : null}
        </Dialog>
    );
}

const styles = StyleSheet.create({
    loading: {
        height: rpx(240),
    },
    releaseLine: {
        marginBottom: rpx(8),
    },
});
