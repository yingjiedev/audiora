import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import { fontRpx } from "@/utils/rpx";

export default function SourceTabs({ routes, index, onIndexChange }: {
    routes: { key: string; title: string }[];
    index: number;
    onIndexChange: (index: number) => void;
}) {
    const colors = useColors();
    const { t } = useI18N();
    const scroll = useRef<ScrollView>(null);
    const positions = useRef<Record<string, { x: number; width: number }>>({});
    const offset = useRef(0);
    const [width, setWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [contentWidth, setContentWidth] = useState(0);
    const [atEnd, setAtEnd] = useState(false);
    const selected = routes[index]?.key;
    const reveal = (key: string) => {
        const item = positions.current[key];
        if (!item || !width) return;
        const next = item.x < offset.current ? item.x : item.x + item.width > offset.current + width ? item.x + item.width - width : offset.current;
        scroll.current?.scrollTo({ x: Math.max(0, next), animated: false });
    };
    useEffect(() => {
        if (selected) reveal(selected);
        // Layout callbacks also reveal the selection when routes are renamed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, width, contentWidth]);
    return <View style={styles.container} onLayout={event => setContainerWidth(event.nativeEvent.layout.width)}>
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}
            contentContainerStyle={styles.content} onLayout={event => setWidth(event.nativeEvent.layout.width)}
            onContentSizeChange={nextWidth => setContentWidth(nextWidth)} scrollEventThrottle={16}
            onScroll={event => {
                offset.current = event.nativeEvent.contentOffset.x;
                setAtEnd(offset.current + width >= contentWidth - 1);
            }}>
            {routes.map((route, routeIndex) => <Pressable key={route.key} accessibilityRole="tab"
                accessibilityLabel={t("searchPage.sourceLabel", { source: route.title })}
                accessibilityState={{ selected: index === routeIndex }} onPress={() => onIndexChange(routeIndex)}
                onLayout={event => {
                    positions.current[route.key] = event.nativeEvent.layout;
                    if (selected === route.key) reveal(route.key);
                }} style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}>
                <ThemeText allowFontScaling numberOfLines={1} fontWeight={index === routeIndex ? "semibold" : "medium"}
                    color={index === routeIndex ? colors.active : colors.textSecondary} style={styles.label}>{route.title}</ThemeText>
                {index === routeIndex ? <View pointerEvents="none" style={[styles.indicator, { backgroundColor: colors.active }]} /> : null}
            </Pressable>)}
        </ScrollView>
        {contentWidth > containerWidth && containerWidth > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={t("aggregate.moreSources")}
            onPress={() => scroll.current?.scrollTo({ x: atEnd ? 0 : Math.min(contentWidth - width, offset.current + width * 0.8), animated: false })}
            style={styles.more}>
            <Icon name="chevron-right" size={18} color={colors.textSecondary} style={atEnd ? styles.back : undefined} />
        </Pressable> : null}
    </View>;
}

const styles = StyleSheet.create({
    container: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
    scroll: { flex: 1, minWidth: 0, flexGrow: 1 },
    content: { alignItems: "center", gap: spacing.md },
    tab: { minWidth: 44, minHeight: 44, maxWidth: 160, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xs },
    label: { fontSize: fontRpx(26), flexShrink: 1 },
    indicator: { position: "absolute", bottom: 0, height: 2, width: 24, borderRadius: 1 },
    more: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
    back: { transform: [{ rotate: "180deg" }] },
});
