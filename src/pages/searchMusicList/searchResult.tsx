
import React from "react";
import { spacing } from "@/constants/designSystem";
import MusicItem from "@/components/mediaItem/musicItem";
import { PageState } from "@/components/base/pageSection";
import { useI18N } from "@/core/i18n";
import { FlashList } from "@shopify/flash-list";

interface ISearchResultProps {
    result: IMusic.IMusicItem[];
    musicSheet?: IMusic.IMusicSheetItem;
}


export default function SearchResult(props: ISearchResultProps) {
    const { result, musicSheet } = props;
    const { t } = useI18N();
    return (
        <FlashList
            ListEmptyComponent={<PageState icon="magnifying-glass" title={t("subpage.searchEmpty")} description={t("subpage.searchHint")} />}
            data={result}
            renderItem={({ item }) => (
                <MusicItem itemPaddingLeft={spacing.xxxl} itemPaddingRight={spacing.xxxl} musicItem={item} musicSheet={musicSheet} />
            )}
        />
    );
}
