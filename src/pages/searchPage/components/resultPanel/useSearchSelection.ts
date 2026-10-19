import { useEffect, useMemo } from "react";
import useInlineMusicSelection from "@/components/musicList/useInlineMusicSelection";
import type { MusicSelectionController } from "@/components/musicList/useMusicSelection";

export interface SearchSelectionEntry {
    editor: MusicSelectionController;
    count: number;
}

export type SearchSelectionListener = (entry?: SearchSelectionEntry) => void;

/** Lists keep their own state and publish controls to the shared source toolbar. */
export default function useSearchSelection(scope: string, musicList: IMusic.IMusicItem[], onChange?: SearchSelectionListener) {
    const editor = useInlineMusicSelection(scope, musicList);
    const entry = useMemo(() => ({ editor, count: musicList.length }), [editor, musicList.length]);
    useEffect(() => {
        if (!onChange) return;
        onChange(entry);
        return () => onChange(undefined);
    }, [entry, onChange]);
    return editor;
}
