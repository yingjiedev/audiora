export type MusicSelectionAction = "addNext" | "addToSheet" | "download" | "remove";

/** Omitted switches use the defaults; false hides an action entirely. */
export type MusicSelectionActions = Partial<Record<MusicSelectionAction, boolean>>;

export interface MusicListEditorOptions {
    musicList: IMusic.IMusicItem[] | null;
    musicSheet?: Partial<IMusic.IMusicSheetItem>;
    sourceId?: string;
    selectionOnly?: boolean;
    actions?: MusicSelectionActions;
}

/** A paginated or filtered snapshot must never overwrite a complete local sheet. */
export function canEditMusicList({ musicSheet, sourceId, selectionOnly }: MusicListEditorOptions) {
    return !!musicSheet?.id && !sourceId && !selectionOnly;
}
