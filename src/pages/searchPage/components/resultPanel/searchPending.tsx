import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import useMotion from "@/hooks/useMotion";
import rpx from "@/utils/rpx";

/** Native animation only while work is pending; fast responses never flash a spinner. */
export default function SearchPending({ active, hasResults, session }: { active: boolean; hasResults: boolean; session: number }) {
    const colors = useColors();
    const { reduceMotion } = useMotion();
    const { t } = useI18N();
    const [visible, setVisible] = useState(false);
    const [slow, setSlow] = useState(false);
    useEffect(() => {
        setVisible(false);
        setSlow(false);
        if (!active) return;
        const indicator = setTimeout(() => setVisible(true), 200);
        const hint = setTimeout(() => setSlow(true), 4000);
        return () => {
            clearTimeout(indicator);
            clearTimeout(hint);
        };
    }, [active, session]);
    if (!active) return null;
    return (
        <View style={[styles.wrapper, !hasResults && styles.empty]}>
            {visible ? (
                <View accessible accessibilityLiveRegion="polite" accessibilityRole="progressbar" accessibilityState={{ busy: true }}
                    accessibilityLabel={t(slow ? "aggregate.slowSources" : hasResults ? "aggregate.searchingMore" : "aggregate.searching")} style={styles.status}>
                    {!reduceMotion ? <ActivityIndicator color={colors.primaryText} size="small" accessible={false} /> : null}
                    <ThemeText fontColor="textSecondary" style={styles.text}>
                        {t(slow ? "aggregate.slowSources" : hasResults ? "aggregate.searchingMore" : "aggregate.searching")}
                    </ThemeText>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { paddingHorizontal: rpx(24), paddingVertical: rpx(24), minHeight: rpx(100), justifyContent: "center" },
    empty: { minHeight: rpx(440) },
    status: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: rpx(16) },
    text: { flexShrink: 1 },
});
