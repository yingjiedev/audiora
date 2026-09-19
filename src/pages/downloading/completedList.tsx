import React, { useCallback, useEffect } from "react";
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
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import type { IDownloadRecord } from "@/core/downloadHistory";
import downloadHistory, { useDownloadHistory } from "@/core/downloadHistory";
import downloader from "@/core/downloader";
import LocalMusicSheet from "@/core/localMusicSheet";
import TrackPlayer from "@/core/trackPlayer";
import { getLocalPath } from "@/utils/mediaUtils";
import { iconSizeConst } from "@/constants/uiConst";
import {
    formatFileSize,
    formatQuality,
    formatRecordTime,
    groupRecordsByDate,
    openDownloadFolder,
    type IDownloadRecordGroup,
} from "./utils";

/** 已完成的单条：展示音质 / 大小 / 完成时间，文件缺失时整行转警示态 */
interface ICompletedRowRecord {
    kind: "record";
    record: IDownloadRecord;
}

interface ICompletedRowHeader {
    kind: "header";
    group: IDownloadRecordGroup;
}

type ICompletedRow = ICompletedRowRecord | ICompletedRowHeader;

function CompletedRow(props: { record: IDownloadRecord }) {
    const { record } = props;
    const { t } = useI18N();
    const colors = useColors();

    const musicItem = record.musicItem;
    const missing = !!record.fileMissing;
    const qualityText = formatQuality(record.quality);
    const sizeText = formatFileSize(record.fileSize);

    const meta = missing
        ? t("downloading.status.fileMissingDesc")
        : [qualityText, sizeText, formatRecordTime(record.updatedAt)]
            .filter(Boolean)
            .join(" · ");

    const openMenu = useCallback(() => {
        const localPath = getLocalPath(musicItem);
        showPanel("DownloadTaskOptions", {
            title: record.title,
            subtitle: [record.artist, qualityText, sizeText].filter(Boolean).join(" · "),
            options: [
                {
                    key: "play",
                    title: t("downloading.action.play"),
                    icon: "play" as const,
                    onPress: () => {
                        TrackPlayer.play(musicItem);
                    },
                },
                {
                    key: "open-folder",
                    title: t("downloading.action.openFolder"),
                    icon: "folder-outline" as const,
                    onPress: async () => {
                        const opened = await openDownloadFolder(localPath);
                        if (!opened) {
                            Toast.warn(t("downloading.toast.openFolderUnsupported"));
                        }
                    },
                },
                {
                    key: "redownload",
                    title: t("downloading.action.redownload"),
                    icon: "arrow-down-tray" as const,
                    onPress: () => {
                        downloader.download(musicItem, record.quality);
                    },
                },
                {
                    key: "remove-record",
                    title: t("downloading.action.removeRecord"),
                    icon: "trash-outline" as const,
                    hint: t("downloading.action.removeRecordHint"),
                    onPress: () => {
                        downloadHistory.removeRecord(record.mediaKey);
                    },
                },
                {
                    key: "delete-file",
                    title: t("downloading.action.deleteFile"),
                    icon: "trash-outline" as const,
                    hint: sizeText,
                    danger: true,
                    onPress: () => {
                        showDialog("SimpleDialog", {
                            title: t("downloading.action.deleteFile"),
                            content: t("downloading.action.deleteFileConfirm", {
                                title: record.title,
                            }),
                            async onOk() {
                                try {
                                    // 删除本地文件走 LocalMusicSheet：音频本体 + 附属歌词/封面，
                                    // 并且封面会先过「目录共享 / 仍被引用」两道校验（issue #63 / #68）
                                    await LocalMusicSheet.removeMusic(musicItem, true);
                                    downloadHistory.removeRecord(record.mediaKey);
                                    Toast.success(t("downloading.toast.deleteFileSuccess"));
                                } catch (e: any) {
                                    Toast.warn(
                                        `${t("panel.musicItemOptions.deleteFailed")} ${e?.message ?? e}`,
                                    );
                                }
                            },
                        });
                    },
                },
            ],
        });
    }, [musicItem, record, qualityText, sizeText, t]);

    const handleOpenFolder = async () => {
        const opened = await openDownloadFolder(getLocalPath(musicItem));
        if (!opened) {
            Toast.warn(t("downloading.toast.openFolderUnsupported"));
        }
    };

    return (
        <ListItem
            withHorizontalPadding
            style={missing ? { backgroundColor: colors.listActive } : undefined}>
            <ListItem.ListItemImage uri={musicItem.artwork} position="left" />
            <ListItem.Content
                title={record.title}
                description={
                    <View style={styles.descRow}>
                        {missing ? (
                            <View style={[styles.missingTag, { backgroundColor: colors.danger }]}>
                                <ThemeText
                                    fontSize="caption"
                                    fontWeight="bold"
                                    style={{ color: colors.onPrimary }}>
                                    {t("downloading.status.fileMissing")}
                                </ThemeText>
                            </View>
                        ) : qualityText ? (
                            <View style={[styles.qualityTag, { backgroundColor: colors.listActive }]}>
                                <ThemeText
                                    fontSize="caption"
                                    fontWeight="bold"
                                    style={{ color: colors.primary }}>
                                    {qualityText}
                                </ThemeText>
                            </View>
                        ) : null}
                        <ThemeText
                            numberOfLines={1}
                            fontSize="description"
                            fontColor={missing ? "danger" : "textSecondary"}
                            style={styles.descText}>
                            {meta}
                        </ThemeText>
                    </View>
                }
            />
            {missing ? (
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => downloader.download(musicItem, record.quality)}>
                    <ThemeText fontSize="description" fontWeight="medium" style={{ color: colors.primary }}>
                        {t("downloading.action.redownload")}
                    </ThemeText>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={styles.actionButton} onPress={handleOpenFolder}>
                    <Icon
                        name="folder-outline"
                        size={iconSizeConst.normal}
                        color={colors.text}
                    />
                </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionButton} onPress={openMenu}>
                <Icon
                    name="ellipsis-vertical"
                    size={iconSizeConst.normal}
                    color={colors.text}
                />
            </TouchableOpacity>
        </ListItem>
    );
}

export default function CompletedList() {
    const records = useDownloadHistory();
    const { t } = useI18N();

    // 进页面对一次账：文件被外部删掉的要标成「文件缺失」
    useEffect(() => {
        void downloadHistory.reconcileCompletedFiles();
    }, [records.length]);

    const completed = records.filter(item => item.status === "completed");

    if (completed.length === 0) {
        return (
            <Empty
                content={`${t("downloading.empty.completed.title")}\n${t(
                    "downloading.empty.completed.desc",
                )}`}
            />
        );
    }

    const groups = groupRecordsByDate(completed, t);

    const rows: ICompletedRow[] = [];
    for (const group of groups) {
        rows.push({ kind: "header", group });
        for (const record of group.data) {
            rows.push({ kind: "record", record });
        }
    }

    const clearGroup = (group: IDownloadRecordGroup) => {
        const removed = downloadHistory.removeRecords(
            group.data.map(item => item.mediaKey),
        );
        if (removed > 0) {
            Toast.success(
                t("downloading.toast.clearRecordsSuccess", { count: removed }),
            );
        }
    };

    return (
        <View style={styles.wrapper}>
            <FlashList
                data={rows}
                keyExtractor={(item: ICompletedRow) =>
                    item.kind === "header"
                        ? `h-${item.group.from}`
                        : `r-${item.record.mediaKey}`
                }
                getItemType={(item: ICompletedRow) => item.kind}
                renderItem={({ item }: { item: ICompletedRow }) =>
                    item.kind === "header" ? (
                        <View style={styles.groupHeader}>
                            <ThemeText
                                fontSize="description"
                                fontWeight="bold"
                                fontColor="textSecondary">
                                {item.group.title}
                            </ThemeText>
                            <TouchableOpacity onPress={() => clearGroup(item.group)}>
                                <ThemeText fontSize="description" fontColor="primary">
                                    {t("downloading.action.clearThisSection")}
                                </ThemeText>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <CompletedRow record={item.record} />
                    )
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    descRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: rpx(4),
    },
    descText: {
        flexShrink: 1,
    },
    qualityTag: {
        paddingHorizontal: rpx(8),
        paddingVertical: rpx(1),
        borderRadius: rpx(6),
        marginRight: rpx(8),
    },
    missingTag: {
        paddingHorizontal: rpx(8),
        paddingVertical: rpx(1),
        borderRadius: rpx(6),
        marginRight: rpx(8),
    },
    actionButton: {
        paddingHorizontal: rpx(10),
        justifyContent: "center",
        alignItems: "center",
    },
    groupHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: rpx(24),
        paddingTop: rpx(20),
        paddingBottom: rpx(8),
    },
});
