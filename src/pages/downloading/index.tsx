import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import StatusBar from "@/components/base/statusBar";
import DownloadingList from "./downloadingList";
import CompletedList from "./completedList";
import FailedList from "./failedList";
import OverviewCard from "./components/overviewCard";
import MusicBar from "@/components/musicBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import AppBar from "@/components/base/appBar";
import PillTabBar from "@/components/base/pillTabBar";
import { showDialog } from "@/components/dialogs/useDialog";
import { useI18N } from "@/core/i18n";
import downloader, { useDownloadQueue } from "@/core/downloader";
import { DownloaderEvent } from "@/core/downloadTypes";
import downloadHistory, { useDownloadHistory } from "@/core/downloadHistory";
import Toast from "@/utils/toast";

type ITabKey = "downloading" | "completed" | "failed";

export default function Downloading() {
    const { t } = useI18N();
    const [index, setIndex] = useState(0);

    const downloadQueue = useDownloadQueue();
    const records = useDownloadHistory();

    const tabs = useMemo<Array<{ key: ITabKey; title: string; count: number }>>(
        () => [
            {
                key: "downloading",
                title: t("downloading.tab.downloading"),
                count: downloadQueue.length,
            },
            {
                key: "completed",
                title: t("downloading.tab.completed"),
                count: records.filter(item => item.status === "completed").length,
            },
            {
                key: "failed",
                title: t("downloading.tab.failed"),
                count: records.filter(item => item.status === "error").length,
            },
        ],
        [downloadQueue.length, records, t],
    );

    // 概览卡的队列数要在任务状态变化时跟着动，这里订阅 downloader 的任务更新事件
    const [queueStats, setQueueStats] = useState(() => downloader.getQueueStats());
    React.useEffect(() => {
        const sync = () => setQueueStats(downloader.getQueueStats());
        sync();
        downloader.on(DownloaderEvent.DownloadTaskUpdate, sync);
        return () => {
            downloader.off(DownloaderEvent.DownloadTaskUpdate, sync);
        };
    }, [downloadQueue]);

    const handleToggleAll = async () => {
        if (queueStats.paused > 0) {
            const resumed = await downloader.resumeAll();
            Toast.success(
                t("downloading.toast.resumeAllSuccess", { count: resumed }),
            );
            return;
        }
        const paused = await downloader.pauseAll();
        if (paused > 0) {
            Toast.success(t("downloading.toast.pauseAllSuccess", { count: paused }));
        } else {
            Toast.warn(t("downloading.toast.pauseUnsupported"));
        }
    };

    const clearCompletedRecords = () => {
        const count = records.filter(item => item.status === "completed").length;
        if (count === 0) {
            return;
        }
        showDialog("SimpleDialog", {
            title: t("downloading.action.clearRecords"),
            content: t("downloading.action.clearRecordsConfirm", { count }),
            onOk() {
                const removed = downloadHistory.clearCompleted();
                Toast.success(
                    t("downloading.toast.clearRecordsSuccess", { count: removed }),
                );
            },
        });
    };

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar
                menu={[
                    {
                        icon: "trash-outline",
                        title: t("downloading.action.clearRecords"),
                        onPress: clearCompletedRecords,
                    },
                    {
                        icon: "arrow-path",
                        title: t("downloading.action.retryAll"),
                        onPress: () => {
                            for (const record of records) {
                                if (record.status === "error") {
                                    downloader.retry(record.musicItem, record.quality);
                                }
                            }
                        },
                    },
                    {
                        icon: "trash-outline",
                        title: t("downloading.clearErrorTasks"),
                        onPress: () => {
                            const removed = downloadHistory.clearError();
                            if (removed > 0) {
                                Toast.success(
                                    t("downloading.toast.clearRecordsSuccess", {
                                        count: removed,
                                    }),
                                );
                            } else {
                                Toast.warn(t("downloading.noErrorTasksToClear"));
                            }
                        },
                    },
                ]}>
                {t("downloading.title")}
            </AppBar>
            <OverviewCard
                queueActive={queueStats.active + queueStats.paused}
                pausedCount={queueStats.paused}
                onToggleAll={handleToggleAll}
            />
            <PillTabBar
                variant="underline"
                routes={tabs}
                index={index}
                onIndexChange={setIndex}
                getTitle={route => route.title}
                getBadge={route => route.count}
            />
            <View style={styles.body}>
                {index === 0 ? <DownloadingList /> : null}
                {index === 1 ? <CompletedList /> : null}
                {index === 2 ? <FailedList /> : null}
            </View>
            <MusicBar />
        </VerticalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    body: {
        flex: 1,
        width: "100%",
    },
});
