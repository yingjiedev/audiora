import { RequestStateCode } from "@/constants/commonConst";
import PluginManager from "@/core/pluginManager";
import { InteractionManager } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";

export default function usePluginSheetMusicList(
    originalSheetItem: IMusic.IMusicSheetItem | null,
) {
    const currentPageRef = useRef(1);
    const loadingRef = useRef(false);
    // 导入的歌单自带完整快照，无需再请求插件
    const isImportedSheet = !!originalSheetItem?.isImported;

    const [requestState, setRequestState] = useState<RequestStateCode>(
        isImportedSheet
            ? RequestStateCode.FINISHED
            : RequestStateCode.IDLE,
    );
    const [sheetItem, setSheetItem] = useState<IMusic.IMusicSheetItem | null>(
        originalSheetItem,
    );
    const [musicList, setMusicList] = useState<IMusic.IMusicItem[]>(
        originalSheetItem?.musicList ?? [],
    );

    const getSheetDetail = useCallback(
        async function () {
            // 加载中：直接退出
            if (loadingRef.current || isImportedSheet ||
                originalSheetItem === null ||
                requestState === RequestStateCode.FINISHED ||
                requestState === RequestStateCode.PENDING_FIRST_PAGE ||
                requestState === RequestStateCode.PENDING_REST_PAGE) {
                return;
            }
            loadingRef.current = true;
            try {
                const requestedPage = currentPageRef.current;
                if (currentPageRef.current === 1) {
                    setRequestState(RequestStateCode.PENDING_FIRST_PAGE);
                } else {
                    setRequestState(RequestStateCode.PENDING_REST_PAGE);
                }
                const result = await PluginManager.getByMedia(
                    originalSheetItem as any,
                )?.methods?.getMusicSheetInfo?.(
                    originalSheetItem,
                    currentPageRef.current,
                );
                if (!result) {
                    throw new Error();
                }
                if (result?.sheetItem) {
                    setSheetItem(prev => ({
                        ...(prev ?? {}),
                        ...(result.sheetItem as IMusic.IMusicSheetItem),
                        platform: originalSheetItem.platform,
                    }));
                }
                if (result?.musicList) {
                    setMusicList(prev => {
                        if (requestedPage === 1) {
                            return result?.musicList ?? prev;
                        } else {
                            return [...prev, ...(result.musicList ?? [])];
                        }
                    });
                }
                if (result.isEnd !== false || !result.musicList?.length) {
                    setRequestState(RequestStateCode.FINISHED);
                } else {
                    setRequestState(RequestStateCode.PARTLY_DONE);
                }
                currentPageRef.current += 1;
            } catch {
                setRequestState(RequestStateCode.ERROR);
            } finally {
                loadingRef.current = false;
            }
        },
        [requestState, originalSheetItem, isImportedSheet],
    );
    const loadInitialRef = useRef(getSheetDetail);
    loadInitialRef.current = getSheetDetail;

    useEffect(() => {
        // 转场动画还在播时立刻跑插件 JS 会卡掉新页首帧，
        // 表现为进入歌单详情没有滑入动画；等转场结束再发请求
        const task = InteractionManager.runAfterInteractions(() => {
            loadInitialRef.current();
        });
        return () => task.cancel();
    }, []);

    return [requestState, sheetItem, musicList, getSheetDetail] as const;
}
