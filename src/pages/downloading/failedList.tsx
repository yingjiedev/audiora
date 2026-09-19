import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import rpx from "@/utils/rpx";
import ListItem from "@/components/base/listItem";
import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import Empty from "@/components/base/empty";
import useColors from "@/hooks/useColors";
import { useI18N } from "@/core/i18n";
import Toast from "@/utils/toast";
import type { IDownloadRecord } from "@/core/downloadHistory";
import downloadHistory, { useDownloadHistory } from "@/core/downloadHistory";
import downloader from "@/core/downloader";
import { iconSizeConst } from "@/constants/uiConst";
import {
    formatRecordTime,
    getFailReasonIcon,
    getFailReasonLabel,
} from "./utils";

function FailedRow(props: { record: IDownloadRecord }) {
    const { record } = props;
    const { t } = useI18N();
    const colors = useColors();

    const musicItem = record.musicItem;
    const reasonText = getFailReasonLabel(record.errorReason, t);

    const handleRetry = () => {
        const started = downloader.retry(musicItem, record.quality);
        if (!started) {
            // network 拦截时 retry 内部已经发过 DownloadError 事件，这里不再重复提示
            return;
        }
    };

    const handleRemove = () => {
        downloadHistory.removeRecord(record.mediaKey);
        Toast.success(t("toast.deleteSuccess"));
    };

    return (
        <ListItem withHorizontalPadding>
            <ListItem.ListItemImage uri={musicItem.artwork} position="left" />
            <ListItem.Content
                title={record.title}
                description={
                    <View style={styles.descRow}>
                        <Icon
                            name={getFailReasonIcon(record.errorReason)}
                            size={rpx(26)}
                            color={colors.danger}
                        />
                        <ThemeText
                            numberOfLines={1}
                            fontSize="description"
                            fontColor="danger"
                            style={styles.descText}>
                            {reasonText}
                        </ThemeText>
                        <ThemeText
                            numberOfLines={1}
                            fontSize="description"
                            fontColor="textSecondary">
                            {` · ${formatRecordTime(record.updatedAt)}`}
                        </ThemeText>
                    </View>
                }
            />
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Icon
                    name="arrow-path"
                    size={rpx(28)}
                    color={colors.primary}
                />
                <ThemeText
                    fontSize="description"
                    fontWeight="medium"
                    style={{ color: colors.primary, marginLeft: rpx(6) }}>
                    {t("downloading.action.retry")}
                </ThemeText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleRemove}>
                <Icon
                    name="trash-outline"
                    size={iconSizeConst.normal}
                    color={colors.danger}
                />
            </TouchableOpacity>
        </ListItem>
    );
}

export default function FailedList() {
    const records = useDownloadHistory();
    const { t } = useI18N();
    const colors = useColors();

    const failed = records.filter(item => item.status === "error");

    if (failed.length === 0) {
        return (
            <Empty
                content={`${t("downloading.empty.failed.title")}\n${t(
                    "downloading.empty.failed.desc",
                )}`}
            />
        );
    }

    return (
        <View style={styles.wrapper}>
            <View style={styles.listWrapper}>
                <FlashList
                    data={failed}
                    keyExtractor={item => `fail-${item.mediaKey}`}
                    renderItem={({ item }) => <FailedRow record={item} />}
                />
            </View>
            <View style={[styles.batchBar, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                    style={[
                        styles.batchButton,
                        { backgroundColor: colors.listActive },
                    ]}
                    onPress={() => {
                        for (const record of failed) {
                            downloader.retry(record.musicItem, record.quality);
                        }
                    }}>
                    <ThemeText fontSize="description" fontWeight="medium" fontColor="primary">
                        {t("downloading.action.retryAll")}
                    </ThemeText>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.batchButton,
                        {
                            backgroundColor: colors.danger
                                ? `${colors.danger}1F`
                                : colors.surfaceElevated,
                        },
                    ]}
                    onPress={() => {
                        const removed = downloadHistory.clearError();
                        Toast.success(
                            t("downloading.toast.clearRecordsSuccess", { count: removed }),
                        );
                    }}>
                    <ThemeText fontSize="description" fontWeight="medium" fontColor="danger">
                        {t("downloading.clearErrorTasks")}
                    </ThemeText>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    listWrapper: {
        flex: 1,
        width: "100%",
    },
    batchBar: {
        flexDirection: "row",
        gap: rpx(16),
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(12),
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    batchButton: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: rpx(16),
        borderRadius: rpx(20),
    },
    descRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: rpx(4),
    },
    descText: {
        marginLeft: rpx(6),
        flexShrink: 1,
    },
    retryButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(16),
        paddingVertical: rpx(10),
        borderRadius: rpx(20),
        marginRight: rpx(4),
    },
    actionButton: {
        paddingHorizontal: rpx(10),
        justifyContent: "center",
        alignItems: "center",
    },
    headerRow: {
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(8),
    },
});
