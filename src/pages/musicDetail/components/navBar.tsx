import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import IconButton from "@/components/base/iconButton";
import useColors from "@/hooks/useColors";
import HeartIcon from "./content/heartIcon";
import ThemeText from "@/components/base/themeText";
import { useCurrentMusic } from "@/core/trackPlayer";
import { useI18N } from "@/core/i18n";

interface INavBarProps {
    onBack?: () => void;
}

export const NAV_BAR_HEIGHT = rpx(100);

export default function NavBar(props: INavBarProps) {
    const { onBack } = props;
    const navigation = useNavigation();
    const colors = useColors();
    const musicItem = useCurrentMusic();
    const { t } = useI18N();

    const mediaText = colors.onMedia ?? colors.text;
    const mediaTextSecondary = colors.onMediaSecondary ?? mediaText;

    return (
        <View style={styles.container}>
            <IconButton
                name="arrow-left"
                sizeType={"normal"}
                color={mediaText}
                accessibilityLabel={t("musicDetail.a11y.back")}
                style={styles.button}
                onPress={() => {
                    onBack?.();
                    requestAnimationFrame(() => {
                        navigation.goBack();
                    });
                }}
            />
            {/*
                标题块回到 flex 流里左对齐：之前绝对定位居中会正好压在封面人脸上，
                且显示的是音源平台名（信息价值低）。现在给歌名 + 歌手。
            */}
            <View style={styles.titleBlock} pointerEvents="none">
                <ThemeText
                    fontSize="caption"
                    fontWeight="bold"
                    color={mediaTextSecondary}
                    style={styles.kicker}>
                    {t("musicDetail.playingNow").toUpperCase()}
                </ThemeText>
                <View style={styles.titleRow}>
                    <ThemeText
                        numberOfLines={1}
                        fontSize="subTitle"
                        fontWeight="bold"
                        color={mediaText}
                        style={styles.title}>
                        {musicItem?.title ?? t("common.unknownName")}
                    </ThemeText>
                    {musicItem?.artist ? (
                        <ThemeText
                            numberOfLines={1}
                            fontSize="caption"
                            color={mediaTextSecondary}
                            style={styles.artist}>
                            {musicItem.artist}
                        </ThemeText>
                    ) : null}
                </View>
            </View>
            {/* 竖屏也要有右侧落点，否则「左返回 / 右全空」失衡 */}
            <View style={styles.rightButton}>
                <HeartIcon />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        height: NAV_BAR_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: rpx(24),
        zIndex: 2,
    },
    button: {
        flexShrink: 0,
    },
    rightButton: {
        flexShrink: 0,
    },
    titleBlock: {
        flex: 1,
        minWidth: 0,
        marginHorizontal: rpx(12),
        justifyContent: "center",
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "baseline",
        marginTop: rpx(4),
    },
    title: {
        flexShrink: 1,
        minWidth: 0,
    },
    artist: {
        flexShrink: 1,
        marginLeft: rpx(10),
    },
    kicker: {
        letterSpacing: rpx(1.8),
    },
});
