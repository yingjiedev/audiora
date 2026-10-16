import React, { memo, useCallback } from "react";
import { FlashList } from "@shopify/flash-list";
import useRecommendSheets from "../../hooks/useRecommendSheets";
import SheetItem from "@/components/mediaItem/sheetItem";
import useMediaGrid from "@/hooks/useMediaGrid";
import { spacing } from "@/constants/designSystem";
import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";

interface ISheetListProps {
    tag: ICommon.IUnique;
    pluginHash: string;
}

function SheetList(props: ISheetListProps) {
    const { tag, pluginHash } = props ?? {};

    const [query, sheets, status] = useRecommendSheets(pluginHash, tag);

    function renderItem({ item }: { item: IMusic.IMusicSheetItemBase }) {
        return <SheetItem sheetInfo={item} pluginHash={pluginHash} />;
    }
    const columns = useMediaGrid();

    const keyExtractor = useCallback(
        (item: any, i: number) => `${i}-${item.platform}-${item.id}`,
        [],
    );

    return (
        <FlashList
            key={columns}
            contentContainerStyle={{ paddingHorizontal: spacing.xxxl - spacing.xs, paddingBottom: spacing.xxxl }}
            ListEmptyComponent={<ListEmpty state={status} onRetry={query} />}
            ListFooterComponent={
                sheets.length ? <ListFooter
                    state={status}
                    onRetry={query}
                /> : null
            }
            onEndReached={() => {
                query();
            }}
            onEndReachedThreshold={0.1}
            numColumns={columns}
            renderItem={renderItem}
            data={sheets}
            keyExtractor={keyExtractor}
        />
    );
}

export default memo(
    SheetList,
    (prev, curr) =>
        prev.tag.id === curr.tag.id && prev.pluginHash === curr.pluginHash,
);
