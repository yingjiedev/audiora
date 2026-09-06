import React from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { ImgAsset } from "@/constants/assetsConst";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import FastImage from "@/components/base/fastImage";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";
import rpx, { fontRpx } from "@/utils/rpx";
import Color from "color";
import LinearGradient from "react-native-linear-gradient";
import Icon from "@/components/base/icon.tsx";
import { radius, topListGradients } from "@/constants/designSystem";

function getGradientIndex(title?: string) {
    return Array.from(title ?? "").reduce(
        (value, char) => value + char.charCodeAt(0),
        0,
    ) % topListGradients.length;
}

interface ITopListResultsProps {
    pluginHash: string;
    topListItem: IMusic.IMusicSheetItemBase;
    rank: number;
    style?: StyleProp<ViewStyle>;
}

export default function TopListItem(props: ITopListResultsProps) {
    const { pluginHash, topListItem, rank, style } = props;
    const navigate = useNavigate();
    const colors = useColors();
    const rankBackgroundColor = Color(colors.surfaceElevated ?? colors.card)
        .alpha(0.9)
        .toString();
    const gradient = topListGradients[getGradientIndex(topListItem.title)];

    return (
        <Pressable
            onPress={() => {
                navigate(ROUTE_PATH.TOP_LIST_DETAIL, {
                    pluginHash: pluginHash,
                    topList: topListItem,
                });
            }}
            style={({ pressed }) => [
                styles.wrapper,
                {
                    opacity: pressed ? 0.88 : 1,
                },
                style,
            ]}>
            <View style={styles.coverFrame}>
                {topListItem?.coverImg ? (
                    <FastImage
                        style={styles.cover}
                        source={topListItem.coverImg}
                        placeholderSource={ImgAsset.albumDefault}
                    />
                ) : (
                    <LinearGradient
                        colors={[...gradient]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.cover, styles.generatedCover]}>
                        <Icon
                            name="musical-note"
                            size={rpx(64)}
                            color="rgba(255,255,255,0.92)"
                        />
                        <ThemeText
                            numberOfLines={2}
                            fontSize="subTitle"
                            fontWeight="bold"
                            color="#FFFFFF"
                            style={styles.generatedTitle}>
                            {topListItem.title}
                        </ThemeText>
                    </LinearGradient>
                )}
                <View
                    style={[
                        styles.coverShade,
                        {
                            backgroundColor: Color(colors.background)
                                .alpha(0.1)
                                .toString(),
                        },
                    ]}
                />
                <View
                    style={[
                        styles.rankBadge,
                        {
                            backgroundColor: rankBackgroundColor,
                            borderColor: Color(colors.text)
                                .alpha(0.08)
                                .toString(),
                        },
                    ]}>
                    <ThemeText
                        fontSize="tag"
                        fontWeight="bold"
                        color={colors.primary}>
                        {`${rank}`.padStart(2, "0")}
                    </ThemeText>
                </View>
            </View>
            <View style={styles.content}>
                <ThemeText
                    fontSize="description"
                    fontWeight="bold"
                    numberOfLines={2}
                    style={styles.title}>
                    {topListItem.title}
                </ThemeText>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        borderRadius: radius.lg,
    },
    coverFrame: {
        width: "100%",
        aspectRatio: 1,
        position: "relative",
        borderRadius: radius.lg,
        overflow: "hidden",
    },
    cover: {
        width: "100%",
        height: "100%",
    },
    coverShade: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    content: {
        paddingHorizontal: rpx(4),
        paddingTop: rpx(12),
        paddingBottom: rpx(8),
    },
    title: {
        lineHeight: fontRpx(28),
    },
    rankBadge: {
        position: "absolute",
        top: rpx(8),
        left: rpx(8),
        minWidth: rpx(42),
        height: rpx(32),
        borderRadius: rpx(16),
        paddingHorizontal: rpx(10),
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: "center",
        justifyContent: "center",
    },
    generatedCover: {
        alignItems: "center",
        justifyContent: "center",
        padding: rpx(16),
    },
    generatedTitle: {
        marginTop: rpx(16),
        textAlign: "center",
    },
});
