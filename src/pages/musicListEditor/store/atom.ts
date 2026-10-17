import { atom } from "jotai";
import { dedupeMediaItems, getMediaUniqueKey } from "@/utils/mediaUtils";

export interface IEditorMusicItem {
    musicItem: IMusic.IMusicItem;
    checked?: boolean;
}

/** Append by media identity, preserving checks even when a page overlaps. */
export function mergeEditorMusicList(previous: IEditorMusicItem[], musicList: IMusic.IMusicItem[]) {
    const existing = new Set(previous.map(item => getMediaUniqueKey(item.musicItem)));
    return previous.concat(dedupeMediaItems(musicList)
        .filter(item => !existing.has(getMediaUniqueKey(item)))
        .map(musicItem => ({ musicItem, checked: false })));
}

/** 编辑页中的音乐条目 */
const editingMusicListAtom = atom<IEditorMusicItem[]>([]);

/** 是否变动过 */
const musicListChangedAtom = atom(false);

export { editingMusicListAtom, musicListChangedAtom };
