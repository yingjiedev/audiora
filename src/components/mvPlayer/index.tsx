import React from "react";
import MvPlayer from "@/components/panels/types/mvPlayer";
import { mvPlayerStore } from "./useMvPlayer";

/** Root-level host kept separate from the generic bottom-sheet registry. */
export default function MvPlayerHost() {
    const payload = mvPlayerStore.useValue();
    if (!payload) {
        return null;
    }

    return (
        <MvPlayer
            musicItem={payload.musicItem}
            initialSource={payload.initialSource}
            onClosed={() => mvPlayerStore.setValue(null)}
        />
    );
}
