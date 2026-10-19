import { useCallback } from "react";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import type { MusicListEditorOptions } from "@/core/musicListEditor";

/** Opens the separate manual sorting screen. Batch actions use useInlineMusicSelection. */
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
