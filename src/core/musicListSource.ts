import { RequestStateCode } from "@/constants/commonConst";
import { dedupeMediaItems } from "@/utils/mediaUtils";
import { atom, getDefaultStore, PrimitiveAtom } from "jotai";

export interface MusicListSnapshot {
    musicList: IMusic.IMusicItem[];
    state: RequestStateCode;
}

/** A screen owns the source; the editor shares its live data through a serializable ID. */
export class MusicListSource {
    readonly snapshotAtom: PrimitiveAtom<MusicListSnapshot>;
    readonly id = `music-source-${++nextSourceId}`;
    private pending = false;
    private active = true;
    private loader: (retry?: boolean) => Promise<MusicListSnapshot | void>;
    private editors = 0;
    private onEditingChange: (editing: boolean) => void;

    constructor(
        snapshot: MusicListSnapshot,
        loader: (retry?: boolean) => Promise<MusicListSnapshot | void>,
        onEditingChange: (editing: boolean) => void = () => {},
    ) {
        this.snapshotAtom = atom({ ...snapshot, musicList: dedupeMediaItems(snapshot.musicList) });
        this.loader = loader;
        this.onEditingChange = onEditingChange;
    }

    setLoader(loader: (retry?: boolean) => Promise<MusicListSnapshot | void>) {
        this.loader = loader;
    }

    update(snapshot: MusicListSnapshot) {
        if (this.active) {
            getDefaultStore().set(this.snapshotAtom, {
                ...snapshot,
                musicList: dedupeMediaItems(snapshot.musicList),
            });
        }
    }

    loadMore = async (retry = false) => {
        const store = getDefaultStore();
        const snapshot = store.get(this.snapshotAtom);
        if (!this.active || this.pending || !(
            snapshot.state === RequestStateCode.IDLE ||
            snapshot.state === RequestStateCode.PARTLY_DONE ||
            (retry && snapshot.state === RequestStateCode.ERROR)
        )) {
            return;
        }
        this.pending = true;
        this.update({
            ...snapshot,
            state: snapshot.musicList.length
                ? RequestStateCode.PENDING_REST_PAGE
                : RequestStateCode.PENDING_FIRST_PAGE,
        });
        try {
            const result = await this.loader(retry);
            if (result) this.update(result);
        } catch {
            this.update({ ...store.get(this.snapshotAtom), state: RequestStateCode.ERROR });
        } finally {
            this.pending = false;
        }
    };

    dispose() {
        this.active = false;
    }

    /** Keep the owning screen rendering while the editor consumes its page loader. */
    acquireEditor() {
        this.editors++;
        if (this.editors === 1) {
            this.onEditingChange(true);
        }
        let released = false;
        return () => {
            if (!released) {
                released = true;
                this.editors--;
                if (!this.editors) {
                    this.onEditingChange(false);
                }
            }
        };
    }

    activate() {
        this.active = true;
    }
}

const sources = new Map<string, MusicListSource>();
let nextSourceId = 0;

export function registerMusicListSource(source: MusicListSource) {
    source.activate();
    sources.set(source.id, source);
    return source.id;
}

export function getMusicListSource(id?: string) {
    return id ? sources.get(id) : undefined;
}

export function releaseMusicListSource(id: string) {
    sources.get(id)?.dispose();
    sources.delete(id);
}
