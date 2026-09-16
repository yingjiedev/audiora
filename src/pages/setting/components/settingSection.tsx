import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { settingsLayout } from "./settingsLayout";
import rpx from "@/utils/rpx";

interface ISettingSectionProps {
    children: ReactNode;
    title?: ReactNode;
    cardStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
}

/**
 * Shared visual shell for settings groups. Keeping the background and spacing in
 * one place prevents the overview and nested settings from drifting apart.
 */
export default function SettingSection(props: ISettingSectionProps) {
    const { cardStyle, children, style, title } = props;
    const colors = useColors();

    return (
        <View style={[styles.section, style]}>
            {title ? (
                <ThemeText
                    fontColor="textSecondary"
                    fontSize="description"
                    style={styles.title}>
                    {title}
                </ThemeText>
            ) : null}
            <View
                style={[
                    styles.card,
                    { backgroundColor: colors.card },
                    cardStyle,
                ]}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginHorizontal: settingsLayout.groupMargin,
        marginTop: settingsLayout.groupMargin,
    },
    title: {
        marginBottom: settingsLayout.titleGap,
        marginHorizontal: rpx(14),
    },
    card: {
        borderRadius: settingsLayout.cardRadius,
        overflow: "hidden",
    },
});
