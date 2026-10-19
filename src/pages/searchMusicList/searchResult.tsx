
import React from "react";
import { spacing } from "@/constants/designSystem";
import MusicItem from "@/components/mediaItem/musicItem";
import { PageState } from "@/components/base/pageSection";
import { useI18N } from "@/core/i18n";
import { FlashList } from "@shopify/flash-list";
import type { MusicListSelection } from "@/components/musicList/useMusicSelection";
import SelectionCheckbox from "@/components/musicList/selectionCheckbox";
import { getMediaUniqueKey } from "@/utils/mediaUtils";

interface ISearchResultProps {
    result: IMusic.IMusicItem[];
    musicSheet?: IMusic.IMusicSheetItem;
    selection?: MusicListSelection;
}


export default function SearchResult(props: ISearchResultProps) {
    const { result, musicSheet, selection } = props;
    const { t } = useI18N();
    return (
        <FlashList
            ListEmptyComponent={<PageState icon="magnifying-glass" title={t("subpage.searchEmpty")} description={t("subpage.searchHint")} />}
            data={result}
            extraData={selection}
            renderItem={({ item }) => (
                <MusicItem itemPaddingLeft={spacing.xxxl} itemPaddingRight={spacing.xxxl} musicItem={item} musicSheet={musicSheet}
                    checked={selection?.selectedKeys.has(getMediaUniqueKey(item))}
                    left={selection ? <SelectionCheckbox checked={selection.selectedKeys.has(getMediaUniqueKey(item))} /> : undefined}
                    actions={selection ? [] : undefined} onItemPress={selection ? () => selection.onToggle(item) : undefined} />
            )}
        />
    );
}
