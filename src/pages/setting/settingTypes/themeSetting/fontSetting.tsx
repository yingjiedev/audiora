import React from "react";
import { StyleSheet } from "react-native";
import ThemeText from "@/components/base/themeText";
import ListItem from "@/components/base/listItem";
import Config, { useAppConfig } from "@/core/appConfig";
import { showDialog } from "@/components/dialogs/useDialog";
import { useI18N } from "@/core/i18n";
import rpx from "@/utils/rpx";
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
            content: candidates.map(_ => ({
                label: labelMap[_],
                value: _,
            })),
            onOk(val) {
                Config.setConfig(changeKey, val);
            },
        });
    };

    return (
        <SettingSection title={t("fontSetting.title")}>
            <ListItem
                withHorizontalPadding
                onPress={() =>
                    showPicker(
                        t("fontSetting.appFont"),
                        "font.appFontFamily",
                        [
                            "default",
                            "NotoSerifSC",
                            "LXGWNeoZhiSong",
                            "ZhiMangXing",
                        ],
                        appFont,
                    )
                }>
                <ListItem.Content title={t("fontSetting.appFont")} />
                <ThemeText
                    fontSize="subTitle"
                    style={[
                        styles.valueText,
                        appFont !== "default" && styles.activeValue,
                    ]}>
                    {labelMap[appFont]}
                </ThemeText>
            </ListItem>
            <ListItem
                withHorizontalPadding
                onPress={() =>
                    showPicker(
                        t("fontSetting.lyricFont"),
                        "font.lyricFontFamily",
                        [
                            "follow",
                            "default",
                            "NotoSerifSC",
                            "LXGWNeoZhiSong",
                            "ZhiMangXing",
                        ],
                        lyricFont,
                    )
                }>
                <ListItem.Content title={t("fontSetting.lyricFont")} />
                <ThemeText
                    fontSize="subTitle"
                    style={[
                        styles.valueText,
                        lyricFont !== "follow" &&
                                lyricFont !== "default" &&
                                styles.activeValue,
                    ]}>
                    {labelMap[lyricFont]}
                </ThemeText>
            </ListItem>
        </SettingSection>
    );
}

const styles = StyleSheet.create({
    valueText: {
        paddingVertical: rpx(24),
    },
    activeValue: {
        fontWeight: "600",
    },
});
