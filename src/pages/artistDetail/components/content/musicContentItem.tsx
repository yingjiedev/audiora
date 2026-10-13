import React from "react";
import MusicItem from "@/components/mediaItem/musicItem";
import timeformat from "@/utils/timeformat";

export default function MusicContentItem({ item }: { item: IMusic.IMusicItem }) {
    return (
        <MusicItem
            musicItem={item}
            titleTagSubText={typeof item.duration === "number" ? timeformat(item.duration) : undefined}
        />
    );
}
