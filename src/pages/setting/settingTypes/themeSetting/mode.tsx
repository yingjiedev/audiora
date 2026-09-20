import React from "react";
import { StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import ListItem from "@/components/base/listItem";
import ThemeSwitch from "@/components/base/switch";
import { useAppConfig } from "@/core/appConfig";
import Theme from "@/core/theme";
import { useI18N } from "@/core/i18n";
import SettingSection from "../../components/settingSection";

export default function Mode() {
    const { t } = useI18N();
    const mode = useAppConfig("theme.followSystem") ?? true;
    return (
        <SettingSection title={t("themeSettings.displayStyle")}>
            <ListItem withHorizontalPadding>
                <ListItem.Content>
                    <View style={styles.itemRow}>
                        <ThemeText>{t("themeSettings.followSystemTheme")}</ThemeText>
                        <ThemeSwitch
                            value={mode}
                            onValueChange={e => {
                                // theme.followSystem 只由 Theme.setFollowSystem 写，
                                // 打开时切到系统深浅色的联动也在那里
                                Theme.setFollowSystem(e);
                            }}
                        />
                    </View>
                </ListItem.Content>
            </ListItem>
        </SettingSection>
    );
}

const styles = StyleSheet.create({
    itemRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
});
