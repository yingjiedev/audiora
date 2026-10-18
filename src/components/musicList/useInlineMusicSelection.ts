import { useCallback, useContext, useEffect, useMemo } from "react";
import { Keyboard } from "react-native";
import useMusicSelection from "./useMusicSelection";
import { MusicSelectionDispatchContext } from "./selectionContext";
import type { MusicSelectionActions } from "@/core/musicListEditor";
import type { MusicSelectionRemoval } from "./selectionControls";

/** Adds selection to the mounted list and publishes its controls to the current screen. */
export default function useInlineMusicSelection(scope: string, musicList: IMusic.IMusicItem[], options: {
    actions?: MusicSelectionActions;
    removal?: MusicSelectionRemoval;
} = {}) {
    const controller = useMusicSelection(scope, musicList);
    const { start: startSelection } = controller;
    const setActive = useContext(MusicSelectionDispatchContext);
    const start = useCallback(() => {
        Keyboard.dismiss();
        startSelection();
    }, [startSelection]);
    const editor = useMemo(() => ({ ...controller, start }), [controller, start]);
    const session = useMemo(() => ({ scope, editor, actions: options.actions, removal: options.removal }), [scope, editor, options.actions, options.removal]);

    useEffect(() => {
        if (!editor.editing || !setActive) return;
        setActive(session);
        return () => setActive(previous => previous === session ? undefined : previous);
    }, [editor.editing, session, setActive]);

    return editor;
}
