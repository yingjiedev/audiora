import React from "react";
import {
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewProps,
} from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import Icon from "@/components/base/icon.tsx";
import { radius } from "@/constants/designSystem";

interface ICheckboxProps {
    checked?: boolean;
    indeterminate?: boolean;
    onPress?: () => void;
    style?: StyleProp<ViewProps>;
}

const slop = rpx(24);

export default function Checkbox(props: ICheckboxProps) {
    const { checked, indeterminate, onPress, style } = props;
    const colors = useColors();

    const innerNode = (
        <View
            style={[
                styles.container,
                checked || indeterminate
                    ? {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                    }
                    : {
                        borderColor: colors.textSecondary ?? colors.text,
                    },
                style,
            ]}>
            {checked || indeterminate ? (
                <Icon name={indeterminate ? "minus" : "check"} color={colors.onPrimary} size={rpx(34)} />
            ) : null}
        </View>
    );

    return onPress ? (
        <TouchableOpacity
            hitSlop={{
                left: slop,
                right: slop,
                top: slop,
                bottom: slop,
            }}
            onPress={onPress}>
            {innerNode}
        </TouchableOpacity>
    ) : (
        innerNode
    );
}

const styles = StyleSheet.create({
    container: {
        width: rpx(36),
        height: rpx(36),
        borderRadius: radius.xs,
        borderWidth: rpx(1),
        alignItems: "center",
        justifyContent: "center",
    },
});
