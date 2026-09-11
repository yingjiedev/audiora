import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import ListItem from "@/components/base/listItem";
import SliderRow from "@/components/base/sliderRow";
import Config, { useAppConfig } from "@/core/appConfig";
import Theme, {
    DEFAULT_BACKGROUND_BLUR,
    DEFAULT_BACKGROUND_OPACITY,
} from "@/core/theme";
import { useI18N } from "@/core/i18n";
import {
    removeBackgroundImage,
} from "@/utils/backgroundImage";

export default function BackgroundTuning() {
    const { t } = useI18N();
    const backgroundInfo = Theme.useBackground();
    const activeBackground = Theme.useActiveBackground();
    const backgroundMask = useAppConfig("theme.backgroundMask") ?? 0;
    // 「清除背景图」看的是已配置的 url：浅色/深色模式下背景虽然不显示，
    // 但配置还在，得留一个入口让用户把它删掉
    const hasBackground = !!backgroundInfo?.url;
    // 模糊 / 透明度 / 暗化只对正在显示的壁纸有意义
    const isBackgroundActive = !!activeBackground;

    async function onClearPress() {
        const previousUrl = Theme.getBackground()?.url;
        Theme.setBackground({ url: null });
        await removeBackgroundImage(previousUrl);
    }

    function onResetPress() {
        Theme.setBackground({
            blur: DEFAULT_BACKGROUND_BLUR,
            opacity: DEFAULT_BACKGROUND_OPACITY,
        });
        Config.setConfig("theme.backgroundMask", 0);
    }

    // 没配过背景图、当前主题也不显示壁纸时，这一段没有任何可调项
    if (!hasBackground && !isBackgroundActive) {
        return null;
    }

    return (
        <View>
            <ThemeText
                fontSize="subTitle"
                fontWeight="bold"
                style={styles.header}>
                {t("themeSettings.backgroundTuning")}
            </ThemeText>
            <View style={styles.sectionWrapper}>
                {hasBackground ? (
                    <ListItem withHorizontalPadding onPress={onClearPress}>
                        <ListItem.Content
                            title={t("themeSettings.clearBackground")}
                        />
                    </ListItem>
                ) : null}
                {isBackgroundActive ? (
                    <>
                        <SliderRow
                            title={t("setCustomTheme.blur")}
                            value={
                                backgroundInfo?.blur ?? DEFAULT_BACKGROUND_BLUR
                            }
                            minimumValue={0}
                            maximumValue={50}
                            step={1}
                            onChange={val => {
                                Theme.setBackground({ blur: val });
                            }}
                        />
                        <SliderRow
                            title={t("setCustomTheme.opacity")}
                            value={
                                backgroundInfo?.opacity ??
                                DEFAULT_BACKGROUND_OPACITY
                            }
                            minimumValue={0}
                            maximumValue={1}
                            step={0.01}
                            format={val => `${Math.round(val * 100)}%`}
                            onChange={val => {
                                Theme.setBackground({ opacity: val });
                            }}
                        />
                        <SliderRow
                            title={t("themeSettings.backgroundMask")}
                            value={backgroundMask}
                            minimumValue={0}
                            maximumValue={0.8}
                            step={0.01}
                            format={val => `${Math.round(val * 100)}%`}
                            onChange={val => {
                                Config.setConfig("theme.backgroundMask", val);
                            }}
                        />
                        <ListItem withHorizontalPadding onPress={onResetPress}>
                            <ListItem.Content
                                title={t(
                                    "themeSettings.resetBackgroundTuning",
                                )}
                                description={t(
                                    "themeSettings.resetBackgroundTuningDesc",
                                )}
                            />
                        </ListItem>
                    </>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingLeft: rpx(24),
        marginTop: rpx(36),
    },
    sectionWrapper: {
        marginTop: rpx(24),
    },
});
