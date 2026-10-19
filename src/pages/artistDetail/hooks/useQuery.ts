import { errorLog } from "@/utils/log";
import { RequestStateCode } from "@/constants/commonConst";
import { produce } from "immer";
import { getDefaultStore, useSetAtom } from "jotai";
import { useCallback } from "react";
import { queryResultAtom } from "../store/atoms";
import PluginManager from "@/core/pluginManager";
import { dedupeMediaItems } from "@/utils/mediaUtils";

let nextRequestId = 0;

export default function useQueryArtist(pluginHash: string) {
    const setQueryResults = useSetAtom(queryResultAtom);

    const queryArtist = useCallback(
        async (
            artist: IArtist.IArtistItem,
            page?: number,
            type: IArtist.ArtistMediaType = "music",
        ) => {
            const plugin = PluginManager.getByHash(pluginHash);

            const prevResult = getDefaultStore().get(queryResultAtom)[type];
            if (
                prevResult?.state === RequestStateCode.PENDING_FIRST_PAGE ||
                prevResult?.state === RequestStateCode.PENDING_REST_PAGE ||
                prevResult?.state === RequestStateCode.FINISHED
            ) {
                return;
            }
            page = page ?? ((prevResult.page ?? 0) + 1);
            const requestId = ++nextRequestId;
            const isCurrent = () => getDefaultStore().get(queryResultAtom)[type].requestId === requestId;
            try {
                setQueryResults(
                    produce(draft => {
                        draft[type].state = page === 1 ? RequestStateCode.PENDING_FIRST_PAGE : RequestStateCode.PENDING_REST_PAGE;
                        draft[type].requestId = requestId;
                    }),
                );
                const result = await plugin?.methods?.getArtistWorks?.(
                    artist,
                    page,
                    type,
                );
                if (!isCurrent()) {
                    return;
                }
                if (!result) {
                    throw new Error("作者来源不可用");
                }
                setQueryResults(
                    produce(draft => {
                        draft[type].page = page;
                        draft[type].state =
                            result?.isEnd === false && result.data?.length
                                ? RequestStateCode.PARTLY_DONE
                                : RequestStateCode.FINISHED;
                        if (page === 1) {
                            // 首页
                            draft[type].data = dedupeMediaItems(result?.data ?? []);
                        } else {
                            draft[type].data = dedupeMediaItems((draft[type].data ?? []).concat(
                                result?.data ?? [],
                            ));
                        }
                    }),
                );
            } catch (e) {
                if (!isCurrent()) {
                    return;
                }
                errorLog("拉取作者信息失败", e);
                setQueryResults(
                    produce(draft => {
                        draft[type].state = RequestStateCode.ERROR;
                    }),
                );
            }
        },
        [pluginHash, setQueryResults],
    );

    return queryArtist;
}
