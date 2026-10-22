import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import { radius, spacing } from "@/constants/designSystem";
import { appUpdate } from "@/core/appUpdateState";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import { sizeFormatter } from "@/utils/fileUtils";
import rpx, { fontRpx } from "@/utils/rpx";

export default function AppUpdateStatus() {
    const state = appUpdate.state.useValue();
    const colors = useColors();
    const { t } = useI18N();
    if (state.phase === "idle") {
        return null;
    }
    const { release, progress, phase } = state;
    const downloading = phase === "downloading" || phase === "cancelling";
    const busy = phase === "cancelling" || phase === "installing";
    const total = progress?.contentLength ?? release.downloadSize;
    const percent = total && progress
        ? Math.max(0, Math.min(100, Math.floor(progress.bytesWritten / total * 100))) : null;
    const size = total ?? progress?.bytesWritten;
    const metadata = size ? `${release.version} · ${sizeFormatter(size)}` : release.version;
    const errorKey = phase === "downloadFailed" ? "checkUpdate.error.downloadFailed"
        : phase === "permissionDenied" ? "checkUpdate.error.installPermission"
            : phase === "invalidPackage" ? "checkUpdate.error.invalidPackage"
                : phase === "installFailed" ? "checkUpdate.error.installFailed" : null;

    return (
        <View testID="app-update-status" style={styles.container}>
            {downloading ? (
                <>
                    <View style={styles.row}>
                        <ThemeText style={styles.heading} fontWeight="medium">
                            {t("checkUpdate.downloadingVersion", { version: release.version })}
                        </ThemeText>
                        {percent !== null ? (
                            <ThemeText testID="app-update-percentage" color={colors.primaryText}>
                                {`${percent}%`}
                            </ThemeText>
                        ) : <ActivityIndicator color={colors.active} />}
                    </View>
                    <View
                        testID="app-update-progress"
                        accessibilityRole="progressbar"
                        accessibilityLabel={t("checkUpdate.downloadingTitle")}
                        accessibilityValue={percent === null
                            ? { text: t(progress ? "checkUpdate.downloadingTitle" : "checkUpdate.selectingDownload") }
                            : { min: 0, max: 100, now: percent }}
                        style={[styles.track, { backgroundColor: colors.tonalSurface }]}>
                        {percent !== null ? (
                            <View
                                testID="app-update-progress-fill"
                                style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.active }]}
                            />
                        ) : null}
                    </View>
                    <View style={styles.row}>
                        <ThemeText testID="app-update-size" fontSize="subTitle" fontColor="textSecondary" style={styles.detail}>
                            {progress ? total
                                ? `${sizeFormatter(progress.bytesWritten)} / ${sizeFormatter(total)}`
                                : sizeFormatter(progress.bytesWritten)
                                : t("checkUpdate.selectingDownload")}
                        </ThemeText>
                        <TouchableOpacity
                            accessibilityRole="button"
                            disabled={busy}
                            onPress={appUpdate.cancel}
                            style={styles.action}>
                            <ThemeText fontSize="subTitle" fontColor="textSecondary">
                                {t(busy ? "checkUpdate.cancelling" : "checkUpdate.cancelDownload")}
                            </ThemeText>
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                <>
                    <View style={styles.row}>
                        <View style={styles.detail}>
                            <ThemeText style={styles.heading}>
                                {t(phase === "downloadFailed" ? "checkUpdate.downloadFailedTitle"
                                    : phase === "invalidPackage" ? "checkUpdate.installFailedTitle"
                                        : "checkUpdate.packageDownloaded")}
                            </ThemeText>
                            <ThemeText fontSize="subTitle" fontColor="textSecondary" style={styles.metadata}>
                                {metadata}
                            </ThemeText>
                        </View>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityState={{ busy, disabled: busy }}
                            disabled={busy}
                            onPress={state.apkPath ? appUpdate.install : () => appUpdate.start(release)}
                            style={[styles.action, styles.install, { backgroundColor: colors.tonalSurface }]}>
                            {busy ? <ActivityIndicator color={colors.onTonal} /> : (
                                <ThemeText fontSize="subTitle" color={colors.onTonal}>
                                    {t(state.apkPath ? "checkUpdate.installNow" : "common.clickToRetry")}
                                </ThemeText>
                            )}
                        </TouchableOpacity>
                    </View>
                    {errorKey || busy ? (
                        <ThemeText testID="app-update-message" fontSize="subTitle" fontColor="textSecondary" style={styles.message}>
                            {t(errorKey ?? "checkUpdate.installing")}
                        </ThemeText>
                    ) : null}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.xxl,
        paddingTop: spacing.xxl,
        paddingBottom: spacing.md,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.xl,
    },
    heading: {
        flexShrink: 1,
        fontSize: fontRpx(30),
        lineHeight: fontRpx(42),
    },
    detail: {
        flex: 1,
        minWidth: 0,
        fontVariant: ["tabular-nums"],
    },
    track: {
        height: rpx(8),
        borderRadius: radius.pill,
        overflow: "hidden",
        marginTop: spacing.xl,
        marginBottom: spacing.xs,
    },
    fill: {
        height: "100%",
        borderRadius: radius.pill,
    },
    action: {
        width: rpx(160),
        flexShrink: 0,
        minHeight: Math.max(44, rpx(88)),
        alignItems: "center",
        justifyContent: "center",
    },
    metadata: {
        marginTop: spacing.xs,
    },
    install: {
        minHeight: Math.max(44, rpx(72)),
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
    },
    message: {
        marginTop: spacing.md,
        marginBottom: spacing.md,
        lineHeight: fontRpx(38),
    },
});
