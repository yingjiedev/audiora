import React from "react";
import { StyleSheet } from "react-native";
import rpx from "@/utils/rpx";
// import pathConst from '@/constants/pathConst';
import Config, { useAppConfig } from "@/core/appConfig";
import ThemeCard from "./themeCard";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import Theme from "@/core/theme";
import { useI18N } from "@/core/i18n";
import SettingSection from "../../components/settingSection";

export default function Background() {
    const { t } = useI18N();

    const themeBackground = useAppConfig("theme.background");
    const themeSelectedTheme = useAppConfig("theme.selectedTheme");

    const navigate = useNavigate();

    // const onCustomBgPress = async () => {
    //     try {
    //         const result = await launchImageLibrary({
    //             mediaType: 'photo',
    //         });
    //         const uri = result.assets?.[0].uri;
    //         if (!uri) {
    //             return;
    //         }

    //         const bgPath = `${pathConst.dataPath}background${uri.substring(
    //             uri.lastIndexOf('.'),
    //         )}`;
    //         await copyFile(uri, bgPath);
    //         Config.set(
    //             'setting.theme.background',
    //             `file://${bgPath}#${Date.now()}`,
    //         );

    //         const colorsResult = await ImageColors.getColors(uri, {
    //             fallback: '#ffffff',
    //         });
    //         const colors = {
    //             primary:
    //                 colorsResult.platform === 'android'
    //                     ? colorsResult.dominant
    //                     : colorsResult.platform === 'ios'
    //                     ? colorsResult.primary
    //                     : colorsResult.vibrant,
    //             average:
    //                 colorsResult.platform === 'android'
    //                     ? colorsResult.average
    //                     : colorsResult.platform === 'ios'
    //                     ? colorsResult.detail
    //                     : colorsResult.dominant,
    //             vibrant:
    //                 colorsResult.platform === 'android'
    //                     ? colorsResult.vibrant
    //                     : colorsResult.platform === 'ios'
    //                     ? colorsResult.secondary
    //                     : colorsResult.vibrant,
    //         };
    //         const primaryColor = Color(colors.primary).darken(0.3).toString();
    //         // const secondaryColor = Color(colors.average)
    //         //   .darken(0.3)
    //         //   .toString();
    //         const textHighlight = Color(
    //             0xffffff - Color(primaryColor).rgbNumber(),
    //             'rgb',
    //         )
    //             .saturate(0.5)
    //             .toString();
    //         Config.set('setting.theme.mode', 'custom-dark');
    //         Config.set('setting.theme.colors', {
    //             primary: primaryColor,
    //             textHighlight: textHighlight,
    //             accent: textHighlight,
    //         });
    //     } catch (e) {
    //         console.log(e);
    //     }
    // };

    return (
        <SettingSection
            title={t("themeSettings.setTheme")}
            cardStyle={style.sectionCard}>
            <ThemeCard
                preview="#fff"
                title={t("themeSettings.lightMode")}
                selected={themeSelectedTheme === "p-light"}
                onPress={() => {
                    if (themeSelectedTheme !== "p-light") {
                        Theme.setTheme("p-light");
                        // 明确选了主题就退出「跟随系统」，走统一入口
                        Theme.setFollowSystem(false);
                    }
                }}
            />
            <ThemeCard
                preview="#131313"
                title={t("themeSettings.darkMode")}
                selected={themeSelectedTheme === "p-dark"}
                onPress={() => {
                    if (themeSelectedTheme !== "p-dark") {
                        Theme.setTheme("p-dark");
                        Theme.setFollowSystem(false);
                    }
                }}
            />

            <ThemeCard
                title={t("themeSettings.customMode")}
                selected={themeSelectedTheme === "custom"}
                preview={themeBackground}
                onPress={() => {
                    if (themeSelectedTheme !== "custom") {
                        Theme.setFollowSystem(false);
                        Theme.setTheme("custom", {
                            colors: Config.getConfig(
                                "theme.customColors",
                            ),
                        });
                    }
                    navigate(ROUTE_PATH.SET_CUSTOM_THEME);
                    // showPanel('ColorPicker');
                }}
            />

            {/* <ImageCard
                    emptySrc={ImgAsset.backgroundDefault}
                    onPress={() => {
                        Config.set('setting.theme.background', undefined);
                        Config.set('setting.theme.colors', undefined);
                    }}
                />
                <ImageCard
                    uri={theme?.background}
                    emptySrc={ImgAsset.addBackground}
                    onPress={onCustomBgPress}
                /> */}
        </SettingSection>
    );
}

const style = StyleSheet.create({
    sectionCard: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: rpx(20),
        paddingVertical: rpx(24),
    },
});
