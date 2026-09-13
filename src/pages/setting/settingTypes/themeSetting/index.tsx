import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate, useParams } from "@/core/router";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Color from "color";
import React, { ComponentType } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import AppearanceTuning from "./appearanceTuning";
import Background from "./background";
import BackgroundTuning from "./backgroundTuning";
import CoverStyle from "./coverStyle";
import FontSetting from "./fontSetting";
import Mode from "./mode";
import SplashImage from "./splashImage";

interface IThemeSection {
    key: string;
    icon: IIconName;
    title: string;
    description: string;
    component: ComponentType;
}

export default function ThemeSetting() {
    const { section } = useParams<"setting">();
    const { t } = useI18N();
    const colors = useColors();
    const navigate = useNavigate();

    const sections: IThemeSection[] = [
        {
            key: "mode",
            icon: "sun-outline",
            title: t("themeSettings.displayStyle"),
            description: t("themeSettingsIndex.modeDescription"),
            component: Mode,
        },
        {
            key: "cover",
            icon: "album-outline",
            title: t("themeSettings.coverStyle"),
            description: t("themeSettingsIndex.coverDescription"),
            component: CoverStyle,
        },
        {
            key: "font",
            icon: "font-size",
            title: t("fontSetting.title"),
            description: t("themeSettingsIndex.fontDescription"),
            component: FontSetting,
        },
        {
            key: "theme",
            icon: "t-shirt-outline",
            title: t("themeSettings.setTheme"),
            description: t("themeSettingsIndex.themeDescription"),
            component: Background,
        },
        {
            key: "background",
            icon: "crosshair",
            title: t("themeSettings.backgroundTuning"),
            description: t("themeSettingsIndex.backgroundDescription"),
            component: BackgroundTuning,
        },
        {
            key: "splash",
            icon: "motion-play",
            title: t("themeSettings.splashImage"),
            description: t("themeSettings.splashImageDesc"),
            component: SplashImage,
        },
        {
            key: "appearance",
            icon: "fire-outline",
            title: t("themeSettings.appearanceTuning"),
            description: t("themeSettingsIndex.appearanceDescription"),
            component: AppearanceTuning,
        },
    ];
    const selected = sections.find(item => item.key === section);

    if (selected) {
        const Component = selected.component;
        return (
            <ScrollView style={styles.detail} contentContainerStyle={styles.detailContent}>
                <Component />
            </ScrollView>
        );
    }

    return (
        <ScrollView style={styles.wrapper} contentContainerStyle={styles.content}>
            {sections.map((item, index) => (
                <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    style={[
                        styles.item,
                        {
                            backgroundColor: colors.card,
                            borderBottomColor: colors.border,
                            borderBottomWidth:
                                index < sections.length - 1
                                    ? StyleSheet.hairlineWidth
                                    : 0,
                        },
                    ]}
                    onPress={() =>
                        navigate(ROUTE_PATH.SETTING, {
                            type: "theme",
                            section: item.key,
                        })
                    }>
                    <View
                        style={[
                            styles.icon,
                            { backgroundColor: Color(colors.primary).alpha(0.1).toString() },
                        ]}>
                        <Icon name={item.icon} size={rpx(32)} color={colors.primary} />
                    </View>
                    <View style={styles.text}>
                        <ThemeText fontSize="subTitle" fontWeight="semibold">
                            {item.title}
                        </ThemeText>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            numberOfLines={2}
                            style={styles.description}>
                            {item.description}
                        </ThemeText>
                    </View>
                    <Icon
                        name="arrow-long-left"
                        size={rpx(30)}
                        color={colors.textSecondary}
                        style={styles.chevron}
                    />
                </Pressable>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    wrapper: { width: "100%", flex: 1 },
    content: {
        margin: rpx(24),
        borderRadius: rpx(22),
        overflow: "hidden",
        marginBottom: rpx(48),
    },
    item: {
        minHeight: rpx(112),
        paddingHorizontal: rpx(20),
        flexDirection: "row",
        alignItems: "center",
    },
    icon: {
        width: rpx(58),
        height: rpx(58),
        borderRadius: rpx(18),
        alignItems: "center",
        justifyContent: "center",
    },
    text: { flex: 1, minWidth: 0, marginHorizontal: rpx(16) },
    description: { marginTop: rpx(6) },
    chevron: { transform: [{ rotate: "180deg" }] },
    detail: { flex: 1, width: "100%" },
    detailContent: { paddingBottom: rpx(48) },
});
