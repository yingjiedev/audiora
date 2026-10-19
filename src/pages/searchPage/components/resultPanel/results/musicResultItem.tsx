import { spacing } from "@/constants/designSystem";
import React from "react";
import MusicItem from "@/components/mediaItem/musicItem";
import Config from "@/core/appConfig";
import { ISearchResult } from "@/pages/searchPage/store/atoms";
import TrackPlayer from "@/core/trackPlayer";
import timeformat from "@/utils/timeformat";
import type { MusicListSelection } from "@/components/musicList/useMusicSelection";
import SelectionCheckbox from "@/components/musicList/selectionCheckbox";
import { getMediaUniqueKey } from "@/utils/mediaUtils";

interface IMusicResultsProps {
    item: IMusic.IMusicItem;
    index: number;
    query?: string;
    pluginSearchResultRef: React.MutableRefObject<ISearchResult<"music">>;
    selection?: MusicListSelection;
}

export default function MusicResultItem(props: IMusicResultsProps) {
    const { item: musicItem, pluginSearchResultRef, query, selection } = props;
    const checked = selection?.selectedKeys.has(getMediaUniqueKey(musicItem));
    return (
        <MusicItem
            itemPaddingLeft={spacing.xxxl}
            itemPaddingRight={spacing.xxxl}
            musicItem={musicItem}
            highlightText={query}
            checked={checked}
            left={checked !== undefined ? <SelectionCheckbox checked={checked} /> : undefined}
            actions={selection ? [] : ["favorite", "addNext", "more"]}
            titleTagSubText={typeof musicItem.duration === "number" ? timeformat(musicItem.duration) : undefined}
            onItemPress={() => {
                if (selection) {
                    selection.onToggle(musicItem);
                    return;
                }
                if (Config.getConfig("basic.clickMusicInSearch") === "playMusicAndReplace") {
                    TrackPlayer.playWithReplacePlayList(musicItem, (pluginSearchResultRef.current?.data ?? [musicItem]) as IMusic.IMusicItem[]);
                } else {
                    TrackPlayer.play(musicItem);
                }
            }}
        />
    );
}
