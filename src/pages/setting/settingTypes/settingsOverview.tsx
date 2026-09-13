import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import DeviceInfo from "react-native-device-info";
import React from "react";
import {
    Image,
    ImageBackground,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";

interface ISettingsOverviewItem {
    key: string;
    icon: IIconName;
    iconColor: string;
    title: string;
    description: string;
    onPress: () => void;
}

interface ISettingsGroup {
    key: string;
    title: string;
    items: ISettingsOverviewItem[];
}

function SettingsOverviewItem(
    props: ISettingsOverviewItem & { showDivider: boolean },
) {
    const { icon, iconColor, title, description, onPress, showDivider } = props;
    const colors = useColors();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            android_ripple={{ color: "rgba(62, 101, 255, 0.08)" }}
            onPress={onPress}
            style={({ pressed }) => [
                styles.item,
                showDivider ? {
                    borderBottomColor: colors.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                } : null,
                pressed ? styles.itemPressed : null,
            ]}>
            <View style={[styles.iconWrap, { backgroundColor: `${iconColor}1F` }]}>
                <Icon name={icon} size={rpx(34)} color={iconColor} />
            </View>
            <View style={styles.itemContent}>
                <ThemeText fontSize="subTitle" fontWeight="semibold" numberOfLines={1}>
                    {title}
                </ThemeText>
                <ThemeText
                    fontColor="textSecondary"
                    fontSize="description"
                    numberOfLines={2}
                    style={styles.itemDescription}>
                    {description}
                </ThemeText>
            </View>
            <Icon
                name="arrow-long-left"
                size={rpx(30)}
                color={colors.textSecondary}
                style={styles.chevron}
            />
        </Pressable>
    );
}

export default function SettingsOverview() {
    const navigate = useNavigate();
    const colors = useColors();
    const { t, getLanguage, getSupportedLanguages, setLanguage } = useI18N();
    const appName = DeviceInfo.getApplicationName();
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

    const groups: ISettingsGroup[] = [
        {
            key: "playback",
            title: t("settingsGroup.playback"),
            items: [
                {
                    key: "playback-options",
                    icon: "play-circle-outline",
                    iconColor: "#4D70F5",
                    title: t("settingsEntry.playback"),
                    description: t("settingsEntry.playbackDescription"),
                    onPress: () => navigateToSetting("basic", "playback"),
                },
                {
                    key: "network",
                    icon: "arrows-left-right",
                    iconColor: "#2B91D9",
                    title: t("settingsEntry.network"),
                    description: t("settingsEntry.networkDescription"),
                    onPress: () => navigateToSetting("basic", "network"),
                },
                {
                    key: "timing-close",
                    icon: "alarm-outline",
                    iconColor: "#7D63E8",
                    title: t("sidebar.scheduleClose"),
                    description: t("settingsEntry.timingCloseDescription"),
                    onPress: () => showPanel("TimingClose"),
                },
            ],
        },
        {
            key: "download",
            title: t("settingsGroup.download"),
            items: [
                {
                    key: "download-manager",
                    icon: "arrow-down-tray",
                    iconColor: "#18A986",
                    title: t("home.downloadManagement"),
                    description: t("home.downloadManagementDescription"),
                    onPress: () => navigate(ROUTE_PATH.DOWNLOADING),
                },
                {
                    key: "download-options",
                    icon: "folder-outline",
                    iconColor: "#1C9BCA",
                    title: t("settingsEntry.downloadOptions"),
                    description: t("settingsEntry.downloadOptionsDescription"),
                    onPress: () => navigateToSetting("basic", "download"),
                },
            ],
        },
        {
            key: "lyrics",
            title: t("settingsGroup.lyrics"),
            items: [{
                key: "lyrics-options",
                icon: "lyric",
                iconColor: "#E0629B",
                title: t("settingsEntry.lyrics"),
                description: t("settingsEntry.lyricsDescription"),
                onPress: () => navigateToSetting("basic", "lyric"),
            }],
        },
        {
            key: "appearance",
            title: t("settingsGroup.appearance"),
            items: [{
                key: "theme",
                icon: "t-shirt-outline",
                iconColor: "#6A64E8",
                title: t("sidebar.themeSettings"),
                description: t("settingsOverview.themeDescription"),
                onPress: () => navigateToSetting("theme"),
            }],
        },
        {
            key: "storage",
            title: t("settingsGroup.storage"),
            items: [{
                key: "cache",
                icon: "circle-stack",
                iconColor: "#1ABAA5",
                title: t("settingsEntry.cache"),
                description: t("settingsEntry.cacheDescription"),
                onPress: () => navigateToSetting("basic", "cache"),
            }],
        },
        {
            key: "sources",
            title: t("settingsGroup.sources"),
            items: [
                {
                    key: "plugin-manager",
                    icon: "javascript",
                    iconColor: "#3978FF",
                    title: t("sidebar.pluginManagement"),
                    description: t("settingsOverview.sourceDescription"),
                    onPress: () => navigateToSetting("plugin"),
                },
                {
                    key: "plugin-options",
                    icon: "cog-8-tooth",
                    iconColor: "#4F638D",
                    title: t("settingsEntry.pluginOptions"),
                    description: t("settingsEntry.pluginOptionsDescription"),
                    onPress: () => navigateToSetting("basic", "plugin"),
                },
            ],
        },
        ...(Platform.OS === "android"
            ? [{
                key: "permissions",
                title: t("settingsGroup.permissions"),
                items: [{
                    key: "permission-manager",
                    icon: "shield-keyhole-outline" as IIconName,
                    iconColor: "#3779F4",
                    title: t("sidebar.permissionManagement"),
                    description: t("settingsOverview.permissionDescription"),
                    onPress: () => navigate(ROUTE_PATH.PERMISSIONS),
                }],
            }]
            : []),
        {
            key: "backup",
            title: t("settingsGroup.backup"),
            items: [{
                key: "backup-and-restore",
                icon: "arrow-up-tray",
                iconColor: "#1ABAA5",
                title: t("sidebar.backupAndResume"),
                description: t("settingsOverview.backupDescription"),
                onPress: () => navigateToSetting("backup"),
            }],
        },
        {
            key: "general",
            title: t("settingsGroup.general"),
            items: [
                {
                    key: "general-options",
                    icon: "cog-8-tooth",
                    iconColor: "#4F638D",
                    title: t("settingsEntry.general"),
                    description: t("settingsEntry.generalDescription"),
                    onPress: () => navigateToSetting("basic", "common"),
                },
                {
                    key: "sheet-options",
                    icon: "playlist",
                    iconColor: "#8B64E8",
                    title: t("settingsEntry.sheetAndAlbum"),
                    description: t("settingsEntry.sheetAndAlbumDescription"),
                    onPress: () => navigateToSetting("basic", "sheetAndAlbum"),
                },
                {
                    key: "developer-options",
                    icon: "code-bracket-square",
                    iconColor: "#6F7C99",
                    title: t("basicSettings.developer"),
                    description: t("settingsEntry.developerDescription"),
                    onPress: () => navigateToSetting("basic", "developer"),
                },
                {
                    key: "language",
                    icon: "language",
                    iconColor: "#8257E7",
                    title: t("sidebar.languageSettings"),
                    description: getLanguage().name || t("settingsOverview.languageDescription"),
                    onPress: openLanguageDialog,
                },
            ],
        },
        {
            key: "about",
            title: t("settingsGroup.about"),
            items: [{
                key: "about-and-update",
                icon: "information-circle",
                iconColor: "#337DF7",
                title: t("home.aboutAndUpdate"),
                description: `${t("about.version", { version })} · ${t("settingsOverview.aboutDescription")}`,
                onPress: () => navigateToSetting("about"),
            }],
        },
    ];

    return (
        <View style={[styles.wrapper, { backgroundColor: colors.pageBackground }]}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}>
                <ThemeText fontSize="section" fontWeight="bold" style={styles.pageTitle}>
                    {t("common.setting")}
                </ThemeText>

                <ImageBackground
                    source={ImgAsset.settingsRibbonBackground}
                    resizeMode="cover"
                    imageStyle={styles.brandBackgroundImage}
                    style={styles.brandCard}>
                    <Image source={ImgAsset.logo} resizeMode="contain" style={styles.brandLogo} />
                    <View style={styles.brandText}>
                        <ThemeText color="#141B4E" fontSize="section" fontWeight="bold">
                            {appName}
                        </ThemeText>
                        <ThemeText color="#52627F" fontSize="description" style={styles.brandTagline}>
                            {t("settingsOverview.tagline")}
                        </ThemeText>
                    </View>
                </ImageBackground>

                {groups.map(group => (
                    <View key={group.key} style={styles.group}>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            fontWeight="bold"
                            style={styles.groupTitle}>
                            {group.title}
                        </ThemeText>
                        <View style={[styles.listCard, { backgroundColor: colors.surface }]}>
                            {group.items.map((item, index) => {
                                const { key, ...itemProps } = item;
                                return (
                                    <SettingsOverviewItem
                                        key={key}
                                        {...itemProps}
                                        showDivider={index < group.items.length - 1}
                                    />
                                );
                            })}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, width: "100%" },
    content: { paddingHorizontal: rpx(24), paddingTop: rpx(24), paddingBottom: rpx(60) },
    pageTitle: { marginBottom: rpx(22) },
    brandCard: {
        minHeight: rpx(154),
        borderRadius: rpx(26),
        overflow: "hidden",
        marginBottom: rpx(18),
        paddingHorizontal: rpx(28),
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EFF9FF",
    },
    brandBackgroundImage: { opacity: 0.84 },
    brandLogo: {
        width: rpx(82),
        height: rpx(82),
        borderRadius: rpx(22),
        marginRight: rpx(22),
    },
    brandText: { flex: 1, minWidth: 0 },
    brandTagline: { marginTop: rpx(8) },
    group: { marginTop: rpx(18) },
    groupTitle: { marginBottom: rpx(10), marginLeft: rpx(8) },
    listCard: { borderRadius: rpx(22), overflow: "hidden" },
    item: {
        minHeight: rpx(102),
        paddingHorizontal: rpx(18),
        flexDirection: "row",
        alignItems: "center",
    },
    itemPressed: { opacity: 0.68 },
    iconWrap: {
        width: rpx(58),
        height: rpx(58),
        borderRadius: rpx(18),
        alignItems: "center",
        justifyContent: "center",
        marginRight: rpx(18),
    },
    itemContent: { flex: 1, minWidth: 0 },
    itemDescription: { marginTop: rpx(6) },
    chevron: { transform: [{ rotate: "180deg" }], marginLeft: rpx(12) },
});
