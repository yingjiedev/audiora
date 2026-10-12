import ThemeText from "@/components/base/themeText";
import { controlSize, radius, spacing } from "@/constants/designSystem";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import React from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";

interface HomeSectionNavigationProps {
    sections: Array<{ key: string; title: string }>;
    activeSection: string;
    onSelect: (key: string) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    // ScrollViewStickyHeader replaces this prop on its direct child.
    style?: StyleProp<ViewStyle>;
    testID?: string;
}

/** Keep sticky positioning outside the row that lays out the channel buttons. */
export default function HomeSectionNavigation(props: HomeSectionNavigationProps) {
    const colors = useColors();
    return (
        <View style={[{ backgroundColor: colors.pageBackground }, props.style]} onLayout={props.onLayout}>
            <View testID="home-channel-row" style={styles.row}>
                {props.sections.map(section => {
                    const selected = props.activeSection === section.key;
                    return (
                        <Pressable
                            key={section.key}
                            accessibilityRole="button"
                            accessibilityLabel={section.title}
                            accessibilityState={{ selected }}
                            style={styles.target}
                            onPress={() => props.onSelect(section.key)}>
                            <View style={[styles.fill, selected ? { backgroundColor: colors.primary } : undefined]}>
                                <ThemeText numberOfLines={1} fontSize="title" fontWeight={selected ? "semibold" : "regular"} color={selected ? colors.onPrimary : colors.textSecondary}>{section.title}</ThemeText>
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xxs, flexDirection: "row", alignItems: "center", gap: spacing.sm },
    target: { minHeight: Math.max(44, controlSize.minimumTouch), minWidth: Math.max(44, controlSize.minimumTouch), alignItems: "flex-start", justifyContent: "center" },
    fill: { minHeight: rpx(60), paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.xl, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
});
