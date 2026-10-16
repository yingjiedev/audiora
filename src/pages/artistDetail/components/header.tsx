import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useAtomValue } from "jotai";
import { scrollToTopAtom } from "../store/atoms";
import MediaDetailHeader from "@/components/base/mediaDetailHeader";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";
import { useParams } from "@/core/router";
import { useI18N } from "@/core/i18n";
import useMotion from "@/hooks/useMotion";
import rpx from "@/utils/rpx";
const HEADER_TIMING = { duration: "normal", easing: "standard" } as const;
export default function Header({ neverFold }: { neverFold?: boolean }) {
    const { artistItem } = useParams<"artist-detail">();
    const [measuredHeight, setMeasuredHeight] = useState(rpx(350));
    const heightValue = useSharedValue(measuredHeight);
    const opacityValue = useSharedValue(1);
    const atTop = useAtomValue(scrollToTopAtom);
    const { t } = useI18N();
    const motion = useMotion();
    const getDisplayName = usePluginDisplayNameResolver();
    const heightStyle = useAnimatedStyle(() => ({ height: heightValue.value, opacity: opacityValue.value }));
    useEffect(() => {
        heightValue.value = motion.timing(neverFold || atTop ? measuredHeight : 0, HEADER_TIMING);
        opacityValue.value = motion.timing(neverFold || atTop ? 1 : 0, HEADER_TIMING);
    }, [atTop, neverFold, measuredHeight, motion, heightValue, opacityValue]);
    const avatar = artistItem.avatar?.startsWith("//") ? `https:${artistItem.avatar}` : artistItem.avatar;
    return <Animated.View style={[styles.wrapper, neverFold && styles.horizontal, heightStyle]}>
        <View onLayout={event => {
            const height = event.nativeEvent.layout.height; if (height > 0) setMeasuredHeight(height);
        }}>
            <MediaDetailHeader title={artistItem.name || t("common.unknownName")} artwork={avatar} typeLabel={t("common.artist")} source={artistItem.platform ? getDisplayName(artistItem.platform) : null}
                subtitle={artistItem.fans ? t("artistDetail.fansCount", { count: artistItem.fans }) : undefined} description={artistItem.description} />
        </View>
    </Animated.View>;
}
const styles = StyleSheet.create({ wrapper: { width: "100%", overflow: "hidden" }, horizontal: { width: "40%" } });
