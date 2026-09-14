import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import DeviceInfo from "react-native-device-info";
import React from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import SettingSection from "../components/settingSection";
import SettingRow from "../components/settingRow";

interface ISettingsOverviewItem {
    key: string;
    title: string;
    value?: string;
    onPress: () => void;
}

interface ISettingsGroup {
    key: string;
    title: string;
    items: ISettingsOverviewItem[];
}

function SettingsOverviewItem(props: ISettingsOverviewItem) {
    const { title, value, onPress } = props;

    return (
        <SettingRow
            accessibilityLabel={title}
            title={title}
            value={value}
            onPress={onPress}
            showChevron
        />
    );
}

export default function SettingsOverview() {
    const navigate = useNavigate();
    const colors = useColors();
    const { t, getLanguage, getSupportedLanguages, setLanguage } = useI18N();
    const version = DeviceInfo.getVersion();

    function navigateToSetting(type: string, section?: string) {
        navigate(ROUTE_PATH.SETTING, { type, section });
    }

    function openLanguageDialog() {
        showDialog("RadioDialog", {
            content: getSupportedLanguages().map(item => ({
                title: item.name,
                value: item.locale,
                label: item.name,
            })),
            title: t("sidebar.languageSettings"),
            defaultSelected: getLanguage().locale,
            onOk(value) {
                setLanguage(value as string);
            },
        });
    }

    const playbackAndDownloadItems: ISettingsOverviewItem[] = [
        {
            key: "playback-options",
            title: t("settingsEntry.playback"),
            onPress: () => navigateToSetting("basic", "playback"),
        },
        {
            key: "network",
            title: t("settingsEntry.network"),
            onPress: () => navigateToSetting("basic", "network"),
        },
        {
            key: "timing-close",
            title: t("sidebar.scheduleClose"),
            onPress: () => showPanel("TimingClose"),
        },
        {
            key: "download-manager",
            title: t("home.downloadManagement"),
            onPress: () => navigate(ROUTE_PATH.DOWNLOADING),
        },
        {
            key: "download-options",
            title: t("settingsEntry.downloadOptions"),
            onPress: () => navigateToSetting("basic", "download"),
        },
    ];

    const sourceAndStorageItems: ISettingsOverviewItem[] = [
        {
            key: "cache",
            title: t("settingsEntry.cache"),
            onPress: () => navigateToSetting("basic", "cache"),
        },
        {
            key: "plugin-manager",
            title: t("sidebar.pluginManagement"),
            onPress: () => navigateToSetting("plugin"),
        },
        {
            key: "plugin-options",
            title: t("settingsEntry.pluginOptions"),
            onPress: () => navigateToSetting("basic", "plugin"),
        },
    ];

    const groups: ISettingsGroup[] = [
        {
            key: "playback-and-download",
            title: t("settingsGroup.playbackAndDownload"),
            items: playbackAndDownloadItems,
        },
        {
            key: "lyrics-and-appearance",
            title: t("settingsGroup.lyricsAndAppearance"),
            items: [
                {
                    key: "lyrics-options",
                    title: t("settingsEntry.lyrics"),
                    onPress: () => navigateToSetting("basic", "lyric"),
                },
                {
                    key: "theme",
                    title: t("sidebar.themeSettings"),
                    onPress: () => navigateToSetting("theme"),
                },
            ],
        },
        {
            key: "sources-and-storage",
            title: t("settingsGroup.sourcesAndStorage"),
            items: sourceAndStorageItems,
        },
        ...(Platform.OS === "android"
            ? [{
                key: "system-and-data",
                title: t("settingsGroup.systemAndData"),
                items: [
                    {
                        key: "permission-manager",
                        title: t("sidebar.permissionManagement"),
                        onPress: () => navigate(ROUTE_PATH.PERMISSIONS),
                    },
                    {
                        key: "backup-and-restore",
                        title: t("sidebar.backupAndResume"),
                        onPress: () => navigateToSetting("backup"),
                    },
                ],
            }]
            : [{
                key: "system-and-data",
                title: t("settingsGroup.systemAndData"),
                items: [{
                    key: "backup-and-restore",
                    title: t("sidebar.backupAndResume"),
                    onPress: () => navigateToSetting("backup"),
                }],
            }]),
        {
            key: "general",
            title: t("settingsGroup.general"),
            items: [
                {
                    key: "general-options",
                    title: t("settingsEntry.general"),
                    onPress: () => navigateToSetting("basic", "common"),
                },
                {
                    key: "sheet-options",
                    title: t("settingsEntry.sheetAndAlbum"),
                    onPress: () => navigateToSetting("basic", "sheetAndAlbum"),
                },
                {
                    key: "developer-options",
                    title: t("basicSettings.developer"),
                    onPress: () => navigateToSetting("basic", "developer"),
                },
                {
                    key: "language",
                    title: t("sidebar.languageSettings"),
                    value: getLanguage().name || t("settingsOverview.languageDescription"),
                    onPress: openLanguageDialog,
                },
            ],
        },
        {
            key: "about",
            title: t("settingsGroup.about"),
            items: [{
                key: "about-and-update",
                title: t("home.aboutAndUpdate"),
                value: t("about.version", { version }),
                onPress: () => navigateToSetting("about"),
            }],
        },
    ];

    return (
        <View style={[styles.wrapper, { backgroundColor: colors.pageBackground }]}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}>
                {groups.map(group => (
                    <SettingSection key={group.key} title={group.title}>
                        {group.items.map(item => {
                            const { key, ...itemProps } = item;
                            return (
                                <SettingsOverviewItem
                                    key={key}
                                    {...itemProps}
                                />
                            );
                        })}
                    </SettingSection>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, width: "100%" },
    content: {
        paddingBottom: rpx(60),
    },
});
