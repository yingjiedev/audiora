import { ImgAsset } from "@/constants/assetsConst";
import rpx from "@/utils/rpx";
import React from "react";
import { Image, StyleSheet, View } from "react-native";

/** A clipped, quiet backdrop connects the cover to the card without entering text areas. */
export default React.memo(function HomeCardMotif() {
    return (
        <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.slot}>
            <Image accessible={false} source={ImgAsset.homeListeningClouds} resizeMode="contain" resizeMethod="resize" style={styles.image} />
        </View>
    );
});

const styles = StyleSheet.create({
    slot: { position: "absolute", left: -rpx(12), right: 0, top: rpx(44), bottom: 0, overflow: "hidden" },
    image: { position: "absolute", left: 0, top: -rpx(48), width: rpx(232), height: rpx(232), opacity: 0.32 },
});
