import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import { radius, spacing } from "@/constants/designSystem";
import type { IAppRelease } from "@/core/appRelease";
import { downloadAppUpdate, getAppUpdateUrl, type IAppUpdateProgress } from "@/core/appUpdate";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import NativeUtils from "@/native/utils";
import { sizeFormatter } from "@/utils/fileUtils";
import rpx, { vh } from "@/utils/rpx";
import { hideDialog } from "../useDialog";
import Dialog from "./base";

type UpdatePhase = "prompt" | "downloading" | "installing" |
    "downloadFailed" | "installFailed" | "permissionDenied" | "invalidPackage";

export default function AppUpdateDialog({ release }: { release: IAppRelease }) {
    const { t } = useI18N();
    const colors = useColors();
    const [phase, setPhase] = useState<UpdatePhase>("prompt");
    const [progress, setProgress] = useState<IAppUpdateProgress | null>(null);
    const [confirmCancel, setConfirmCancel] = useState(false);
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

    const dismiss = useCallback(() => {
        mounted.current = false;
        downloadTask.current?.cancel();
        downloadTask.current = null;
        hideDialog();
    }, []);

    // Backdrop and Android back presses share this handler. Check the ref as
    // well as the UI state so a tap immediately after starting cannot cancel.
    const dismissWhenIdle = useCallback(() => {
        if (!busy.current) {
            dismiss();
        }
    }, [dismiss]);

    async function install(path: string) {
        setConfirmCancel(false);
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
        if (busy.current || !mounted.current) {
            return;
        }
        busy.current = true;
        if (apkPath.current) {
            await install(apkPath.current);
            return;
        }

        setPhase("downloading");
        setProgress(null);
        setConfirmCancel(false);
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
                setConfirmCancel(false);
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
    const percent = progress?.contentLength
        ? Math.min(100, Math.floor(progress.bytesWritten / progress.contentLength * 100))
        : null;
    const statusTitle = errorKey
        ? t(phase === "downloadFailed" ? "checkUpdate.downloadFailedTitle" : "checkUpdate.installFailedTitle")
        : isInstalling ? t("checkUpdate.preparingInstall")
            : progress === null ? t("checkUpdate.selectingDownload") : t("checkUpdate.downloadingTitle");
    const downloadSize = progress
        ? progress.contentLength
            ? `${sizeFormatter(progress.bytesWritten)} / ${sizeFormatter(progress.contentLength)}`
            : t("checkUpdate.downloadedSize", { size: sizeFormatter(progress.bytesWritten) })
        : null;

    const actions: Array<{ title: string; primary?: boolean; onPress: () => void }> = isDownloading
        ? confirmCancel ? [
            { title: t("checkUpdate.stopDownload"), onPress: dismiss },
            { title: t("checkUpdate.continueDownload"), primary: true, onPress: () => setConfirmCancel(false) },
        ] : [
            { title: t("checkUpdate.cancelDownload"), onPress: () => setConfirmCancel(true) },
        ]
        : isInstalling ? [] : [
            { title: t("common.cancel"), onPress: dismiss },
            ...(getAppUpdateUrl(release) ? [{
                title: apkPath.current ? t("checkUpdate.install")
                    : phase === "prompt" ? t("checkUpdate.download") : t("common.clickToRetry"),
                primary: true,
                onPress: startUpdate,
            }] : []),
        ];

    return (
        <Dialog onDismiss={dismissWhenIdle} containerStyle={styles.dialog}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={[styles.updateIcon, { backgroundColor: colors.tonalSurface }]}>
                        <Icon name="arrow-down-tray" size={rpx(40)} color={colors.onTonal} />
                    </View>
                    <View style={styles.heading}>
                        <ThemeText fontSize="description" fontColor="textSecondary">
                            {t("checkUpdate.title")}
                        </ThemeText>
                        <ThemeText fontSize="title" fontWeight="semibold" style={styles.title}>
                            {t("checkUpdate.newVersion", { version: release.version })}
                        </ThemeText>
                    </View>
                </View>

                {phase === "prompt" ? (
                    <>
                        {release.changeLog.length > 0 ? (
                            <View style={[styles.statusCard, { backgroundColor: colors.cardInset }]}>
                                <ThemeText fontWeight="semibold" color={colors.onCardInset} style={styles.notesTitle}>
                                    {t("checkUpdate.releaseNotes")}
                                </ThemeText>
                                <Dialog.Content needScroll style={styles.releaseNotes}>
                                    {release.changeLog.map((item, index) => (
                                        <View key={`${index}-${item}`} style={styles.releaseLine}>
                                            <ThemeText color={colors.onCardInsetSecondary} style={styles.bullet}>
                                                {"•"}
                                            </ThemeText>
                                            <ThemeText color={colors.onCardInsetSecondary} style={styles.releaseText}>
                                                {item}
                                            </ThemeText>
                                        </View>
                                    ))}
                                </Dialog.Content>
                            </View>
                        ) : null}
                        {!getAppUpdateUrl(release) ? (
                            <ThemeText fontColor="textSecondary" style={styles.hint}>
                                {t("checkUpdate.error.noDownload")}
                            </ThemeText>
                        ) : null}
                    </>
                ) : (
                    <View style={[styles.statusCard, { backgroundColor: colors.cardInset }]}>
                        <View style={styles.statusHeading}>
                            <ThemeText fontWeight="semibold" color={colors.onCardInset} style={styles.statusTitle}>
                                {statusTitle}
                            </ThemeText>
                            {errorKey ? (
                                <Icon name="exclamation-circle" size={rpx(36)} color={colors.danger} />
                            ) : isInstalling || percent === null ? (
                                <ActivityIndicator color={colors.active} />
                            ) : (
                                <ThemeText
                                    testID="app-update-percentage"
                                    fontSize="title"
                                    fontWeight="bold"
                                    color={colors.onCardInset}>
                                    {`${percent}%`}
                                </ThemeText>
                            )}
                        </View>
                        {percent !== null ? (
                            <View
                                testID="app-update-progress"
                                accessibilityRole="progressbar"
                                accessibilityLabel={t("checkUpdate.downloadingTitle")}
                                accessibilityValue={{ min: 0, max: 100, now: percent }}
                                style={[styles.progressTrack, { backgroundColor: colors.tonalSurface }]}>
                                <View
                                    testID="app-update-progress-fill"
                                    style={[styles.progressFill, { width: `${percent}%`, backgroundColor: colors.active }]}
                                />
                            </View>
                        ) : null}
                        {downloadSize ? (
                            <ThemeText testID="app-update-size" fontSize="description" color={colors.onCardInsetSecondary} style={styles.downloadSize}>
                                {downloadSize}
                            </ThemeText>
                        ) : null}
                        {errorKey || isInstalling || confirmCancel ? (
                            <ThemeText
                                testID="app-update-message"
                                color={colors.onCardInsetSecondary}
                                style={styles.hint}>
                                {t(errorKey ?? (isInstalling ? "checkUpdate.installing" : "checkUpdate.cancelDownloadHint"))}
                            </ThemeText>
                        ) : null}
                    </View>
                )}

                {actions.length > 0 ? (
                    <View style={styles.actions}>
                        {actions.map(action => (
                            <TouchableOpacity
                                key={action.title}
                                accessibilityRole="button"
                                onPress={action.onPress}
                                activeOpacity={0.7}
                                style={[
                                    styles.button,
                                    { backgroundColor: action.primary ? colors.primary : colors.tonalSurface },
                                ]}>
                                <ThemeText fontWeight="semibold" color={action.primary ? colors.onPrimary : colors.onTonal}>
                                    {action.title}
                                </ThemeText>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : null}
            </View>
        </Dialog>
    );
}

const styles = StyleSheet.create({
    dialog: {
        borderRadius: radius.xl,
        maxWidth: 520,
        overflow: "hidden",
    },
    content: {
        padding: spacing.xxl,
        gap: spacing.xxl,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.lg,
    },
    updateIcon: {
        width: rpx(88),
        height: rpx(88),
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
    },
    heading: {
        flex: 1,
    },
    title: {
        marginTop: spacing.xs,
    },
    statusCard: {
        borderRadius: radius.md,
        padding: spacing.xl,
    },
    notesTitle: {
        marginBottom: spacing.md,
    },
    releaseNotes: {
        maxHeight: vh(26),
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
    releaseLine: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    bullet: {
        lineHeight: rpx(44),
    },
    releaseText: {
        flex: 1,
        lineHeight: rpx(44),
    },
    statusHeading: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
    },
    statusTitle: {
        flex: 1,
        lineHeight: rpx(42),
    },
    progressTrack: {
        height: rpx(12),
        borderRadius: radius.pill,
        overflow: "hidden",
        marginTop: spacing.xl,
    },
    progressFill: {
        height: "100%",
        borderRadius: radius.pill,
    },
    downloadSize: {
        marginTop: spacing.md,
        fontVariant: ["tabular-nums"],
    },
    hint: {
        marginTop: spacing.md,
        lineHeight: rpx(42),
    },
    actions: {
        flexDirection: "row",
        gap: spacing.lg,
    },
    button: {
        flex: 1,
        minHeight: rpx(88),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
});
