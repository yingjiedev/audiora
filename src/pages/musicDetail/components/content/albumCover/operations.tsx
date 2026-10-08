import React, { ReactNode, useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import rpx, { fontRpx } from "@/utils/rpx";

import LocalMusicSheet from "@/core/localMusicSheet";
import { ROUTE_PATH } from "@/core/router";
import { ImgAsset } from "@/constants/assetsConst";
import Toast from "@/utils/toast";
import toast from "@/utils/toast";
import useOrientation from "@/hooks/useOrientation";
import useColors from "@/hooks/useColors";
import { showPanel } from "@/components/panels/usePanel";
import { showDialog, hideDialog } from "@/components/dialogs/useDialog";
import TrackPlayer, { useCurrentMusic, useMusicQuality } from "@/core/trackPlayer";
import { iconSizeConst } from "@/constants/uiConst";
import PersistStatus from "@/utils/persistStatus";
import Icon from "@/components/base/icon.tsx";
import PluginManager from "@/core/pluginManager";
import downloader from "@/core/downloader";
import { useI18N } from "@/core/i18n";

import { getQualityAbbr, musicItemHasQualitySizes } from "@/utils/qualities";
import { getLocalQualityAbbr } from "@/utils/localQuality";

/**
 * 一行五个入口此前是「两个纯文本 + 三个裸图标」，视觉重量和触控区都不一致。
 * 这里统一套一层同尺寸圆形承载面，并把图标含义交给无障碍标签。
 */
function OperationButton(props: {
    accessibilityLabel: string;
    children: ReactNode;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.accessibilityLabel}
            style={({ pressed }) => [
                styles.operationButton,
                pressed && styles.pressed,
            ]}
            onPress={props.onPress}>
            {props.children}
        </Pressable>
    );
}

export default function Operations() {
    const musicItem = useCurrentMusic();
    const currentQuality = useMusicQuality();
    const isDownloaded = LocalMusicSheet.useIsLocal(musicItem);
    const localMusicItem = isDownloaded
        ? LocalMusicSheet.isLocalMusic(musicItem)
        : undefined;
    const colors = useColors();

    const rate = PersistStatus.useValue("music.rate", 100);
    const orientation = useOrientation();
    const { t } = useI18N();

    const supportComment = useMemo(() => {
        return !musicItem
            ? false
            : !!PluginManager.getByMedia(musicItem)?.supportedMethods.has("getMusicComments");
    }, [musicItem]);

    // 本地音乐展示基于真实元数据映射的音质档位，未知信息显示中性"本地"
    const localQualityAbbr = useMemo(
        () => (
            isDownloaded
                ? getLocalQualityAbbr(musicItem, localMusicItem)
                : null
        ),
        [isDownloaded, localMusicItem, musicItem],
    );

    const mediaForeground = colors.onMedia ?? colors.text;

    return (
        <View
            style={[
                styles.wrapper,
                orientation === "horizontal" ? styles.horizontalWrapper : null,
            ]}>
            <OperationButton
                accessibilityLabel={t("musicDetail.a11y.quality")}
                onPress={async () => {
                    if (!musicItem) {
                        return;
                    }
                    let panelMusicItem = localMusicItem ?? musicItem;
                    try {
                        const plugin = PluginManager.getByName(
                            musicItem.platform,
                        );
                        if (
                            !isDownloaded &&
                            plugin?.methods?.getMusicInfo &&
                            (!musicItem.qualities ||
                                !musicItemHasQualitySizes(musicItem))
                        ) {
                            const additionalInfo =
                                await plugin.methods.getMusicInfo(musicItem);
                            if (additionalInfo) {
                                panelMusicItem = {
                                    ...musicItem,
                                    ...additionalInfo,
                                    qualities:
                                        additionalInfo.qualities ??
                                        musicItem.qualities,
                                    id: musicItem.id,
                                    platform: musicItem.platform,
                                };
                            }
                        }
                    } catch {
                        // fall back to list item
                    }
                    showPanel("MusicQuality", {
                        isLocal: isDownloaded,
                        musicItem: panelMusicItem,
                        async onQualityPress(quality) {
                            const changeResult =
                                await TrackPlayer.changeQuality(quality);
                            if (!changeResult) {
                                Toast.warn(t("toast.currentQualityNotAvailableForCurrentMusic"));
                            }
                        },
                    });
                }}>
                <Text style={[styles.qualityText, { color: mediaForeground }]}>
                    {isDownloaded
                        ? localQualityAbbr ?? t("localQuality.abbr")
                        : getQualityAbbr(currentQuality) || "HQ"}
                </Text>
            </OperationButton>
            <OperationButton
                accessibilityLabel={
                    isDownloaded
                        ? t("musicDetail.a11y.downloaded")
                        : t("musicDetail.a11y.download")
                }
                onPress={async () => {
                    if (musicItem && !isDownloaded) {
                        // 显示加载状态
                        showDialog("LoadingDialog", {
                            title: t("downloading.downloadStatus.preparing"),
                        });

                        try {
                            // 获取插件实例
                            const plugin = PluginManager.getByName(musicItem.platform);
                            let enhancedMusicItem = musicItem;
                            
                            // Fetch full quality/size when missing or sizes are empty.
                            if (
                                plugin?.methods?.getMusicInfo &&
                                (!musicItem.qualities ||
                                    !musicItemHasQualitySizes(musicItem))
                            ) {
                                const additionalInfo = await plugin.methods.getMusicInfo(musicItem);
                                if (additionalInfo) {
                                    enhancedMusicItem = {
                                        ...musicItem,
                                        ...additionalInfo,
                                        qualities:
                                            additionalInfo.qualities ??
                                            musicItem.qualities,
                                        // 保持原有的基本信息不被覆盖
                                        id: musicItem.id,
                                        platform: musicItem.platform,
                                    };
                                }
                            }

                            // 隐藏加载对话框
                            hideDialog();

                            // 显示音质选择面板
                            showPanel("MusicQuality", {
                                type: "download",
                                musicItem: enhancedMusicItem,
                                async onQualityPress(quality) {
                                    downloader.download(enhancedMusicItem, quality);
                                },
                            });
                        } catch {
                            // 隐藏加载对话框
                            hideDialog();
                            
                            // 出错时使用原始音乐信息
                            showPanel("MusicQuality", {
                                type: "download",
                                musicItem,
                                async onQualityPress(quality) {
                                    downloader.download(musicItem, quality);
                                },
                            });
                        }
                    }
                }}>
                {/* 已下载用实心对勾：描边版在深色封面上读不出「已完成」 */}
                <Icon
                    name={isDownloaded ? "check-circle" : "arrow-down-tray"}
                    size={iconSizeConst.normal}
                    color={mediaForeground}
                />
            </OperationButton>
            <OperationButton
                accessibilityLabel={t("musicDetail.a11y.playRate")}
                onPress={() => {
                    if (!musicItem) {
                        return;
                    }
                    showPanel("PlayRate", {
                        async onRatePress(newRate) {
                            if (rate !== newRate) {
                                try {
                                    await TrackPlayer.setRate(newRate / 100);
                                    PersistStatus.set("music.rate", newRate);
                                } catch { }
                            }
                        },
                    });
                }}>
                <Image source={ImgAsset.rate[rate!]} style={styles.quality} />
            </OperationButton>
            <OperationButton
                accessibilityLabel={t("musicDetail.a11y.comment")}
                onPress={() => {
                    if (!supportComment) {
                        toast.warn(t("toast.commmentNotAvaliableForCurrentMusic"));
                        return;
                    }
                    if (musicItem) {
                        showPanel("MusicComment", {
                            musicItem,
                        });
                    }
                }}>
                <Icon
                    name="chat-bubble-oval-left-ellipsis"
                    size={iconSizeConst.normal}
                    color={mediaForeground}
                    opacity={supportComment ? 1 : 0.2}
                />
            </OperationButton>
            <OperationButton
                accessibilityLabel={t("musicDetail.a11y.more")}
                onPress={() => {
                    if (musicItem) {
                        showPanel("MusicItemOptions", {
                            musicItem: musicItem,
                            from: ROUTE_PATH.MUSIC_DETAIL,
                        });
                    }
                }}>
                <Icon
                    name="ellipsis-vertical"
                    size={iconSizeConst.normal}
                    color={mediaForeground}
                />
            </OperationButton>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        height: rpx(80),
        marginBottom: rpx(24),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
    },
    horizontalWrapper: {
        marginBottom: 0,
    },
    /** 与播放页控制区同样的圆形承载面，五个入口视觉重量一致 */
    operationButton: {
        width: rpx(76),
        height: rpx(76),
        borderRadius: rpx(38),
        alignItems: "center",
        justifyContent: "center",
    },
    pressed: {
        opacity: 0.72,
    },
    quality: {
        width: rpx(52),
        height: rpx(52),
    },
    qualityText: {
        fontSize: fontRpx(26),
        fontWeight: "400",
        lineHeight: fontRpx(42),
    },
});
