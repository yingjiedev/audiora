import { Button } from "@/components/base/button";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { getWebdavBackupStatus } from "@/core/webdavBackup";
import PersistStatus from "@/utils/persistStatus";
import rpx, { vh } from "@/utils/rpx";
import dayjs from "dayjs";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PanelBase from "../base/panelBase";
import PanelHeader from "../base/panelHeader";
import { hidePanel } from "../usePanel";

export default function WebdavBackupInfo({ showFailure = false }: { showFailure?: boolean }) {
    const { t } = useI18N();
    const insets = useSafeAreaInsets();
    PersistStatus.useValue("backup.webdavStatus");
    const status = getWebdavBackupStatus();
    const hasFailure = showFailure && status?.result === "failed";

    return (
        <PanelBase
            height={vh(65)}
            renderBody={() => (
                <>
                    <PanelHeader title={t("backupAndResume.webdavBackupHelp")} hideButtons />
                    <ScrollView
                        style={styles.scroll}
                        contentContainerStyle={styles.content}>
                        {hasFailure ? (
                            <View style={styles.section}>
                                <ThemeText>
                                    {t("backupAndResume.webdavBackupFailed", {
                                        time: dayjs(status.lastAttemptAt).format("YYYY-MM-DD HH:mm"),
                                    })}
                                </ThemeText>
                            </View>
                        ) : null}
                        <View style={styles.section}>
                            <ThemeText fontWeight="bold" style={styles.heading}>
                                {t("backupAndResume.webdavAutoBackup")}
                            </ThemeText>
                            <ThemeText>{t("backupAndResume.webdavAutoDescription")}</ThemeText>
                        </View>
                        <View>
                            <ThemeText fontWeight="bold" style={styles.heading}>
                                {t("backupAndResume.webdavBackupScope")}
                            </ThemeText>
                            <ThemeText selectable>{t("backupAndResume.webdavBackupContents")}</ThemeText>
                        </View>
                    </ScrollView>
                    <View style={[styles.footer, { paddingBottom: insets.bottom + rpx(24) }]}>
                        <Button text={t("common.confirm")} onPress={hidePanel} />
                    </View>
                </>
            )}
        />
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    content: {
        padding: rpx(24),
    },
    section: {
        marginBottom: rpx(32),
    },
    heading: {
        marginBottom: rpx(12),
    },
    footer: {
        paddingTop: rpx(16),
        paddingHorizontal: rpx(24),
    },
});
