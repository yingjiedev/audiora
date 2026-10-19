import { atom, getDefaultStore, useAtomValue } from "jotai";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";
import { emptyFavoriteGroups, FavoriteGroupsState, parseFavoriteGroups, reconcileFavoriteGroups } from "./favoriteGroupsModel";

const stateAtom = atom<FavoriteGroupsState>(emptyFavoriteGroups());
const store = () => getOrCreateMMKV("FavoriteGroups");

function read(key: string): FavoriteGroupsState | undefined {
    const text = store().getString(key);
    if (!text) return undefined;
    try {
        return parseFavoriteGroups(JSON.parse(text));
    } catch {
        return undefined;
    }
}

export const FavoriteGroups = {
    get: () => getDefaultStore().get(stateAtom),
    prepare(state: FavoriteGroupsState) {
        store().set("pending", JSON.stringify(parseFavoriteGroups(state)));
    },
    commit(items: IMusic.IMusicItem[]) {
        const state = reconcileFavoriteGroups(read("pending") ?? this.get(), items);
        store().set("state", JSON.stringify(state));
        store().remove("pending");
        getDefaultStore().set(stateAtom, state);
    },
    setup(items: IMusic.IMusicItem[]) {
        getDefaultStore().set(stateAtom, read("pending") ?? read("state") ?? emptyFavoriteGroups());
        this.commit(items);
    },
};

export function useFavoriteGroups() {
    return useAtomValue(stateAtom);
}
