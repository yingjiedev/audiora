import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, ScrollView } from "react-native";
import AppBar from "@/components/base/appBar";
import StatusBar from "@/components/base/statusBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView";
import { PageAction } from "@/components/base/pageSection";
import SettingSection from "@/pages/setting/components/settingSection";
import SettingRow from "@/pages/setting/components/settingRow";
import globalStyle from "@/constants/globalStyle";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import downloadNotificationManager from "@/core/downloadNotificationManager";
export default function Permissions() {
    const appState = useRef(AppState.currentState);
    const [allowed, setAllowed] = useState(false);
    const { t } = useI18N();
    const alive = useRef(true);
    async function checkPermission() {
        const granted = await downloadNotificationManager.checkNotificationPermission();
        if (alive.current) setAllowed(granted);
    }
    useEffect(() => {
        alive.current = true;
        void checkPermission();
        const subscription = AppState.addEventListener("change", next => {
            if (appState.current.match(/inactive|background/) && next === "active") void checkPermission();
            appState.current = next;
        });
        return () => {
            alive.current = false; subscription.remove();
        };
    }, []);
    const openPermission = async () => {
        if (allowed) await Linking.openSettings();
        else await downloadNotificationManager.requestNotificationPermission();
        await checkPermission();
    };
    return <VerticalSafeAreaView style={globalStyle.fwflex1}>
        <StatusBar /><AppBar>{t("permissionSetting.title")}</AppBar>
        <HorizontalSafeAreaView style={globalStyle.flex1}>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
                <SettingSection title={t("permissionSetting.title")} description={t("permissionSetting.description")}>
                    <SettingRow title={t("permissionSetting.notificationPermission")} description={t("permissionSetting.notificationPermissionDescription")} descriptionLines={3}
                        value={t(allowed ? "subpage.permissionEnabled" : "subpage.permissionDisabled")}
                        right={<PageAction title={t("common.open")} onPress={openPermission} />} onPress={openPermission} />
                </SettingSection>
            </ScrollView>
        </HorizontalSafeAreaView>
    </VerticalSafeAreaView>;
}
