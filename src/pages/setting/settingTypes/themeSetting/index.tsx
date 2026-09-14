import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate, useParams } from "@/core/router";
import rpx from "@/utils/rpx";
import React, { ComponentType } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import SettingSection from "../../components/settingSection";
import AppearanceTuning from "./appearanceTuning";
import Background from "./background";
import BackgroundTuning from "./backgroundTuning";
import CoverStyle from "./coverStyle";
import FontSetting from "./fontSetting";
import Mode from "./mode";
import SplashImage from "./splashImage";

interface IThemeSection {
    key: string;
    title: string;
    component: ComponentType;
}

export default function ThemeSetting() {
    const { section } = useParams<"setting">();
    const { t } = useI18N();
    const navigate = useNavigate();

    const sections: IThemeSection[] = [
        {
            key: "mode",
            title: t("themeSettings.displayStyle"),
            component: Mode,
        },
        {
            key: "cover",
            title: t("themeSettings.coverStyle"),
            component: CoverStyle,
        },
        {
            key: "font",
            title: t("fontSetting.title"),
            component: FontSetting,
        },
        {
            key: "theme",
            title: t("themeSettings.setTheme"),
            component: Background,
        },
        {
            key: "background",
            title: t("themeSettings.backgroundTuning"),
            component: BackgroundTuning,
        },
        {
            key: "splash",
            title: t("themeSettings.splashImage"),
            component: SplashImage,
        },
        {
            key: "appearance",
            title: t("themeSettings.appearanceTuning"),
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
            <SettingSection title={t("settingsGroup.appearance")}>
                {sections.map(item => (
                    <Pressable
                        key={item.key}
                        accessibilityRole="button"
                        accessibilityLabel={item.title}
                        style={({ pressed }) => [
                            styles.item,
                            pressed ? styles.itemPressed : null,
                        ]}
                        onPress={() =>
                            navigate(ROUTE_PATH.SETTING, {
                                type: "theme",
                                section: item.key,
                            })
                        }>
                        <ThemeText>{item.title}</ThemeText>
                    </Pressable>
                ))}
            </SettingSection>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    wrapper: { width: "100%", flex: 1 },
    content: {
        paddingBottom: rpx(48),
    },
    item: {
        minHeight: rpx(92),
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
    },
    itemPressed: { opacity: 0.68 },
    detail: { flex: 1, width: "100%" },
    detailContent: { paddingBottom: rpx(48) },
});
