import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";
import Loading from "@/components/base/loading";
import { RequestStateCode } from "@/constants/commonConst";
import useMediaGrid from "@/hooks/useMediaGrid";
import { spacing } from "@/constants/designSystem";
import { FlashList } from "@shopify/flash-list";
import { getDefaultStore, useAtomValue } from "jotai";
import React, { memo, useCallback, useEffect } from "react";
import useSearch from "../../hooks/useSearch";
import { ISearchResult, queryAtom, searchResultsAtom } from "../../store/atoms";
import { renderMap } from "./results";
import { SourceIssue } from "./sourceFeedback";
import { useNavigate } from "@/core/router";
import useMusicListSource from "@/hooks/useMusicListSource";
import BatchEditAction from "@/components/musicList/batchEditAction";

interface IResultWrapperProps<
    T extends ICommon.SupportMediaType = ICommon.SupportMediaType,
> {
    tab: T;
    pluginHash: string;
    pluginName: string;
    searchResult: ISearchResult<T>;
    pluginSearchResultRef: React.MutableRefObject<ISearchResult<T>>;
}
function ResultWrapper(props: IResultWrapperProps) {
    const { tab, pluginHash, pluginName, searchResult, pluginSearchResultRef } = props;
    const search = useSearch();
    const navigate = useNavigate();
    const issue = searchResult?.state === RequestStateCode.ERROR ? <SourceIssue standalone pluginHash={pluginHash} type={tab} result={searchResult}
        search={search} onManage={() => navigate("setting", { type: "plugin" })} /> : null;
    const searchState = searchResult?.state ?? RequestStateCode.IDLE;
    const columns = useMediaGrid();
    const query = useAtomValue(queryAtom);

    const ResultComponent = renderMap[tab]!;
    const data: any = searchResult?.data ?? [];
    const { source, sourceId } = useMusicListSource(
        { musicList: data, state: searchState },
        async retry => {
            await search(undefined, undefined, tab, pluginHash, retry ? "retry" : "next");
            const result = getDefaultStore().get(searchResultsAtom)[tab][pluginHash];
            return { musicList: (result?.data ?? []) as IMusic.IMusicItem[], state: result?.state ?? RequestStateCode.ERROR };
        },
    );

    const keyExtractor = useCallback(
        (item: any, i: number) => `${i}-${item.platform}-${item.id}`,
        [],
    );

    useEffect(() => {
        if (searchState === RequestStateCode.IDLE) {
            search(undefined, undefined, tab, pluginHash, "ensure");
        }
    }, [search, searchState, tab, pluginHash]);

    const renderItem = ({ item, index }: any) => (
        <ResultComponent
            item={item}
            index={index}
            pluginHash={pluginHash}
            pluginSearchResultRef={pluginSearchResultRef}
            query={searchResult?.query ?? query}
        />
    );

    return searchState === RequestStateCode.PENDING_FIRST_PAGE ? (
        <Loading />
    ) : (
        <FlashList
            ListHeaderComponent={tab === "music" ? <BatchEditAction musicList={data} sourceId={sourceId} title={`${searchResult?.query ?? query} · ${pluginName}`} /> : null}
            key={tab === "sheet" ? columns : 1}
            contentContainerStyle={tab === "sheet" ? { paddingHorizontal: spacing.xxxl - spacing.xs, paddingBottom: spacing.xxxl } : { paddingBottom: spacing.xxxl }}
            extraData={searchState}
            ListEmptyComponent={issue ?? <ListEmpty state={searchState} onRetry={() => {
                search(undefined, undefined, tab, pluginHash, "retry");
            }} />}
            ListFooterComponent={data?.length ? issue ?? <ListFooter state={searchState} onRetry={() => {
                search(undefined, undefined, tab, pluginHash, "retry");
            }} /> : null}
            data={data}
            refreshing={false}
            onRefresh={() => {
                search(undefined, 1, tab, pluginHash, "refresh");
            }}
            onEndReached={() => {
                (searchState === RequestStateCode.PARTLY_DONE ||
                    searchState === RequestStateCode.IDLE) &&
                    source.loadMore();
            }}
            numColumns={
                tab === "sheet" ? columns : 1
            }
            renderItem={renderItem}
            keyExtractor={keyExtractor}
        />
    );
}

export default memo(ResultWrapper);
