import { useCallback, useEffect, useMemo, useState } from "react";
import { getMediaUniqueKey } from "@/utils/mediaUtils";

export interface MusicListSelection {
    selectedKeys: ReadonlySet<string>;
    onToggle: (musicItem: IMusic.IMusicItem) => void;
    onToggleGroup?: (musicItems: IMusic.IMusicItem[]) => void;
}

export default function useMusicSelection(scope: string, musicList: IMusic.IMusicItem[]) {
    const [editing, setEditing] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set());
    const clear = useCallback((items?: IMusic.IMusicItem[]) => {
        const completed = items ? new Set(items.map(getMediaUniqueKey)) : undefined;
        setSelectedKeys(previous => {
            if (!previous.size) return previous;
            const next = completed ? new Set([...previous].filter(key => !completed.has(key))) : new Set<string>();
            return next.size === previous.size ? previous : next;
        });
    }, []);
    const finish = useCallback(() => {
        setEditing(false);
        clear();
    }, [clear]);
    const start = useCallback(() => {
        clear();
        setEditing(true);
    }, [clear]);

    useEffect(() => finish(), [scope, finish]);
    useEffect(() => {
        setSelectedKeys(previous => {
            if (!previous.size) return previous;
            const available = new Set(musicList.map(getMediaUniqueKey));
            const next = new Set([...previous].filter(key => available.has(key)));
            return next.size === previous.size ? previous : next;
        });
    }, [musicList]);

    const onToggle = useCallback((musicItem: IMusic.IMusicItem) => {
        const key = getMediaUniqueKey(musicItem);
        setSelectedKeys(previous => {
            const next = new Set(previous);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);
    const selectedItems = useMemo(() => selectedKeys.size ? musicList.filter(item => selectedKeys.has(getMediaUniqueKey(item))) : [], [musicList, selectedKeys]);
    const onToggleGroup = useCallback((items: IMusic.IMusicItem[]) => {
        const keys = items.map(getMediaUniqueKey);
        setSelectedKeys(previous => {
            const next = new Set(previous);
            const remove = keys.every(key => previous.has(key));
            keys.forEach(key => remove ? next.delete(key) : next.add(key));
            return next;
        });
    }, []);
    const allSelected = musicList.length > 0 && selectedItems.length === musicList.length;
    const toggleAll = useCallback(() => {
        setSelectedKeys(allSelected ? new Set() : new Set(musicList.map(getMediaUniqueKey)));
    }, [allSelected, musicList]);
    const selection = useMemo<MusicListSelection | undefined>(() => editing ? { selectedKeys, onToggle, onToggleGroup } : undefined, [editing, selectedKeys, onToggle, onToggleGroup]);

    return useMemo(() => ({ editing, selection, selectedItems, allSelected, start, finish, clear, toggleAll }), [editing, selection, selectedItems, allSelected, start, finish, clear, toggleAll]);
}

export type MusicSelectionController = ReturnType<typeof useMusicSelection>;
