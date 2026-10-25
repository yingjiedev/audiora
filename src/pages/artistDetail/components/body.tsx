import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import useContentDimensions from "@/hooks/useContentDimensions";
import { SceneMap, TabView } from "react-native-tab-view";
import ResultList from "./resultList";
import { useAtomValue } from "jotai";
import { queryResultAtom } from "../store/atoms";
import content from "./content";
import { useI18N } from "@/core/i18n";
import PillTabBar from "@/components/base/pillTabBar";
import { useActiveMusicSelection } from "@/components/musicList/selectionContext";
import InlineSelectionBar from "@/components/musicList/inlineSelectionBar";
import { spacing } from "@/constants/designSystem";

const sceneMap: Record<string, React.FC> = {
    album: BodyContentWrapper,
    music: BodyContentWrapper,
};

const routes = [
    {
        key: "music",
        i18nKey: "common.singleMusic",
        title: "单曲",
    },
    {
        key: "album",
        i18nKey: "common.album",
        title: "专辑",
    },
];

export default function Body() {
    const { width } = useContentDimensions();
    const [index, setIndex] = useState(0);
    const { t } = useI18N();
    const editor = useActiveMusicSelection();
    const editing = !!editor;
    useEffect(() => {
        if (editing) setIndex(0);
    }, [editing]);
    const changeTab = (next: number) => {
        if (next === index) return;
        editor?.finish(); setIndex(next);
    };

    return (
        <TabView
            lazy
            style={style.wrapper}
            navigationState={{
                index,
                routes,
            }}
            renderTabBar={() => (
                <PillTabBar
                    routes={routes}
                    index={index}
                    onIndexChange={changeTab}
                    variant="underline"
                    getTitle={route =>
                        t((route as (typeof routes)[number]).i18nKey as any) ??
                        route.title ??
                        route.key
                    }
                />
            )}
            renderScene={SceneMap(sceneMap)}
            onIndexChange={changeTab}
            swipeEnabled={!editing}
            initialLayout={{ width }}
        />
    );
}

export function BodyContentWrapper(props: any) {
    const tab: IArtist.ArtistMediaType = props.route.key;
    const queryResult = useAtomValue(queryResultAtom);
    const editor = useActiveMusicSelection();
    const selection = tab === "music" ? editor?.selection : undefined;

    const Component = content[tab];
    const renderItem = ({ item, index }: any) => (
        <Component item={item} index={index} selection={selection} />
    );

    return (
        <ResultList tab={tab} data={queryResult[tab]} renderItem={renderItem} extraData={selection}
            Header={tab === "music" && editor ? <InlineSelectionBar style={style.selectionControls} editor={editor} count={queryResult.music.data?.length ?? 0} paginated /> : undefined} />
    );
}

const style = StyleSheet.create({
    selectionControls: { paddingHorizontal: spacing.xxxl },
    wrapper: {
        zIndex: 100,
    },
});
