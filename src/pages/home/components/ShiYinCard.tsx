import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Color from "color";
import React from "react";

import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import type { Plugin } from "@/core/pluginManager";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import useShiYin from "./homeBody/useShiYin";

/**
 * 拾音入口：首页唯一的"一键开始听"。
 * 点击后直接从榜单热歌里挑一批播放，不需要先进任何二级页。
 */
export default function ShiYinCard(props: {
    topListPlugins: Plugin[];
    topListCache?: Record<string, IMusic.IMusicSheetGroupItem[]>;
    excludeMusicItems?: IMusic.IMusicItem[];
    preferredArtists?: string[];
}) {
    const { loading, start } = useShiYin(props);
    const colors = useColors();
    const { t } = useI18N();

    return (
        <View style={styles.wrapper}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.shiyin")}
                disabled={loading}
                onPress={() => start()}
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.card,
                        borderColor: Color(colors.text).alpha(0.06).toString(),
                    },
                ]}>
                <View
                    style={[
                        styles.iconFrame,
                        {
                            backgroundColor: Color(colors.primary)
                                .alpha(0.16)
                                .toString(),
                        },
                    ]}>
                    <Icon name="shuffle" size={rpx(40)} color={colors.primary} />
                </View>
                <View style={styles.textBlock}>
                    <ThemeText fontSize="subTitle" fontWeight="bold">
                        {t("home.shiyin")}
                    </ThemeText>
                    <ThemeText
                        numberOfLines={1}
                        fontSize="description"
                        fontColor="textSecondary"
                        style={styles.subtitle}>
                        {t("home.shiyinSubtitle")}
                    </ThemeText>
                </View>
                <View
                    style={[
                        styles.playButton,
                        {
                            backgroundColor: Color(colors.primary)
                                .alpha(0.16)
                                .toString(),
                        },
                    ]}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <Icon name="play" size={rpx(36)} color={colors.primary} />
                    )}
                </View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        paddingHorizontal: rpx(24),
        marginTop: rpx(16),
    },
    card: {
        minHeight: rpx(116),
        borderRadius: rpx(22),
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: rpx(18),
        flexDirection: "row",
        alignItems: "center",
    },
    iconFrame: {
        width: rpx(66),
        height: rpx(66),
        borderRadius: rpx(33),
        alignItems: "center",
        justifyContent: "center",
    },
    textBlock: {
        flex: 1,
        minWidth: 0,
        marginLeft: rpx(16),
    },
    subtitle: {
        marginTop: rpx(8),
    },
    playButton: {
        width: rpx(70),
        height: rpx(70),
        borderRadius: rpx(35),
        marginLeft: rpx(14),
        alignItems: "center",
        justifyContent: "center",
    },
});
