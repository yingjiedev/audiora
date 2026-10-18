import React from "react";
import { Platform, StyleSheet } from "react-native";
import ThemeSwitch from "@/components/base/switch";
import { useAppConfig } from "@/core/appConfig";
import Theme, { isPresetThemeId } from "@/core/theme";
import { useI18N } from "@/core/i18n";
import SettingSection from "../../components/settingSection";
import SettingRow from "../../components/settingRow";
import SystemColors from "@/native/dynamicColors";
import rpx from "@/utils/rpx";

export default function Mode() {
    const { t } = useI18N();
    const mode = useAppConfig("theme.followSystem") ?? true;
    const dynamicColors = useAppConfig("theme.dynamicColors") ?? false;
    const theme = Theme.useTheme();
    const customTheme = !isPresetThemeId(theme.id);
    const dynamicDisabled = !SystemColors.isSupported || customTheme;
    return (
        <SettingSection title={t("themeSettings.displayStyle")}>
            <SettingRow
                title={t("themeSettings.followSystemTheme")}
                right={
                    <ThemeSwitch
                        accessibilityLabel={t("themeSettings.followSystemTheme")}
                        value={mode}
                        onValueChange={Theme.setFollowSystem}
                    />
                }
            />
            {Platform.OS === "android" && (
                <SettingRow
                    title={t("themeSettings.dynamicColors")}
                    description={t(!SystemColors.isSupported ? "themeSettings.dynamicColorsUnavailable"
                        : customTheme ? "themeSettings.dynamicColorsCustom"
                            : "themeSettings.dynamicColorsDescription")}
                    descriptionLines={0}
                    style={styles.dynamicRow}
                    right={
                        <ThemeSwitch
                            accessibilityLabel={t("themeSettings.dynamicColors")}
                            value={dynamicColors}
                            disabled={dynamicDisabled}
                            onValueChange={Theme.setDynamicColors}
                        />
                    }
                />
            )}
        </SettingSection>
    );
}

const styles = StyleSheet.create({
    dynamicRow: {
        paddingVertical: rpx(20),
    },
});
