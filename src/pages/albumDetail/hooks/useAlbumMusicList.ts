import { RequestStateCode } from "@/constants/commonConst";
import PluginManager from "@/core/pluginManager";
import { InteractionManager } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";

export default function useAlbumDetail(
    originalAlbumItem: IAlbum.IAlbumItem | null,
) {
    const currentPageRef = useRef(1);
    const loadingRef = useRef(false);

    const [requestState, setRequestState] = useState<RequestStateCode>(RequestStateCode.IDLE);
    const [albumItem, setAlbumItem] = useState<IAlbum.IAlbumItemBase | null>(
        originalAlbumItem,
    );
    const [musicList, setMusicList] = useState<IMusic.IMusicItem[]>(
        originalAlbumItem?.musicList ?? [],
    );

    const getAlbumDetail = useCallback(
        async function () {
            // 加载中：直接退出
            if (loadingRef.current || originalAlbumItem === null ||
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
                    originalAlbumItem,
                )?.methods?.getAlbumInfo?.(
                    originalAlbumItem,
                    currentPageRef.current,
                );
                if (!result) {
                    throw new Error();
                }
                if (result?.albumItem) {
                    setAlbumItem(prev => ({
                        ...(prev ?? {}),
                        ...(result.albumItem as IAlbum.IAlbumItemBase),
                        platform: originalAlbumItem.platform,
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
        [originalAlbumItem, requestState],
    );
    const loadInitialRef = useRef(getAlbumDetail);
    loadInitialRef.current = getAlbumDetail;

    useEffect(() => {
        // 转场动画期间跑插件 JS 会卡掉新页首帧，进入动画会丢
        const task = InteractionManager.runAfterInteractions(() => {
            loadInitialRef.current();
        });
        return () => task.cancel();
    }, []);

    return [requestState, albumItem, musicList, getAlbumDetail] as const;
}
