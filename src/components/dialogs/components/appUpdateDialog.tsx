import React, { useRef } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ThemeText from "@/components/base/themeText";
import { radius, spacing } from "@/constants/designSystem";
import type { IAppRelease } from "@/core/appRelease";
import { getAppUpdateUrl } from "@/core/appUpdate";
import { appUpdate } from "@/core/appUpdateState";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import { sizeFormatter } from "@/utils/fileUtils";
import rpx, { fontRpx, vh } from "@/utils/rpx";
import { hideDialog } from "../useDialog";
import Dialog from "./base";

/** Confirmation only. Closing this sheet never owns or cancels a task. */
export default function AppUpdateDialog({ release }: { release: IAppRelease }) {
    const { t } = useI18N();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const confirmed = useRef(false);
    const canDownload = Boolean(getAppUpdateUrl(release));
    const metadata = release.downloadSize
        ? `${release.version} · ${sizeFormatter(release.downloadSize)}` : release.version;

    function confirm() {
        if (confirmed.current || !canDownload) {
            return;
        }
        confirmed.current = true;
        appUpdate.start(release);
        hideDialog();
    }

    return (
        <Dialog placement="bottom" onDismiss={hideDialog} containerStyle={styles.sheet}>
            <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.xxl) }]}>
                <ThemeText fontWeight="semibold" style={styles.title}>
                    {t("checkUpdate.foundNewVersion")}
                </ThemeText>
                <ThemeText fontColor="textSecondary" style={styles.metadata}>
                    {metadata}
                </ThemeText>
                {release.changeLog.length > 0 ? (
                    <ScrollView style={styles.notes} contentContainerStyle={styles.notesContent}>
                        {release.changeLog.map((item, index) => (
                            <ThemeText key={`${index}-${item}`} style={styles.releaseLine}>
                                {item}
                            </ThemeText>
                        ))}
                    </ScrollView>
                ) : null}
                {!canDownload ? (
                    <ThemeText fontColor="textSecondary" style={styles.notes}>
                        {t("checkUpdate.error.noDownload")}
                    </ThemeText>
                ) : null}
                <View style={styles.actions}>
                    <TouchableOpacity accessibilityRole="button" onPress={hideDialog} style={styles.later}>
                        <ThemeText color={colors.primaryText}>{t("checkUpdate.later")}</ThemeText>
                    </TouchableOpacity>
                    {canDownload ? (
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={confirm}
                            style={[styles.update, { backgroundColor: colors.tonalSurface }]}>
                            <ThemeText color={colors.onTonal} fontWeight="medium">
                                {t("checkUpdate.updateNow")}
                            </ThemeText>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </Dialog>
    );
}

const styles = StyleSheet.create({
    sheet: {
        bottom: 0,
        width: "100%",
        maxWidth: 600,
        borderRadius: 0,
        borderTopLeftRadius: radius.sheet,
        borderTopRightRadius: radius.sheet,
        borderWidth: 0,
        elevation: 0,
        shadowOpacity: 0,
        overflow: "hidden",
    },
    content: {
        paddingHorizontal: spacing.xxxl,
        paddingTop: spacing.xxxl,
    },
    title: {
        fontSize: fontRpx(36),
        lineHeight: fontRpx(50),
    },
    metadata: {
        marginTop: spacing.xs,
        fontSize: fontRpx(26),
    },
    notes: {
        marginTop: spacing.xxxl,
        maxHeight: vh(32),
        flexShrink: 1,
    },
    notesContent: {
        gap: spacing.xs,
    },
    releaseLine: {
        lineHeight: fontRpx(44),
    },
    actions: {
        flexDirection: "row",
        gap: spacing.xl,
        marginTop: spacing.xxxl,
    },
    later: {
        flex: 0.8,
        minHeight: Math.max(44, rpx(88)),
        justifyContent: "center",
        alignItems: "center",
    },
    update: {
        flex: 1,
        minHeight: Math.max(44, rpx(88)),
        borderRadius: radius.pill,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.xl,
    },
});
