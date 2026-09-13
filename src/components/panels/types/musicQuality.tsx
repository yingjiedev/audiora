import React, { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";

import { getQualityText, getAvailableQualities, getQualitySize } from "@/utils/qualities";
import { formatAudioQualityText, getMusicItemAudioMeta } from "@/utils/localQuality";
import PluginManager from "@/core/pluginManager";
import { sizeFormatter } from "@/utils/fileUtils";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PanelBase from "../base/panelBase";
import { ScrollView } from "react-native-gesture-handler";
import { hidePanel } from "../usePanel";
import Divider from "@/components/base/divider";
import PanelHeader from "../base/panelHeader";
import { useI18N } from "@/core/i18n";
import { useAppConfig } from "@/core/appConfig";

interface IMusicQualityProps {
    type?: "play" | "download";
    /** 本地文件即使元数据缺失，也必须显示中性本地音质文案 */
    isLocal?: boolean;
    /** 歌曲信息 */
    musicItem: IMusic.IMusicItem;
    /** 点击回调 */
    onQualityPress: (
        quality: IMusic.IQualityKey,
        musicItem: IMusic.IMusicItem,
    ) => void;
}

export default function MusicQuality(props: IMusicQualityProps) {
    const safeAreaInsets = useSafeAreaInsets();
    const i18n = useI18N();
    const customQualityTranslations = useAppConfig("basic.qualityTranslations");
    const qualityTextI18n = getQualityText(i18n.getLanguage().languageData, customQualityTranslations);

    const {
        musicItem,
        onQualityPress,
        type = "play",
        isLocal = false,
    } = props ?? {};

    // 使用增强的音质获取函数，传入插件信息
    const plugin = PluginManager.getByMedia(musicItem);
    const availableQualities = getAvailableQualities(musicItem, plugin?.instance);

    // 本地音乐：展示文件真实技术参数，不显示虚构的在线音质列表
    const localAudioMeta = getMusicItemAudioMeta(musicItem);
    const localQualityText = formatAudioQualityText(localAudioMeta);

    return (
        <PanelBase
            height={rpx(520)}
            renderBody={() => (
                <>
                    <PanelHeader
                        title={i18n.t("panel.musicQuality.title", {
                            type:
                                type === "play"
                                    ? i18n.t("common.play")
                                    : i18n.t("common.download"),
                        })}
                        hideButtons
                    />
                    <Divider />

                    <ScrollView
                        style={[
                            style.body,
                            {
                                marginBottom: safeAreaInsets.bottom,
                            },
                        ]}
                        showsVerticalScrollIndicator={availableQualities.length > 4}>
                        {isLocal ? (
                            <View style={style.item}>
                                <ThemeText>{i18n.t("localQuality.fallback")}</ThemeText>
                                {localQualityText ? (
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary">
                                        {localQualityText}
                                    </ThemeText>
                                ) : null}
                            </View>
                        ) : availableQualities.length > 0 ? (
                            availableQualities.map(key => {
                                return (
                                    <Fragment key={`frag-${key}`}>
                                        <Pressable
                                            key={`btn-${key}`}
                                            style={style.item}
                                            onPress={() => {
                                                onQualityPress(key, musicItem);
                                                hidePanel();
                                            }}>
                                            <ThemeText>
                                                {qualityTextI18n[key]}{" "}
                                                {(() => {
                                                    // 使用新的工具函数获取文件大小
                                                    const qualitySize = getQualitySize(musicItem, key);
                                                    if (qualitySize) {
                                                        return `(${sizeFormatter(qualitySize)})`;
                                                    }
                                                    return "";
                                                })()}
                                            </ThemeText>
                                        </Pressable>
                                    </Fragment>
                                );
                            })
                        ) : (
                            <Pressable style={style.item}>
                                <ThemeText fontColor="textSecondary">
                                    {i18n.t("panel.musicQuality.noQualityAvailable")}
                                </ThemeText>
                            </Pressable>
                        )}
                    </ScrollView>
                </>
            )}
        />
    );
}

const style = StyleSheet.create({
    header: {
        width: rpx(750),
        flexDirection: "row",
        padding: rpx(24),
    },
    body: {
        flex: 1,
        paddingHorizontal: rpx(24),
    },
    item: {
        height: rpx(96),
        justifyContent: "center",
    },
});
