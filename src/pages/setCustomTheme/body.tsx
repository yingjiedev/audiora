import Image from "@/components/base/image";
import SettingSection from "@/pages/setting/components/settingSection";
import SettingRow from "@/pages/setting/components/settingRow";
import { radius, spacing } from "@/constants/designSystem";
import BackgroundTuningSliders from "@/components/base/backgroundTuningSliders";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import globalStyle from "@/constants/globalStyle";
import { useI18N } from "@/core/i18n";
import Theme, { customBackgroundSurfaceColors, customThemeDefaultPrimary, darkTheme } from "@/core/theme";
import { derivePrimaryColor } from "@/utils/themePalette";
import useColors, { CustomizedColors } from "@/hooks/useColors";
import { pickBackgroundImage, saveBackgroundImage } from "@/utils/backgroundImage";

import { devLog } from "@/utils/log";
import Toast from "@/utils/toast";
import Color from "color";
import React from "react";
import { StyleSheet, View } from "react-native";
import { ScrollView, TouchableOpacity } from "react-native-gesture-handler";
import ImageColors from "react-native-image-colors";

export default function Body() {
    const theme = Theme.useTheme();
    const colors = useColors();
    const backgroundInfo = Theme.useBackground();
    const { t } = useI18N();

    async function onImageClick() {
        let bgUrl: string;
        try {
            const uri = await pickBackgroundImage();
            if (!uri) {
                return;
            }
            bgUrl = await saveBackgroundImage(uri, "background");
        } catch (e) {
            devLog("warn", "🎨[自定义主题] 背景图落盘失败", e);
            Toast.warn(`导入背景图失败：${(e as Error)?.message ?? e}`);
            return;
        }

        let themeColors: Partial<CustomizedColors> = {};
        try {
            const colorsResult = await ImageColors.getColors(bgUrl, {
                fallback: colors.inverseSurface,
            });
            const extractedColors = {
                primary:
                    colorsResult.platform === "android"
                        ? colorsResult.dominant
                        : colorsResult.platform === "ios"
                            ? colorsResult.primary
                            : colorsResult.vibrant,
                average:
                    colorsResult.platform === "android"
                        ? colorsResult.average
                        : colorsResult.platform === "ios"
                            ? colorsResult.detail
                            : colorsResult.dominant,
                vibrant:
                    colorsResult.platform === "android"
                        ? colorsResult.vibrant
                        : colorsResult.platform === "ios"
                            ? colorsResult.secondary
                            : colorsResult.vibrant,
            };

            // 候选色全部收集，以 dominant（主导色）为基准挑：
            // Palette 对深色图的量化可能抠出只占极小面积的暖色 vibrant
            // （蓝黑图出橙色就是它），色相偏离主导色太多的候选强降权
            // 亮度/饱和度单位都是 0~100（color@4 约定），阈值错配会静默出错
            const primaryHex = derivePrimaryColor(
                [extractedColors.primary, extractedColors.vibrant, extractedColors.average],
                { fallbackPrimary: customThemeDefaultPrimary },
            );

            const neutralMusicBar = Color(darkTheme.colors.musicBar)
                .alpha(0.92)
                .toString();

            themeColors = {
                ...customBackgroundSurfaceColors,
                primary: primaryHex,
                musicBar: neutralMusicBar,
                tabBar: Color(primaryHex).alpha(0.2).toString(),
            };
        } catch (e) {
            // 取色失败不挡换背景：背景照设，配色退回黑白默认
            devLog("warn", "🎨[自定义主题] 取色失败，退回默认配色", e);
            themeColors = { ...customBackgroundSurfaceColors };
        }

        try {
            Theme.setTheme("custom", {
                colors: themeColors,
                background: {
                    url: bgUrl,
                },
            });
        } catch (e) {
            devLog("warn", "🎨[自定义主题] 主题设置失败", e);
            Toast.warn(`导入背景图失败：${(e as Error)?.message ?? e}`);
        }
    }

    return (
        <ScrollView style={globalStyle.fwflex1} contentContainerStyle={styles.content}>
            <SettingSection title={t("subpage.backgroundPreview")} cardStyle={styles.previewCard}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("subpage.backgroundPreview")} onPress={onImageClick}>
                    <Image style={styles.image} uri={backgroundInfo?.url} emptySrc={ImgAsset.addBackground} />
                </TouchableOpacity>
            </SettingSection>
            <SettingSection title={t("themeSettings.backgroundTuning")}><BackgroundTuningSliders /></SettingSection>
            <SettingSection title={t("subpage.themeColors")}>
                {Theme.configableColorKey.map(key => {
                    const selectColor = () => showPanel("ColorPicker", {
                        defaultColor: theme.colors[key],
                        onSelected(color) {
                            Theme.setColors({ [key]: color.hexa().toString() });
                        },
                    });
                    return <SettingRow key={key} title={t("setCustomTheme." + key + "Color" as any)} value={Color(theme.colors[key]).hexa().toString()} onPress={selectColor}
                        right={<View style={[styles.swatch, { borderColor: colors.border }]}>
                            <Image resizeMode="repeat" emptySrc={ImgAsset.transparentBg} style={styles.transparentBg} />
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors[key] }]} />
                        </View>} />;
                })}
            </SettingSection>
        </ScrollView>
    );
}
const styles = StyleSheet.create({
    content: { paddingBottom: spacing.xxxl }, previewCard: { padding: spacing.lg },
    image: { width: "100%", aspectRatio: 1.5, borderRadius: radius.lg },
    swatch: { width: 44, height: 32, borderRadius: radius.xs, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
    transparentBg: { width: "100%", height: "100%" },
});
