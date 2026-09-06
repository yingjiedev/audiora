import FastImage from "@/components/base/fastImage";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import PageBackground from "@/components/base/pageBackground";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import {
    audioraGradient,
    radius,
    spacing,
} from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { useScheduleCloseCountDown } from "@/utils/scheduleClose";
import timeformat from "@/utils/timeformat";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import Color from "color";
import React, { memo, ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DeviceInfo from "react-native-device-info";
import LinearGradient from "react-native-linear-gradient";

interface ISettingOption {
    accent: string;
    icon: IIconName;
    title: string;
    trailing?: ReactNode;
    onPress?: () => void;
}

function SettingRow(props: ISettingOption & { isLast?: boolean }) {
    const { accent, icon, title, trailing, onPress, isLast } = props;
    const colors = useColors();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={onPress}
            style={({ pressed }) => [
                styles.settingRow,
                !isLast && {
                    borderBottomColor: colors.divider,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                pressed && { backgroundColor: colors.listActive },
            ]}>
            <View
                style={[
                    styles.settingIcon,
                    { backgroundColor: Color(accent).alpha(0.14).toString() },
                ]}>
                <Icon name={icon} size={rpx(34)} color={accent} />
            </View>
            <ThemeText
                numberOfLines={1}
                fontSize="subTitle"
                fontWeight="medium"
                style={styles.settingTitle}>
                {title}
            </ThemeText>
            {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
            <Icon
                name="arrow-left"
                size={rpx(28)}
                color={colors.textSecondary}
                style={styles.chevron}
            />
        </Pressable>
    );
}

function DrawerSection(props: { title: string; items: ISettingOption[] }) {
    const { title, items } = props;
    const colors = useColors();

    return (
        <View style={styles.section}>
            <ThemeText
                fontSize="caption"
                fontWeight="bold"
                fontColor="textSecondary"
                style={styles.sectionTitle}>
                {title.toUpperCase()}
            </ThemeText>
            <View
                style={[
                    styles.sectionSurface,
                    { backgroundColor: colors.surfaceElevated },
                ]}>
                {items.map((item, index) => (
                    <SettingRow
                        key={`${item.title}-${index}`}
                        {...item}
                        isLast={index === items.length - 1}
                    />
                ))}
            </View>
        </View>
    );
}

function HomeDrawer(props: any) {
    const navigate = useNavigate();
    const colors = useColors();
    const { t, getSupportedLanguages, getLanguage, setLanguage } = useI18N();
    const countDown = useScheduleCloseCountDown();

    const navigateToSetting = (settingType: string) => {
        navigate(ROUTE_PATH.SETTING, { type: settingType });
    };

    const basicSettings: ISettingOption[] = [
        {
            accent: colors.info ?? colors.primary,
            icon: "cog-8-tooth",
            title: t("sidebar.basicSettings"),
            onPress: () => navigateToSetting("basic"),
        },
        {
            accent: colors.primary,
            icon: "javascript",
            title: t("sidebar.pluginManagement"),
            onPress: () => navigateToSetting("plugin"),
        },
        {
            accent: colors.accentWarm ?? colors.primary,
            icon: "t-shirt-outline",
            title: t("sidebar.themeSettings"),
            onPress: () => navigateToSetting("theme"),
        },
    ];

    const otherSettings: ISettingOption[] = [
        {
            accent: colors.accentCool ?? colors.primary,
            icon: "alarm-outline",
            title: t("sidebar.scheduleClose"),
            trailing: countDown ? (
                <ThemeText fontSize="description" fontColor="textSecondary">
                    {timeformat(countDown)}
                </ThemeText>
            ) : undefined,
            onPress: () => showPanel("TimingClose"),
        },
        {
            accent: colors.success ?? colors.primary,
            icon: "circle-stack",
            title: t("sidebar.backupAndResume"),
            onPress: () => navigateToSetting("backup"),
        },
    ];

    if (Platform.OS === "android") {
        otherSettings.push({
            accent: colors.info ?? colors.primary,
            icon: "shield-keyhole-outline",
            title: t("sidebar.permissionManagement"),
            onPress: () => navigate(ROUTE_PATH.PERMISSIONS),
        });
    }

    otherSettings.push({
        accent: colors.accentWarm ?? colors.primary,
        icon: "language",
        title: t("sidebar.languageSettings"),
        trailing: (
            <ThemeText
                fontSize="description"
                fontColor="textSecondary"
                numberOfLines={1}>
                {getLanguage().name}
            </ThemeText>
        ),
        onPress: () => {
            showDialog("RadioDialog", {
                content: getSupportedLanguages().map(item => ({
                    title: item.name,
                    value: item.locale,
                    label: item.name,
                })),
                title: t("sidebar.languageSettings"),
                onOk(value) {
                    setLanguage(value as string);
                },
                defaultSelected: getLanguage().locale,
            });
        },
    });

    const appName = DeviceInfo.getApplicationName();
    const softwareSettings: ISettingOption[] = [
        {
            accent: colors.primary,
            icon: "information-circle",
            title: `${t("common.about")} ${appName}`,
            trailing: (
                <ThemeText fontSize="description" fontColor="textSecondary">
                    {DeviceInfo.getVersion()}
                </ThemeText>
            ),
            onPress: () => navigateToSetting("about"),
        },
    ];

    return (
        <>
            <PageBackground />
            <DrawerContentScrollView
                {...props}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}>
                <LinearGradient
                    colors={[...audioraGradient]}
                    start={{ x: 0, y: 0.2 }}
                    end={{ x: 1, y: 0.8 }}
                    style={styles.brandCard}>
                    <View style={styles.logoSurface}>
                        <FastImage
                            source={ImgAsset.logoTransparent}
                            style={styles.logo}
                        />
                    </View>
                    <View style={styles.brandCopy}>
                        <ThemeText
                            color="#FFFFFF"
                            fontSize="section"
                            fontWeight="bolder"
                            numberOfLines={1}>
                            {appName}
                        </ThemeText>
                        <ThemeText
                            color="rgba(255,255,255,0.82)"
                            fontSize="caption"
                            numberOfLines={1}
                            style={styles.brandCaption}>
                            MUSIC BEYOND BORDERS
                        </ThemeText>
                    </View>
                </LinearGradient>

                <DrawerSection
                    title={t("common.setting")}
                    items={basicSettings}
                />
                <DrawerSection
                    title={t("common.other")}
                    items={otherSettings}
                />
                <DrawerSection
                    title={t("common.software")}
                    items={softwareSettings}
                />
            </DrawerContentScrollView>
        </>
    );
}

export default memo(HomeDrawer);

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: spacing.md,
        paddingBottom: spacing.xxxl,
    },
    brandCard: {
        minHeight: rpx(184),
        marginHorizontal: spacing.md,
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.xl,
        borderRadius: radius.xl,
        flexDirection: "row",
        alignItems: "center",
        overflow: "hidden",
    },
    logoSurface: {
        width: rpx(88),
        height: rpx(88),
        borderRadius: radius.lg,
        backgroundColor: "rgba(255,255,255,0.9)",
        alignItems: "center",
        justifyContent: "center",
    },
    logo: {
        width: rpx(68),
        height: rpx(68),
    },
    brandCopy: {
        flex: 1,
        minWidth: 0,
        marginLeft: spacing.md,
    },
    brandCaption: {
        marginTop: spacing.xs,
        letterSpacing: rpx(1.2),
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        marginHorizontal: spacing.xl,
        marginBottom: spacing.xs,
        letterSpacing: rpx(1.2),
    },
    sectionSurface: {
        marginHorizontal: spacing.md,
        borderRadius: radius.lg,
        overflow: "hidden",
    },
    settingRow: {
        minHeight: rpx(96),
        marginLeft: spacing.md,
        paddingRight: spacing.md,
        flexDirection: "row",
        alignItems: "center",
    },
    settingIcon: {
        width: rpx(56),
        height: rpx(56),
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
    },
    settingTitle: {
        flex: 1,
        minWidth: 0,
        marginLeft: spacing.md,
    },
    trailing: {
        maxWidth: rpx(170),
        marginLeft: spacing.sm,
    },
    chevron: {
        marginLeft: spacing.sm,
        transform: [{ rotate: "180deg" }],
    },
});
