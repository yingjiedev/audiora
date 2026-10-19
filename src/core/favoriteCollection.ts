import { FavoriteGroups } from "./favoriteGroups";
import { FavoriteGroupsState, favoriteDisplayGroups, linkFavoriteGroups, mergeRestoredFavoriteGroups, reconcileFavoriteGroups, splitFavoriteGroup } from "./favoriteGroupsModel";
import { trackSourceKey } from "@/utils/trackGroup";
import { nanoid } from "@/utils/nanoid";

interface FavoriteSongs {
    get(): IMusic.IMusicItem[];
    add(items: IMusic.IMusicItem[]): Promise<void>;
    remove(items: IMusic.IMusicItem[]): Promise<void>;
}

/** One queue owns every favorite write, including legacy batch editing/restores. */
export class FavoriteCollection {
    private tail: Promise<unknown> = Promise.resolve();
    private indexedItems?: IMusic.IMusicItem[];
    private keys = new Set<string>();

    constructor(private songs: FavoriteSongs, private groups = FavoriteGroups, private newId = nanoid) {}

    private enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const task = this.tail.then(operation);
        this.tail = task.catch(() => undefined);
        return task;
    }

    private async write<T>(operation: () => Promise<T>, next = this.groups.get()) {
        this.groups.prepare(next);
        try {
            return await operation();
        } finally {
            this.groups.commit(this.songs.get());
        }
    }

    mutate<T>(operation: () => Promise<T>): Promise<T> {
        return this.enqueue(() => this.write(operation));
    }

    isFavorite(item: ICommon.IMediaBase | null) {
        const items = this.songs.get();
        if (items !== this.indexedItems) {
            this.indexedItems = items;
            this.keys = new Set(items.map(trackSourceKey));
        }
        return !!item && this.keys.has(trackSourceKey(item));
    }

    groupFor(item: ICommon.IMediaBase) {
        const key = trackSourceKey(item);
        return this.groups.get().groups.find(group => group.memberKeys.includes(key));
    }

    linkedSources(item: ICommon.IMediaBase) {
        const group = this.groupFor(item);
        if (!group) return [];
        const byKey = new Map(this.songs.get().map(song => [trackSourceKey(song), song]));
        return [group.preferredKey, ...group.memberKeys.filter(key => key !== group.preferredKey)]
            .map(key => byKey.get(key)).filter((song): song is IMusic.IMusicItem => !!song);
    }

    displayGroups() {
        return favoriteDisplayGroups(this.songs.get(), this.groups.get());
    }

    linkPreview(items: IMusic.IMusicItem[]) {
        const keys = new Set(items.map(trackSourceKey));
        const byKey = new Map([...this.songs.get(), ...items].map(item => [trackSourceKey(item), item]));
        for (const group of this.groups.get().groups) {
            if (group.memberKeys.some(key => keys.has(key))) for (const key of group.memberKeys) keys.add(key);
        }
        return [...keys].map(key => byKey.get(key)).filter((item): item is IMusic.IMusicItem => !!item);
    }

    link(items: IMusic.IMusicItem[], preferred: ICommon.IMediaBase) {
        return this.enqueue(() => {
            const preview = this.linkPreview(items);
            const state = linkFavoriteGroups(this.groups.get(), preview.map(trackSourceKey), trackSourceKey(preferred), this.newId());
            return this.write(() => this.songs.add(preview), state);
        });
    }

    toggle(item: IMusic.IMusicItem) {
        return this.enqueue(() => {
            const keys = new Set(this.groupFor(item)?.memberKeys ?? [trackSourceKey(item)]);
            const remove = this.isFavorite(item);
            return this.write(async () => {
                if (remove) await this.songs.remove(this.songs.get().filter(song => keys.has(trackSourceKey(song))));
                else await this.songs.add([item]);
                return !remove;
            });
        });
    }

    split(id: string) {
        return this.enqueue(() => this.write(async () => {}, splitFavoriteGroup(this.groups.get(), id)));
    }

    prefer(item: ICommon.IMediaBase) {
        return this.enqueue(() => {
            const group = this.groupFor(item);
            if (!group) return Promise.resolve();
            const next = { ...this.groups.get(), groups: this.groups.get().groups.map(value => value.id === group.id ? { ...value, preferredKey: trackSourceKey(item) } : value) };
            return this.write(async () => {}, next);
        });
    }

    restore(state: FavoriteGroupsState) {
        return this.enqueue(() => this.write(async () => {}, mergeRestoredFavoriteGroups(
            this.groups.get(), reconcileFavoriteGroups(state, this.songs.get()), this.newId,
        )));
    }
}
