import { radius, spacing, controlSize } from "@/constants/designSystem";
import React from "react";
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import Image from "./image";
import { ImgAsset } from "@/constants/assetsConst";
import ThemeText from "./themeText";

interface IImageBtnProps {
    uri?: string;
    title?: string;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}
export default function ImageBtn(props: IImageBtnProps) {
    const { onPress, uri, title, style: _style } = props ?? {};
    return (
        <TouchableOpacity
            activeOpacity={0.5}
            onPress={onPress}
            style={[style.wrapper, _style]}>
            <Image
                style={style.image}
                uri={uri}
                emptySrc={ImgAsset.albumDefault}
            />
            <ThemeText
                fontSize="subTitle"
                numberOfLines={2}
                ellipsizeMode="tail">
                {title ?? ""}
            </ThemeText>
        </TouchableOpacity>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        minHeight: Math.max(44, controlSize.minimumTouch),
        flexGrow: 0,
        flexShrink: 0,
    },
    image: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: radius.lg,
        marginBottom: spacing.sm,
    },
});
