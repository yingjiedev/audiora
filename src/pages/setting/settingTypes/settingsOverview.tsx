import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { showDialog } from "@/components/dialogs/useDialog";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx, { fontRpx } from "@/utils/rpx";
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
    icon: IIconName;
    iconColor: string;
    iconBackground: string;
    title: string;
    description: string;
    onPress: () => void;
}

function SettingsOverviewItem(props: ISettingsOverviewItem) {
    const {
        icon,
        iconColor,
        iconBackground,
        title,
        description,
        onPress,
    } = props;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            android_ripple={{ color: "rgba(62, 101, 255, 0.08)" }}
            onPress={onPress}
            style={({ pressed }) => [style.item, pressed ? style.itemPressed : null]}>
            <View style={[style.iconWrap, { backgroundColor: iconBackground }]}>
                <Icon name={icon} size={rpx(38)} color={iconColor} />
            </View>
            <View style={style.itemContent}>
                <ThemeText fontSize="subTitle" fontWeight="semibold" numberOfLines={1}>
                    {title}
                </ThemeText>
                <ThemeText
                    fontColor="textSecondary"
                    fontSize="description"
                    numberOfLines={1}
                    style={style.itemDescription}>
                    {description}
                </ThemeText>
            </View>
            <Icon name="arrow-long-left" size={rpx(34)} color="#9EA9C5" style={style.chevron} />
        </Pressable>
    );
}

export default function SettingsOverview() {
    const navigate = useNavigate();
    const colors = useColors();
    const { t, getLanguage, getSupportedLanguages, setLanguage } = useI18N();
    const appName = DeviceInfo.getApplicationName();
    const version = DeviceInfo.getVersion();

    function navigateToSetting(type: string) {
        navigate(ROUTE_PATH.SETTING, { type });
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

    const items: ISettingsOverviewItem[] = [
        {
            icon: "cog-8-tooth",
            iconColor: "#4F638D",
            iconBackground: "#EDF3FF",
            title: t("sidebar.basicSettings"),
            description: t("settingsOverview.generalDescription"),
            onPress: () => navigateToSetting("basic"),
        },
        {
            icon: "javascript",
            iconColor: "#3978FF",
            iconBackground: "#E9F2FF",
            title: t("sidebar.pluginManagement"),
            description: t("settingsOverview.sourceDescription"),
            onPress: () => navigateToSetting("plugin"),
        },
        {
            icon: "folder-music-outline",
            iconColor: "#7F63F4",
            iconBackground: "#F2EEFF",
            title: t("home.scanLocal"),
            description: t("settingsOverview.localDescription"),
            onPress: () => navigate(ROUTE_PATH.LOCAL),
        },
        {
            icon: "t-shirt-outline",
            iconColor: "#3187F5",
            iconBackground: "#EAF5FF",
            title: t("sidebar.themeSettings"),
            description: t("settingsOverview.themeDescription"),
            onPress: () => navigateToSetting("theme"),
        },
        ...(Platform.OS === "android"
            ? [{
                icon: "shield-keyhole-outline" as IIconName,
                iconColor: "#3779F4",
                iconBackground: "#ECF3FF",
                title: t("sidebar.permissionManagement"),
                description: t("settingsOverview.permissionDescription"),
                onPress: () => navigate(ROUTE_PATH.PERMISSIONS),
            }]
            : []),
        {
            icon: "circle-stack",
            iconColor: "#1ABAA5",
            iconBackground: "#E8FBF7",
            title: t("sidebar.backupAndResume"),
            description: t("settingsOverview.backupDescription"),
            onPress: () => navigateToSetting("backup"),
        },
        {
            icon: "language",
            iconColor: "#8257E7",
            iconBackground: "#F3EDFF",
            title: t("sidebar.languageSettings"),
            description: getLanguage().name || t("settingsOverview.languageDescription"),
            onPress: openLanguageDialog,
        },
        {
            icon: "information-circle",
            iconColor: "#337DF7",
            iconBackground: "#EBF4FF",
            title: `${t("common.about")} ${appName}`,
            description: `${t("about.version", { version })} · ${t("settingsOverview.aboutDescription")}`,
            onPress: () => navigateToSetting("about"),
        },
    ];

    return (
        <View style={[style.wrapper, { backgroundColor: colors.pageBackground }]}>
            <ScrollView
                contentContainerStyle={style.content}
                showsVerticalScrollIndicator={false}>
                <ThemeText fontSize="section" fontWeight="bold" style={style.pageTitle}>
                    {t("common.setting")}
                </ThemeText>

                <ImageBackground
                    source={ImgAsset.settingsRibbonBackground}
                    resizeMode="cover"
                    imageStyle={style.brandBackgroundImage}
                    style={style.brandCard}>
                    <View style={style.brandContent}>
                        <Image source={ImgAsset.logo} resizeMode="contain" style={style.brandLogo} />
                        <View style={style.brandText}>
                            <ThemeText color="#141B4E" fontSize="section" fontWeight="bold">
                                {appName}
                            </ThemeText>
                            <ThemeText color="#52627F" fontSize="description" style={style.brandTagline}>
                                {t("settingsOverview.tagline")}
                            </ThemeText>
                        </View>
                    </View>
                </ImageBackground>

                <View style={[style.listCard, { backgroundColor: colors.surface }]}>
                    {items.map(item => (
                        <SettingsOverviewItem key={item.title} {...item} />
                    ))}
                </View>

                <ImageBackground
                    source={ImgAsset.settingsRibbonBackground}
                    resizeMode="cover"
                    imageStyle={style.footerBackgroundImage}
                    style={style.footerCard}>
                    <ThemeText color="#4C6BDE" fontSize="subTitle" fontWeight="bold" style={style.footerText}>
                        {t("settingsOverview.footerLine1")}
                    </ThemeText>
                    <ThemeText color="#6179E8" fontSize="subTitle" fontWeight="bold" style={style.footerText}>
                        {t("settingsOverview.footerLine2")}
                    </ThemeText>
                    <ThemeText color="#586DEA" fontSize="subTitle" fontWeight="semibold" style={style.footerSignature}>
                        — {appName}
                    </ThemeText>
                </ImageBackground>
            </ScrollView>
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        flex: 1,
        width: "100%",
    },
    content: {
        paddingHorizontal: rpx(30),
        paddingTop: rpx(24),
        paddingBottom: rpx(60),
    },
    pageTitle: {
        marginBottom: rpx(26),
    },
    brandCard: {
        height: rpx(200),
        borderRadius: rpx(28),
        overflow: "hidden",
        justifyContent: "center",
        marginBottom: rpx(22),
        backgroundColor: "#EFF9FF",
    },
    brandBackgroundImage: {
        opacity: 0.84,
    },
    brandContent: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(38),
    },
    brandLogo: {
        width: rpx(100),
        height: rpx(100),
        borderRadius: rpx(26),
        marginRight: rpx(26),
    },
    brandText: {
        flex: 1,
    },
    brandTagline: {
        marginTop: rpx(10),
    },
    listCard: {
        borderRadius: rpx(28),
        overflow: "hidden",
        marginBottom: rpx(24),
        shadowColor: "#6C85B4",
        shadowOffset: { width: 0, height: rpx(8) },
        shadowOpacity: 0.09,
        shadowRadius: rpx(22),
        elevation: 2,
    },
    item: {
        minHeight: rpx(110),
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
    },
    itemPressed: {
        opacity: 0.68,
    },
    iconWrap: {
        width: rpx(68),
        height: rpx(68),
        borderRadius: rpx(20),
        alignItems: "center",
        justifyContent: "center",
        marginRight: rpx(22),
    },
    itemContent: {
        flex: 1,
        minWidth: 0,
    },
    itemDescription: {
        marginTop: rpx(8),
    },
    chevron: {
        transform: [{ rotate: "180deg" }],
        marginLeft: rpx(12),
    },
    footerCard: {
        minHeight: rpx(210),
        borderRadius: rpx(28),
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: rpx(30),
        backgroundColor: "#F0F7FF",
    },
    footerBackgroundImage: {
        opacity: 0.78,
        transform: [{ rotate: "180deg" }],
    },
    footerText: {
        lineHeight: fontRpx(38),
    },
    footerSignature: {
        marginTop: rpx(14),
    },
});
