import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { getFSInfo } from "react-native-fs";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import { TouchableOpacity } from "react-native";
import { useI18N } from "@/core/i18n";
import { useAppConfig } from "@/core/appConfig";
import downloadHistory from "@/core/downloadHistory";
import { formatFileSize } from "../utils";

/** 低于这个剩余空间就切成警示态（原型 B3） */
const LOW_STORAGE_THRESHOLD = 1024 * 1024 * 1024;

interface IOverviewCardProps {
    /** 队列中活跃（含暂停）的任务数 */
    queueActive: number;
    pausedCount: number;
    onToggleAll: () => void;
}

/**
 * 下载管理页的概览卡（原型 B）。
 *
 * 把 issue 要求的三件事放在一张卡里：已下载占用空间、队列长度、并发上限，
 * 并顺带承担「空间不足」的入口——下载页本来就是存储管理的主场。
 */
export default function OverviewCard(props: IOverviewCardProps) {
    const { queueActive, pausedCount, onToggleAll } = props;
    const { t } = useI18N();
    const colors = useColors();
    const maxDownload = useAppConfig("basic.maxDownload") ?? 3;
    const completedCount = downloadHistory.records.filter(
        item => item.status === "completed",
    ).length;

    const [freeSpace, setFreeSpace] = useState<number | null>(null);

    useEffect(() => {
        let alive = true;
        // getFSInfo 在个别 ROM 上不可用，拿不到就不显示这一行，不阻塞渲染
        getFSInfo()
            .then(info => {
                if (alive && typeof info?.freeSpace === "number") {
                    setFreeSpace(info.freeSpace);
                }
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    const usedSize = downloadHistory.getCompletedTotalSize();
    // 文件全在授权目录里时 stat 不到大小，usedSize 会是 0 —— 那是「没数」不是「零字节」，
    // 这种情况只显示能确定的部分，别甩一个 0B 出来
    const usedSizeText = usedSize > 0 ? formatFileSize(usedSize) : "";
    const lowStorage =
        typeof freeSpace === "number" && freeSpace < LOW_STORAGE_THRESHOLD;

    const cardStyle = lowStorage
        ? [
            styles.card,
            {
                backgroundColor: colors.danger
                    ? `${colors.danger}1F`
                    : colors.surfaceElevated,
                borderColor: colors.danger ?? colors.border,
            },
        ]
        : [
            styles.card,
            {
                backgroundColor: colors.card,
                borderColor: colors.border,
            },
        ];

    return (
        <View style={cardStyle}>
            <View style={styles.topRow}>
                <View style={styles.stats}>
                    {lowStorage ? (
                        <View>
                            <ThemeText
                                fontSize="subTitle"
                                fontWeight="bold"
                                fontColor="danger"
                                numberOfLines={1}>
                                {t("downloading.overview.lowStorage")}
                            </ThemeText>
                            <ThemeText
                                fontSize="description"
                                fontColor="textSecondary"
                                style={styles.label}
                                numberOfLines={1}>
                                {usedSizeText
                                    ? t("downloading.overview.lowStorageDesc", {
                                        free: formatFileSize(freeSpace ?? 0),
                                        used: usedSizeText,
                                    })
                                    : t("downloading.overview.lowStorageDescNoUsed", {
                                        free: formatFileSize(freeSpace ?? 0),
                                    })}
                            </ThemeText>
                        </View>
                    ) : (
                        <>
                            <View>
                                <ThemeText
                                    fontSize="title"
                                    fontWeight="bold"
                                    numberOfLines={1}>
                                    {completedCount}
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary">
                                        {` ${t("common.singleMusic")}`}
                                    </ThemeText>
                                </ThemeText>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="textSecondary"
                                    style={styles.label}
                                    numberOfLines={1}>
                                    {t("downloading.overview.downloaded")}
                                    {usedSizeText ? ` · ${usedSizeText}` : ""}
                                </ThemeText>
                            </View>
                            <View>
                                <ThemeText
                                    fontSize="title"
                                    fontWeight="bold"
                                    numberOfLines={1}>
                                    {queueActive}
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary">
                                        {` / ${maxDownload}`}
                                    </ThemeText>
                                </ThemeText>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="textSecondary"
                                    style={styles.label}
                                    numberOfLines={1}>
                                    {t("downloading.overview.queue")}
                                    {` · ${t("downloading.overview.concurrency")}`}
                                </ThemeText>
                            </View>
                        </>
                    )}
                </View>

                <TouchableOpacity
                    style={[
                        styles.action,
                        {
                            backgroundColor: lowStorage
                                ? (colors.danger ?? colors.primary)
                                : colors.listActive,
                        },
                    ]}
                    onPress={onToggleAll}>
                    <Icon
                        name={pausedCount > 0 ? "play" : "pause"}
                        size={rpx(28)}
                        color={lowStorage ? colors.onPrimary : colors.primary}
                    />
                    <ThemeText
                        fontSize="description"
                        fontWeight="medium"
                        style={{
                            color: lowStorage ? colors.onPrimary : colors.primary,
                            marginLeft: rpx(6),
                        }}>
                        {pausedCount > 0
                            ? t("downloading.overview.resumeAll")
                            : t("downloading.overview.pauseAll")}
                    </ThemeText>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: rpx(24),
        marginBottom: rpx(16),
        padding: rpx(24),
        borderRadius: rpx(28),
        borderWidth: StyleSheet.hairlineWidth,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
    },
    stats: {
        flexDirection: "row",
        gap: rpx(40),
        flex: 1,
        marginRight: rpx(16),
    },
    label: {
        marginTop: rpx(6),
    },
    action: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(20),
        paddingVertical: rpx(12),
        borderRadius: rpx(20),
    },
});
