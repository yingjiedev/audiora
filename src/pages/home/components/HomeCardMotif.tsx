import { ImgAsset } from "@/constants/assetsConst";
import rpx from "@/utils/rpx";
import React from "react";
import { Image, StyleSheet, View } from "react-native";

/** Neutral raster decoration stays in its own slot, away from text and touch targets. */
export default React.memo(function HomeCardMotif() {
    return (
        <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.slot}>
            <Image accessible={false} source={ImgAsset.homeListeningClouds} resizeMode="contain" resizeMethod="resize" style={styles.image} />
        </View>
    );
});

const styles = StyleSheet.create({
    slot: { width: "100%", minWidth: 0, height: rpx(104), flexShrink: 1 },
    image: { width: "100%", height: "100%", opacity: 0.88 },
});
