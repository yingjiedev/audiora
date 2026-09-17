import React from "react";
import { StyleSheet, View } from "react-native";
import Color from "color";
import rpx from "@/utils/rpx";
import Icon from "@/components/base/icon";
import Config, { useAppConfig } from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import SettingRow from "../../components/settingRow";
import SettingSection from "../../components/settingSection";

type CoverStyleKey = "square" | "squareImmersive" | "circle";

/**
 * 封面样式预览块。
 *
 * 底色由文字色 / 主色叠加生成，**不能再用 colors.card**：
 * 它所在的分组卡片背景就是 colors.card，同色会导致预览不可辨
 * （colors.surface 在浅色主题下也等于 card，同样不可用）。
 * 三种样式靠形状与内部结构区分：方形 / 方形（沉浸式，上封面下背景）/ 圆形。
 */
function CoverStylePreview(props: { variant: CoverStyleKey }) {
    const { variant } = props;
    const colors = useColors();
    const coverColor = Color(colors.text).alpha(0.18).toString();
    const glyphColor = Color(colors.text).alpha(0.42).toString();
    const glyph = <Icon name="musical-note" size={rpx(30)} color={glyphColor} />;

    if (variant === "circle") {
        return (
            <View
                style={[
                    styles.preview,
                    styles.previewCircle,
                    { backgroundColor: coverColor },
                ]}>
                {glyph}
            </View>
        );
    }

    if (variant === "squareImmersive") {
        return (
            <View
                style={[
                    styles.preview,
                    styles.previewSquare,
                    {
                        backgroundColor: Color(colors.primary)
                            .alpha(0.16)
                            .toString(),
                    },
                ]}>
                <View style={[styles.previewCover, { backgroundColor: coverColor }]}>
                    {glyph}
                </View>
            </View>
        );
    }

    return (
        <View
            style={[
                styles.preview,
                styles.previewSquare,
                { backgroundColor: coverColor },
            ]}>
            {glyph}
        </View>
    );
}

export default function CoverStyle() {
    const { t } = useI18N();
    const colors = useColors();
    const coverStyle = useAppConfig("theme.coverStyle") ?? "square";
    const musicDetailCoverStyle =
        useAppConfig("theme.musicDetailCoverStyle") ?? "immersive";

    const selectedVariant: CoverStyleKey =
        coverStyle === "circle"
            ? "circle"
            : musicDetailCoverStyle === "immersive"
              ? "squareImmersive"
              : "square";

    const options: {
        variant: CoverStyleKey;
        label: string;
        apply: () => void;
    }[] = [
        {
            variant: "square",
            label: t("themeSettings.coverStyleSquare"),
            apply: () => {
                Config.setConfig("theme.coverStyle", "square");
                Config.setConfig("theme.musicDetailCoverStyle", "classic");
            },
        },
        {
            variant: "squareImmersive",
            label: t("themeSettings.coverStyleSquareImmersive"),
            apply: () => {
                Config.setConfig("theme.coverStyle", "square");
                Config.setConfig("theme.musicDetailCoverStyle", "immersive");
            },
        },
        {
            variant: "circle",
            label: t("themeSettings.coverStyleCircle"),
            apply: () => {
                Config.setConfig("theme.coverStyle", "circle");
                Config.setConfig("theme.musicDetailCoverStyle", "classic");
            },
        },
    ];

    return (
        <SettingSection title={t("themeSettings.coverStyle")}>
            {options.map(item => {
                const selected = item.variant === selectedVariant;
                return (
                    <SettingRow
                        key={item.variant}
                        accessibilityLabel={item.label}
                        title={item.label}
                        onPress={item.apply}
                        right={
                            <View style={styles.trailing}>
                                <CoverStylePreview variant={item.variant} />
                                <View style={styles.checkSlot}>
                                    {selected ? (
                                        <Icon
                                            name="check"
                                            size={rpx(32)}
                                            color={colors.primary}
                                        />
                                    ) : null}
                                </View>
                            </View>
                        }
                    />
                );
            })}
        </SettingSection>
    );
}

const previewSize = rpx(64);

const styles = StyleSheet.create({
    preview: {
        width: previewSize,
        height: previewSize,
        alignItems: "center",
        justifyContent: "center",
    },
    previewSquare: {
        borderRadius: rpx(8),
        overflow: "hidden",
    },
    previewCircle: {
        borderRadius: previewSize / 2,
    },
    previewCover: {
        width: "100%",
        height: "62%",
        alignItems: "center",
        justifyContent: "center",
    },
    trailing: {
        flexDirection: "row",
        alignItems: "center",
    },
    checkSlot: {
        width: rpx(48),
        marginLeft: rpx(16),
        alignItems: "center",
        justifyContent: "center",
    },
});
