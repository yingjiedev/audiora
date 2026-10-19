import { spacing } from "@/constants/designSystem";
import React from "react";
import MusicItem from "@/components/mediaItem/musicItem";
import timeformat from "@/utils/timeformat";
import type { MusicListSelection } from "@/components/musicList/useMusicSelection";
import SelectionCheckbox from "@/components/musicList/selectionCheckbox";
import { getMediaUniqueKey } from "@/utils/mediaUtils";

export default function MusicContentItem({ item, selection }: { item: IMusic.IMusicItem; selection?: MusicListSelection }) {
    const checked = selection?.selectedKeys.has(getMediaUniqueKey(item));
    return (
        <MusicItem
            itemPaddingLeft={spacing.xxxl}
            itemPaddingRight={spacing.xxxl}
            musicItem={item}
            checked={checked}
            left={checked !== undefined ? <SelectionCheckbox checked={checked} /> : undefined}
            actions={selection ? [] : undefined}
            onItemPress={selection ? () => selection.onToggle(item) : undefined}
            titleTagSubText={typeof item.duration === "number" ? timeformat(item.duration) : undefined}
        />
    );
}
