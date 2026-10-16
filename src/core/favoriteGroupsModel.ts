import { groupTracks, TrackGroup, trackSourceKey } from "@/utils/trackGroup";

export interface FavoriteGroup {
    id: string;
    memberKeys: string[];
    preferredKey: string;
}

export interface FavoriteGroupsState {
    version: 1;
    groups: FavoriteGroup[];
    separatedKeys: string[];
}

export const emptyFavoriteGroups = (): FavoriteGroupsState => ({ version: 1, groups: [], separatedKeys: [] });
const MAX_GROUPS = 10_000;
export const MAX_GROUP_SOURCES = 32;

function validKey(value: unknown): value is string {
    if (typeof value !== "string" || value.length > 4096) return false;
    try {
        const pair = JSON.parse(value);
        return Array.isArray(pair) && pair.length === 2 && pair.every(part => typeof part === "string" && part.length > 0 && part.length <= 1024)
            && JSON.stringify(pair) === value;
    } catch {
        return false;
    }
}

/** Strict backup validation; never interpret plugin hashes or URLs as identities. */
export function parseFavoriteGroups(value: unknown, available?: Set<string>): FavoriteGroupsState {
    const state = value as FavoriteGroupsState;
    if (!state || state.version !== 1 || !Array.isArray(state.groups) || state.groups.length > MAX_GROUPS
        || !Array.isArray(state.separatedKeys) || state.separatedKeys.length > 200_000) {
        throw new Error("Invalid favorite groups");
    }
    const ids = new Set<string>();
    const members = new Set<string>();
    const groups = state.groups.map(group => {
        if (!group || typeof group.id !== "string" || !group.id.length || group.id.length > 128 || ids.has(group.id)
            || !Array.isArray(group.memberKeys) || group.memberKeys.length < 2 || group.memberKeys.length > MAX_GROUP_SOURCES) {
            throw new Error("Invalid favorite group identity");
        }
        ids.add(group.id);
        for (const key of group.memberKeys) {
            if (!validKey(key) || members.has(key) || (available && !available.has(key))) throw new Error("Invalid favorite group member");
            members.add(key);
        }
        if (!group.memberKeys.includes(group.preferredKey)) throw new Error("Invalid preferred favorite source");
        return { id: group.id, memberKeys: [...group.memberKeys], preferredKey: group.preferredKey };
    });
    const separated = new Set<string>();
    for (const key of state.separatedKeys) {
        if (!validKey(key) || separated.has(key) || members.has(key) || (available && !available.has(key))) {
            throw new Error("Invalid separated favorite source");
        }
        separated.add(key);
    }
    return { version: 1, groups, separatedKeys: [...separated] };
}

/** Missing sources are pruned, never recreated from a relationship or journal. */
export function reconcileFavoriteGroups(state: FavoriteGroupsState, items: IMusic.IMusicItem[]): FavoriteGroupsState {
    const keys = new Set(items.map(trackSourceKey));
    const groups = state.groups.flatMap(group => {
        const memberKeys = group.memberKeys.filter(key => keys.has(key));
        return memberKeys.length < 2 ? [] : [{ ...group, memberKeys, preferredKey: memberKeys.includes(group.preferredKey) ? group.preferredKey : memberKeys[0] }];
    });
    return { version: 1, groups, separatedKeys: state.separatedKeys.filter(key => keys.has(key)) };
}

export function linkFavoriteGroups(state: FavoriteGroupsState, keys: string[], preferredKey: string, id: string): FavoriteGroupsState {
    const members = new Set(keys);
    const affected = state.groups.filter(group => group.memberKeys.some(key => members.has(key)));
    for (const group of affected) for (const key of group.memberKeys) members.add(key);
    if (members.size < 2 || members.size > MAX_GROUP_SOURCES || !members.has(preferredKey)) throw new Error("Invalid favorite source selection");
    return parseFavoriteGroups({
        version: 1,
        groups: [...state.groups.filter(group => !affected.includes(group)), { id: affected[0]?.id ?? id, memberKeys: [...members], preferredKey }],
        separatedKeys: state.separatedKeys.filter(key => !members.has(key)),
    });
}

export function splitFavoriteGroup(state: FavoriteGroupsState, id: string): FavoriteGroupsState {
    const group = state.groups.find(item => item.id === id);
    return {
        version: 1,
        groups: state.groups.filter(item => item.id !== id),
        separatedKeys: [...new Set([...state.separatedKeys, ...(group?.memberKeys ?? [])])],
    };
}

/** Local explicit decisions win conflicts; UUID collisions never merge unrelated songs. */
export function mergeRestoredFavoriteGroups(local: FavoriteGroupsState, incoming: FavoriteGroupsState, newId: () => string): FavoriteGroupsState {
    const groups = local.groups.map(group => ({ ...group, memberKeys: [...group.memberKeys] }));
    const occupied = new Set(groups.flatMap(group => group.memberKeys));
    const ids = new Set(groups.map(group => group.id));
    const separated = new Set(local.separatedKeys);
    for (const group of incoming.groups) {
        if (group.memberKeys.some(key => occupied.has(key) || separated.has(key))) continue;
        const id = ids.has(group.id) ? newId() : group.id;
        groups.push({ ...group, id }); ids.add(id);
        for (const key of group.memberKeys) occupied.add(key);
    }
    for (const key of incoming.separatedKeys) if (!occupied.has(key)) separated.add(key);
    return parseFavoriteGroups({ version: 1, groups, separatedKeys: [...separated] });
}

export function favoriteDisplayGroups(items: IMusic.IMusicItem[], state: FavoriteGroupsState): TrackGroup[] {
    const byKey = new Map(items.map(item => [trackSourceKey(item), item]));
    const assigned = new Map<string, TrackGroup>();
    for (const group of state.groups) {
        const candidates = group.memberKeys.map(key => byKey.get(key)).filter((item): item is IMusic.IMusicItem => !!item);
        if (candidates.length < 2) continue;
        const display = { key: `favorite:${group.id}`, candidates, groupId: group.id, preferredKey: group.preferredKey };
        for (const candidate of candidates) assigned.set(trackSourceKey(candidate), display);
    }
    const separated = new Set(state.separatedKeys);
    const suggestions = groupTracks(items.filter(item => !assigned.has(trackSourceKey(item)) && !separated.has(trackSourceKey(item))));
    for (const group of suggestions) for (const item of group.candidates) assigned.set(trackSourceKey(item), group);
    const result: TrackGroup[] = [];
    const seen = new Set<string>();
    for (const item of items) {
        const identity = trackSourceKey(item);
        const group = assigned.get(identity) ?? { key: identity, candidates: [item] };
        if (!seen.has(group.key)) {
            result.push(group); seen.add(group.key);
        }
    }
    return result;
}
