import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MusicSelectionController } from "./useMusicSelection";
import type { MusicSelectionActions } from "@/core/musicListEditor";
import type { MusicSelectionRemoval } from "./selectionControls";

export interface InlineMusicSelectionSession {
    scope: string;
    editor: MusicSelectionController;
    actions?: MusicSelectionActions;
    removal?: MusicSelectionRemoval;
}

export const MusicSelectionContext = createContext<InlineMusicSelectionSession | undefined>(undefined);
export const MusicSelectionDispatchContext = createContext<Dispatch<SetStateAction<InlineMusicSelectionSession | undefined>> | undefined>(undefined);

export function useActiveMusicSelection() {
    return useContext(MusicSelectionContext)?.editor;
}
