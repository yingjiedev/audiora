import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { settingsLayout } from "./settingsLayout";
import rpx from "@/utils/rpx";

interface ISettingSectionProps {
    children: ReactNode;
    title?: ReactNode;
    /** 标题下方的说明行，用来承载「这组是干什么的」的长句，避免把长句塞进标题 */
    description?: ReactNode;
    cardStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
}

/**
 * Shared visual shell for settings groups. Keeping the background and spacing in
 * one place prevents the overview and nested settings from drifting apart.
 */
export default function SettingSection(props: ISettingSectionProps) {
    const { cardStyle, children, description, style, title } = props;
    const colors = useColors();

    return (
        <View style={[styles.section, style]}>
            {title ? (
                <ThemeText
                    fontColor="textSecondary"
                    fontSize="description"
                    style={
                        description ? styles.titleWithDescription : styles.title
                    }>
                    {title}
                </ThemeText>
            ) : null}
            {description ? (
                <ThemeText
                    fontColor="textSecondary"
                    fontSize="caption"
                    style={styles.description}>
                    {description}
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
    /** 有说明行时，标题自己少留空，两行一起当作「标题块」 */
    titleWithDescription: {
        marginBottom: rpx(4),
        marginHorizontal: rpx(14),
    },
    description: {
        marginBottom: settingsLayout.titleGap,
        marginHorizontal: rpx(14),
    },
    card: {
        borderRadius: settingsLayout.cardRadius,
        overflow: "hidden",
    },
});
