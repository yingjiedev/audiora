import { useCallback } from "react";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import type { MusicListEditorOptions } from "@/core/musicListEditor";

/** Every entry shares the same routing rules, including pages that edit inline. */
export default function useOpenMusicListEditor() {
    const navigate = useNavigate();
    return useCallback((options: MusicListEditorOptions, onEdit?: () => void) => {
        if (onEdit) {
            onEdit();
            return;
        }
        navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
            ...options,
            ...(options.sourceId ? { selectionOnly: true } : {}),
        });
    }, [navigate]);
}
