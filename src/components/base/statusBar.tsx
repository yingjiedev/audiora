import React from "react";
import { StatusBar, StatusBarProps, View, StyleSheet } from "react-native";
import Color from "color";
import useColors from "@/hooks/useColors";

interface IStatusBarProps extends StatusBarProps {}

/**
 * 状态栏图标色跟着实际背景走。
 *
 * 之前写死 light-content：浅色主题的 appBar 是 #F6F9FF，白色图标等于隐形。
 * 这里按背景亮度判定，自定义主题和壁纸模式（appBar 可能是半透明黑）同样适用。
 */
function resolveBarStyle(backgroundColor: string): StatusBarProps["barStyle"] {
    try {
        return Color(backgroundColor).isDark()
            ? "light-content"
            : "dark-content";
    } catch {
        return "light-content";
    }
}

export default function (props: IStatusBarProps) {
    const colors = useColors();
    const { backgroundColor, barStyle, ...statusBarProps } = props;
    const resolvedBackground =
        backgroundColor ?? colors.appBar ?? colors.primary;

    return (
        <>
            <StatusBar
                {...statusBarProps}
                backgroundColor={"rgba(0,0,0,0)"}
                barStyle={barStyle ?? resolveBarStyle(resolvedBackground)}
            />
            <View
                style={[
                    styles.statusBarView,
                    {
                        backgroundColor: resolvedBackground,
                        height: StatusBar.currentHeight,
                    },
                ]}
            />
        </>
    );
}

const styles = StyleSheet.create({
    statusBarView: {
        zIndex: 10000,
        position: "absolute",
        top: 0,
        width: "100%",
    },
});
