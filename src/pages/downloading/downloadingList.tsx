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
import downloader, {
    DownloadStatus,
    useDownloadQueue,
    useDownloadTask,
} from "@/core/downloader";
import { iconSizeConst } from "@/constants/uiConst";
import { formatFileSize } from "./utils";

function DownloadingRow(props: { musicItem: IMusic.IMusicItem }) {
    const { musicItem } = props;
    const taskInfo = useDownloadTask(musicItem);
    const { t } = useI18N();
    const colors = useColors();

    const status = taskInfo?.status ?? DownloadStatus.Pending;
    const total = taskInfo?.fileSize ?? 0;
    const downloaded = taskInfo?.downloadedSize ?? 0;
    const progress =
        total > 0 && downloaded > 0 ? Math.min(downloaded / total, 1) : 0;

    let description: string;
    if (status === DownloadStatus.Paused) {
        description =
            total > 0
                ? `${t("downloading.downloadStatus.paused")} · ${formatFileSize(downloaded)} / ${formatFileSize(total)}`
                : t("downloading.downloadStatus.paused");
    } else if (taskInfo?.progressText) {
        // 优先用原生上报的文案，保证和通知栏完全一致
        description = taskInfo.progressText;
    } else if (status === DownloadStatus.Pending) {
        description = t("downloading.downloadStatus.pending");
    } else if (total > 0) {
        description = `${formatFileSize(downloaded)} / ${formatFileSize(total)}`;
    } else if (downloaded > 0) {
        description = `${t("common.download")} ${formatFileSize(downloaded)}`;
    } else {
        description = t("downloading.downloadStatus.preparing");
    }

    const paused = status === DownloadStatus.Paused;
    const showProgress =
        status === DownloadStatus.Downloading ||
        (status === DownloadStatus.Pending && downloaded > 0);

    const handleToggle = async () => {
        const ok = paused
            ? await downloader.resume(musicItem)
            : await downloader.pause(musicItem);
        if (!ok) {
            Toast.warn(t("downloading.toast.pauseUnsupported"));
        }
    };

    const handleRemove = () => {
        if (downloader.remove(musicItem)) {
            Toast.success(t("toast.deleteSuccess"));
        } else {
            Toast.warn(t("toast.deleteFailed"));
        }
    };

    return (
        <ListItem withHorizontalPadding>
            <ListItem.ListItemImage uri={musicItem.artwork} position="left" />
            <ListItem.Content
                title={musicItem.title}
                description={
                    <View>
                        <ThemeText
                            numberOfLines={1}
                            fontSize="description"
                            fontColor="textSecondary">
                            {description}
                        </ThemeText>
                        {showProgress ? (
                            <View
                                style={[
                                    styles.progressTrack,
                                    { backgroundColor: colors.placeholder },
                                ]}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            backgroundColor: colors.primary,
                                            width: `${progress * 100}%`,
                                        },
                                    ]}
                                />
                            </View>
                        ) : null}
                    </View>
                }
            />
            <TouchableOpacity style={styles.actionButton} onPress={handleToggle}>
                <Icon
                    name={paused ? "play" : "pause"}
                    size={iconSizeConst.normal}
                    color={colors.text}
                />
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

export default function DownloadingList() {
    const downloadQueue = useDownloadQueue();
    const { t } = useI18N();

    if (downloadQueue.length === 0) {
        return (
            <Empty
                content={`${t("downloading.empty.downloading.title")}\n${t(
                    "downloading.empty.downloading.desc",
                )}`}
            />
        );
    }

    return (
        <View style={styles.wrapper}>
            <FlashList
                data={downloadQueue}
                keyExtractor={item => `dl-${item.platform}.${item.id}`}
                renderItem={({ item }) => <DownloadingRow musicItem={item} />}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    progressTrack: {
        height: rpx(6),
        borderRadius: rpx(3),
        marginTop: rpx(10),
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: rpx(3),
    },
    actionButton: {
        paddingHorizontal: rpx(12),
        justifyContent: "center",
        alignItems: "center",
    },
});
