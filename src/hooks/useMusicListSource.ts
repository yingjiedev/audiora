import { MusicListSnapshot, MusicListSource, registerMusicListSource, releaseMusicListSource } from "@/core/musicListSource";
import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";

/** Bind existing page loaders without putting callbacks in navigation params. */
export default function useMusicListSource(
    snapshot: MusicListSnapshot,
    loadMore: (retry?: boolean) => Promise<MusicListSnapshot | void>,
) {
    const navigation = useNavigation();
    const [source] = useState(() => new MusicListSource(snapshot, loadMore, editing => {
        navigation.setOptions({ freezeOnBlur: !editing });
    }));
    const sourceId = source.id;
    const { musicList, state } = snapshot;
    source.setLoader(loadMore);

    useEffect(() => {
        registerMusicListSource(source);
        return () => releaseMusicListSource(sourceId);
    }, [source, sourceId]);

    useEffect(() => {
        source.update({ musicList, state });
    }, [source, musicList, state]);

    return { source, sourceId };
}
