import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import IconButton from "@/components/base/iconButton";
import useOrientation from "@/hooks/useOrientation";
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
    const orientation = useOrientation();
    const isHorizontal = orientation === "horizontal";
    const musicItem = useCurrentMusic();
    const { t } = useI18N();

    return (
        <View style={styles.container}>
            <IconButton
                name="arrow-left"
                sizeType={"normal"}
                color="white"
                style={styles.button}
                onPress={() => {
                    onBack?.();
                    requestAnimationFrame(() => {
                        navigation.goBack();
                    });
                }}
            />
            <View style={styles.titleBlock} pointerEvents="none">
                <ThemeText
                    fontSize="caption"
                    fontWeight="bold"
                    color="rgba(255,255,255,0.78)"
                    style={styles.kicker}>
                    {t("panel.playById.playingNow").toUpperCase()}
                </ThemeText>
                <ThemeText
                    numberOfLines={1}
                    fontSize="description"
                    fontWeight="semibold"
                    color="#FFFFFF">
                    {musicItem?.platform ?? "Audiora"}
                </ThemeText>
            </View>
            {isHorizontal ? (
                <View style={styles.rightButton}>
                    <HeartIcon />
                </View>
            ) : null}
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
        zIndex: 2,
    },
    button: {
        marginHorizontal: rpx(24),
    },
    rightButton: {
        marginHorizontal: rpx(24),
    },
    titleBlock: {
        position: "absolute",
        left: rpx(120),
        right: rpx(120),
        alignItems: "center",
    },
    kicker: {
        marginBottom: rpx(3),
        letterSpacing: rpx(1.8),
    },
});
