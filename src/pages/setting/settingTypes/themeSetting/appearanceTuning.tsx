import React from "react";
import ListItem from "@/components/base/listItem";
import SliderRow from "@/components/base/sliderRow";
import Config, { useAppConfig } from "@/core/appConfig";
import Theme from "@/core/theme";
import { useI18N } from "@/core/i18n";
import SettingSection from "../../components/settingSection";

export default function AppearanceTuning() {
    const { t } = useI18N();
    const surfaceOpacity = useAppConfig("theme.surfaceOpacity") ?? 1;
    const cardShadowStrength = useAppConfig("theme.cardShadowStrength") ?? 1;

    return (
        <SettingSection title={t("themeSettings.appearanceTuning")}>
            <SliderRow
                title={t("themeSettings.surfaceOpacity")}
                value={surfaceOpacity}
                minimumValue={0.3}
                maximumValue={1}
                step={0.01}
                format={val => `${Math.round(val * 100)}%`}
                onChange={val => {
                    Theme.setSurfaceOpacity(val);
                }}
            />
            <SliderRow
                title={t("themeSettings.cardShadowStrength")}
                value={cardShadowStrength}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                format={val => `${Math.round(val * 100)}%`}
                onChange={val => {
                    Config.setConfig("theme.cardShadowStrength", val);
                }}
            />
            <ListItem
                withHorizontalPadding
                onPress={() => {
                    Theme.setSurfaceOpacity(1);
                    Config.setConfig("theme.cardShadowStrength", 1);
                }}>
                <ListItem.Content
                    title={t("themeSettings.resetAppearanceTuning")}
                    description={t("themeSettings.surfaceOpacityDesc")}
                />
            </ListItem>
        </SettingSection>
    );
}
