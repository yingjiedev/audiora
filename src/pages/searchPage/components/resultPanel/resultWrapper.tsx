import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";
import Loading from "@/components/base/loading";
import { RequestStateCode } from "@/constants/commonConst";
import useMediaGrid from "@/hooks/useMediaGrid";
import { spacing } from "@/constants/designSystem";
import { FlashList } from "@shopify/flash-list";
import { useAtomValue } from "jotai";
import React, { memo, useCallback, useEffect } from "react";
import useSearch from "../../hooks/useSearch";
import { ISearchResult, queryAtom } from "../../store/atoms";
import { renderMap } from "./results";
import { SourceIssue } from "./sourceFeedback";
import { useNavigate } from "@/core/router";
import BatchEditAction from "@/components/musicList/batchEditAction";
import useInlineMusicSelection from "@/components/musicList/useInlineMusicSelection";
import InlineSelectionBar from "@/components/musicList/inlineSelectionBar";

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
    const { tab, pluginHash, searchResult, pluginSearchResultRef } = props;
    const search = useSearch();
    const navigate = useNavigate();
    const issue = searchResult?.state === RequestStateCode.ERROR ? <SourceIssue standalone pluginHash={pluginHash} type={tab} result={searchResult}
        search={search} onManage={() => navigate("setting", { type: "plugin" })} /> : null;
    const searchState = searchResult?.state ?? RequestStateCode.IDLE;
    const columns = useMediaGrid();
    const query = useAtomValue(queryAtom);

    const ResultComponent = renderMap[tab]!;
    const data: any = searchResult?.data ?? [];
    const editor = useInlineMusicSelection(`${tab}:${pluginHash}:${searchResult?.query ?? query}`, data);

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
            selection={tab === "music" ? editor.selection : undefined}
        />
    );

    return searchState === RequestStateCode.PENDING_FIRST_PAGE ? (
        <Loading />
    ) : (
        <FlashList
            ListHeaderComponent={tab === "music" ? editor.editing ? <InlineSelectionBar editor={editor} count={data.length} paginated />
                : data.length ? <BatchEditAction onPress={editor.start} /> : null : null}
            key={tab === "sheet" ? columns : 1}
            contentContainerStyle={tab === "sheet" ? { paddingHorizontal: spacing.xxxl - spacing.xs, paddingBottom: spacing.xxxl } : { paddingBottom: spacing.xxxl }}
            extraData={editor.selection ?? searchState}
            ListEmptyComponent={issue ?? <ListEmpty state={searchState} onRetry={() => {
                search(undefined, undefined, tab, pluginHash, "retry");
            }} />}
            ListFooterComponent={data?.length ? issue ?? <ListFooter state={searchState} onRetry={() => {
                search(undefined, undefined, tab, pluginHash, "retry");
            }} /> : null}
            data={data}
            refreshing={false}
            onRefresh={() => {
                editor.finish();
                search(undefined, 1, tab, pluginHash, "refresh");
            }}
            onEndReached={() => {
                (searchState === RequestStateCode.PARTLY_DONE ||
                    searchState === RequestStateCode.IDLE) &&
                    search(undefined, undefined, tab, pluginHash, "next");
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
