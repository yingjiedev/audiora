import React from "react";


import SettingRow from "../../components/settingRow";
import ThemeSwitch from "@/components/base/switch";
import { useAppConfig } from "@/core/appConfig";
import Theme from "@/core/theme";
import { useI18N } from "@/core/i18n";
import SettingSection from "../../components/settingSection";

export default function Mode() {
    const { t } = useI18N();
    const mode = useAppConfig("theme.followSystem") ?? true;
    return <SettingSection title={t("themeSettings.displayStyle")}>
        <SettingRow title={t("themeSettings.followSystemTheme")} right={<ThemeSwitch value={mode} onValueChange={value => Theme.setFollowSystem(value)} />} />
    </SettingSection>;
}
