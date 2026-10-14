import React from "react";


import SettingRow from "../../components/settingRow";
import Config, { useAppConfig } from "@/core/appConfig";
import { showDialog } from "@/components/dialogs/useDialog";
import { useI18N } from "@/core/i18n";

import SettingSection from "../../components/settingSection";

/** 字体选项：default = 系统默认，NotoSerifSC = 内置思源宋体 */
export default function FontSetting() {
    const { t } = useI18N();
    const appFont = useAppConfig("font.appFontFamily") ?? "default";
    const lyricFont = useAppConfig("font.lyricFontFamily") ?? "follow";

    const labelMap: Record<string, string> = {
        default: t("fontSetting.default"),
        NotoSerifSC: t("fontSetting.notoSerifSC"),
        LXGWNeoZhiSong: t("fontSetting.lxgwNeoZhiSong"),
        ZhiMangXing: t("fontSetting.zhiMangXing"),
        follow: t("fontSetting.followApp"),
    };

    const showPicker = (
        title: string,
        changeKey: "font.appFontFamily" | "font.lyricFontFamily",
        candidates: string[],
        _value: string,
    ) => {
        showDialog("RadioDialog", {
            title,
            defaultSelected: _value,
            content: candidates.map(_ => ({
                label: labelMap[_],
                value: _,
            })),
            onOk(val) {
                Config.setConfig(changeKey, val);
            },
        });
    };

    return <SettingSection title={t("fontSetting.title")}>
        <SettingRow title={t("fontSetting.appFont")} value={labelMap[appFont]} showChevron onPress={() => showPicker(t("fontSetting.appFont"), "font.appFontFamily", ["default", "NotoSerifSC", "LXGWNeoZhiSong", "ZhiMangXing"], appFont)} />
        <SettingRow title={t("fontSetting.lyricFont")} value={labelMap[lyricFont]} showChevron onPress={() => showPicker(t("fontSetting.lyricFont"), "font.lyricFontFamily", ["follow", "default", "NotoSerifSC", "LXGWNeoZhiSong", "ZhiMangXing"], lyricFont)} />
    </SettingSection>;
}
