import React, { useState } from "react";
import { GestureResponderEvent, StyleSheet, TextProps } from "react-native";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";
import openUrl from "@/utils/openUrl";
import ThemeText from "./themeText";
import useColors from "@/hooks/useColors";

type ILinkTextProps = TextProps & {
    fontSize?: keyof typeof fontSizeConst;
    fontWeight?: keyof typeof fontWeightConst;
    linkTo?: string;
    onPress?: (event: GestureResponderEvent) => void;
};

export default function LinkText(props: ILinkTextProps) {
    const colors = useColors();
    const [isPressed, setIsPressed] = useState(false);

    return (
        <ThemeText
            {...props}
            color={colors.primaryText}
            style={[style.linkText, isPressed ? style.pressed : null, props.style]}
            onPressIn={() => {
                setIsPressed(true);
            }}
            onPress={evt => {
                if (props.onPress) {
                    props.onPress(evt);
                } else {
                    props?.linkTo && openUrl(props.linkTo);
                }
            }}
            onPressOut={() => {
                setIsPressed(false);
            }}>
            {props.children}
        </ThemeText>
    );
}

const style = StyleSheet.create({
    linkText: {
        textDecorationLine: "underline",
    },
    pressed: {
        opacity: 0.7,
    },
});
