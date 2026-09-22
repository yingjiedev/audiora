import { StyleSheet, View } from "react-native";
import Color from "color";
import React from "react";

import CardRow from "@/components/base/cardRow";
import Icon from "@/components/base/icon";
import RoundActionButton, {
    TONAL_ALPHA,
} from "@/components/base/roundActionButton";
import { useI18N } from "@/core/i18n";
import type { Plugin } from "@/core/pluginManager";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import useShiYin from "./homeBody/useShiYin";

/**
 * 拾音入口：首页唯一的"一键开始听"。
 * 点击后直接从榜单热歌里挑一批播放，不需要先进任何二级页。
 *
 * 卡片骨架走 CardRow，尾部播放键走 RoundActionButton 的 tonal；这里只留
 * 拾音专属的图标与外边距。
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
            <CardRow
                accessibilityLabel={t("home.shiyin")}
                disabled={loading}
                onPress={() => start()}
                title={t("home.shiyin")}
                description={t("home.shiyinSubtitle")}
                leading={
                    <View
                        style={[
                            styles.iconFrame,
                            {
                                backgroundColor: Color(colors.primary)
                                    .alpha(TONAL_ALPHA)
                                    .toString(),
                            },
                        ]}>
                        <Icon
                            name="shuffle"
                            size={rpx(40)}
                            color={colors.primary}
                        />
                    </View>
                }
                trailing={
                    <RoundActionButton variant="tonal" loading={loading} iconName="play" />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        paddingHorizontal: rpx(24),
        marginTop: rpx(16),
    },
    iconFrame: {
        width: rpx(66),
        height: rpx(66),
        borderRadius: rpx(33),
        alignItems: "center",
        justifyContent: "center",
    },
});
