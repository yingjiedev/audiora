import Empty from "@/components/base/empty";
import AppBar from "@/components/base/appBar";
import { PageAction, PageState } from "@/components/base/pageSection";
import { spacing } from "@/constants/designSystem";

import Loading from "@/components/base/loading";
import StatusBar from "@/components/base/statusBar";
import Button from "@/components/base/textButton.tsx";
import ThemeText from "@/components/base/themeText";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import i18n from "@/core/i18n";
import { useParams } from "@/core/router";
import useHardwareBack from "@/hooks/useHardwareBack";
import rpx from "@/utils/rpx";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { ExternalStorageDirectoryPath, exists, getAllExternalFilesDirs, readDir } from "react-native-fs";
import { FlatList } from "react-native-gesture-handler";
import { getDocumentAsync } from "expo-document-picker";
import FileItem from "./fileItem";
import { errorLog } from "@/utils/log";
import Toast from "@/utils/toast";
import { requestAndroidDirectoryAccess } from "@/utils/androidSaf";

interface IPathItem {
    path: string;
    parent: null | IPathItem;
}

interface IFileItem {
    path: string;
    type: "file" | "folder";
}

const ITEM_HEIGHT = rpx(96);

export default function FileSelector() {
    const {
        fileType = "file-and-folder",
        multi = true,
        actionText = i18n.t("common.sure"),
        matchExtension,
        onAction,
    } = useParams<"file-selector">() ?? {};

    const [currentPath, setCurrentPath] = useState<IPathItem>({
        path: "/",
        parent: null,
    });
    const currentPathRef = useRef<IPathItem>(currentPath);
    const [filesData, setFilesData] = useState<IFileItem[]>([]);
    const [checkedItems, setCheckedItems] = useState<IFileItem[]>([]);

    const checkedPaths = useMemo(
        () => checkedItems.map(_ => _.path),
        [checkedItems],
    );
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [readError, setReadError] = useState(false);
    const systemPickerStarted = useRef(false);

    useEffect(() => {
        if (Platform.OS === "android") {
            if (systemPickerStarted.current) {
                return;
            }
            systemPickerStarted.current = true;
            setLoading(true);
            void (async () => {
                try {
                    if (fileType === "folder") {
                        const directoryUri = await requestAndroidDirectoryAccess();
                        if (!directoryUri) {
                            navigation.goBack();
                            return;
                        }
                        await onAction?.([{
                            path: directoryUri,
                            type: "folder",
                        }]);
                        navigation.goBack();
                        return;
                    }

                    const result = await getDocumentAsync({
                        copyToCacheDirectory: false,
                        multiple: multi,
                        type: fileType === "file" ? "audio/*" : "*/*",
                    });
                    if (result.canceled) {
                        navigation.goBack();
                        return;
                    }

                    const selectedFiles = result.assets.map(asset => ({
                        path: asset.uri,
                        type: "file" as const,
                    }));
                    await onAction?.(selectedFiles);
                    navigation.goBack();
                } catch (error) {
                    errorLog("Android 文件选择失败", error);
                    Toast.warn(i18n.t("toast.folderNotExistOrNoPermission"));
                    navigation.goBack();
                } finally {
                    setLoading(false);
                }
            })();
            return;
        }

        (async () => {
            // 路径变化时，重新读取
            setLoading(true);
            setReadError(false);
            try {
                if (currentPath.path === "/") {
                    try {
                        const allExt = await getAllExternalFilesDirs();
                        if (allExt.length > 1) {
                            const sdCardPaths = allExt.map(sdp =>
                                sdp.substring(0, sdp.indexOf("/Android")),
                            );
                            if (
                                (
                                    await Promise.all(
                                        sdCardPaths.map(_ => exists(_)),
                                    )
                                ).every(val => val)
                            ) {
                                setFilesData(
                                    sdCardPaths.map(_ => ({
                                        type: "folder",
                                        path: _,
                                    })),
                                );
                            }
                        } else {
                            setCurrentPath({
                                path: ExternalStorageDirectoryPath,
                                parent: null,
                            });
                            return;
                        }
                    } catch {
                        setCurrentPath({
                            path: ExternalStorageDirectoryPath,
                            parent: null,
                        });
                        return;
                    }
                } else {
                    const res = (await readDir(currentPath.path)) ?? [];
                    let folders: IFileItem[] = [];
                    let files: IFileItem[] = [];
                    if (
                        fileType === "folder" ||
                        fileType === "file-and-folder"
                    ) {
                        folders = res
                            .filter(_ => _.isDirectory())
                            .map(_ => ({
                                type: "folder",
                                path: _.path,
                            }));
                    }
                    if (fileType === "file" || fileType === "file-and-folder") {
                        files = res
                            .filter(
                                _ =>
                                    _.isFile() &&
                                    (matchExtension
                                        ? matchExtension(_.path)
                                        : true),
                            )
                            .map(_ => ({
                                type: "file",
                                path: _.path,
                            }));
                    }
                    setFilesData([...folders, ...files]);
                }
            } catch {
                setReadError(true);
                setFilesData([]);
            }
            setLoading(false);
            currentPathRef.current = currentPath;
        })();
    }, [currentPath, fileType, matchExtension, multi, navigation, onAction]);

    useHardwareBack(() => {
        // 注意闭包
        const _currentPath = currentPathRef.current;
        if (_currentPath.parent !== null) {
            setCurrentPath(_currentPath.parent);
        } else {
            navigation.goBack();
        }
        return true;
    });

    const selectPath = useCallback(
        (item: IFileItem | IFileItem[], nextChecked: boolean) => {
            if (multi) {
                if (!Array.isArray(item)) {
                    item = [item];
                }
                setCheckedItems(prev => {
                    const itemPaths = (item as IFileItem[]).map(_ => _.path);
                    const newCheckedItem = prev.filter(
                        _ => !itemPaths.includes(_.path),
                    );
                    if (nextChecked) {
                        return [...newCheckedItem, ...(item as IFileItem[])];
                    } else {
                        return newCheckedItem;
                    }
                });
            } else {
                setCheckedItems(
                    nextChecked ? (Array.isArray(item) ? item : [item]) : [],
                );
            }
        },
        [multi],
    );

    const renderItem = ({ item }: { item: IFileItem }) => (
        <FileItem
            path={item.path}
            type={item.type}
            parentPath={currentPath.path}
            onItemPress={currentChecked => {
                if (item.type === "folder") {
                    setCurrentPath(prev => ({
                        parent: prev,
                        path: item.path,
                    }));
                } else {
                    selectPath(item, !currentChecked);
                }
            }}
            checked={checkedPaths.includes(item.path)}
            onCheckedChange={checked => {
                selectPath(item, checked);
            }}
        />
    );

    const currentPageAllChecked = useMemo(() => {
        return (
            filesData.length &&
            filesData.every(file => checkedPaths.includes(file.path))
        );
    }, [filesData, checkedPaths]);

    const renderHeader = () => {
        return multi ? (
            <View style={style.selectAll}>
                <Button
                    onPress={() => {
                        if (currentPageAllChecked) {
                            selectPath(filesData, false);
                        } else {
                            selectPath(filesData, true);
                        }
                    }}>
                    {i18n.t(currentPageAllChecked ? "common.unselectAll" : "common.selectAll")}
                </Button>
            </View>
        ) : null;
    };

    if (Platform.OS === "android") return <VerticalSafeAreaView style={globalStyle.fwflex1}><StatusBar />
        <AppBar>{i18n.t("common.open")}</AppBar><PageState title={i18n.t("subpage.systemPicker")} description={i18n.t("common.loading")}
            action={<PageAction title={i18n.t("common.cancel")} onPress={() => navigation.goBack()} />} /></VerticalSafeAreaView>;
    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar onBackPress={() => currentPath.parent ? setCurrentPath(currentPath.parent) : navigation.goBack()}>
                <ThemeText numberOfLines={2} ellipsizeMode="head" fontColor="appBarText" style={style.headerPath}>{currentPath.path}</ThemeText>
            </AppBar>
            {loading ? (
                <Loading />
            ) : (
                <>
                    <FlatList
                        ListHeaderComponent={renderHeader}
                        ListEmptyComponent={readError ? <PageState tone="danger" title={i18n.t("toast.folderNotExistOrNoPermission")} action={<PageAction title={i18n.t("common.clickToRetry")} onPress={() => setCurrentPath({ ...currentPath })} />} /> : <Empty />}
                        style={globalStyle.fwflex1}
                        data={filesData}
                        getItemLayout={(_, index) => ({
                            length: ITEM_HEIGHT,
                            offset: ITEM_HEIGHT * index,
                            index,
                        })}
                        renderItem={renderItem}
                    />
                </>
            )}
            <View style={style.confirm}><PageAction variant="primary" size="standard" fullWidth title={actionText + (multi ? " · " + i18n.t("subpage.selectedFiles", { count: checkedItems.length }) : "")} disabled={!checkedItems.length}
                onPress={async () => {
                    const shouldBack = await onAction?.(checkedItems); if (shouldBack) navigation.goBack();
                }} /></View>
        </VerticalSafeAreaView>
    );
}

const style = StyleSheet.create({
    confirm: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.md },
    header: {
        height: rpx(88),
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        paddingHorizontal: rpx(24),
    },
    headerPath: {
        flex: 1,
        minWidth: 0,
    },
    scanBtn: {
        width: "100%",
        height: rpx(120),
        alignItems: "center",
        justifyContent: "center",
    },
    selectAll: {
        width: "100%",
        height: ITEM_HEIGHT,
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
    },
});
