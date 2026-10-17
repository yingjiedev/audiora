import Empty from "@/components/base/empty";
import PillTabBar from "@/components/base/pillTabBar";
import { usePluginDisplayNameResolver, useSearchablePlugins } from "@/core/pluginManager";
import { useI18N } from "@/core/i18n";
import AggregateResults from "./aggregateResults";
import { vw } from "@/utils/rpx";
import { atom, useAtomValue } from "jotai";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { SceneMap, TabView } from "react-native-tab-view";
import { searchResultsAtom } from "../../store/atoms";
import { renderMap } from "./results";
import DefaultResults from "./results/defaultResults";
import ResultWrapper from "./resultWrapper";
import { useParams } from "@/core/router";
import { scopeSearchPlugins } from "../../common/searchScope";
import { spacing } from "@/constants/designSystem";
import { StyleSheet, View } from "react-native";
import ThemeText from "@/components/base/themeText";

interface IResultSubPanelProps {
    tab: ICommon.SupportMediaType;
}

const aggregateKey = "aggregate-all";

// 展示结果的视图
function getResultComponent(
    tab: ICommon.SupportMediaType,
    pluginHash: string,
    pluginName: string,
) {
    const sourceResultAtom = atom(get => get(searchResultsAtom)[tab][pluginHash]);
    return tab in renderMap
        ? memo(
            () => {
                const pluginSearchResult = useAtomValue(sourceResultAtom);
                const pluginSearchResultRef = useRef(pluginSearchResult);

                useEffect(() => {
                    pluginSearchResultRef.current = pluginSearchResult;
                }, [pluginSearchResult]);

                return (
                    <ResultWrapper
                        tab={tab}
                        searchResult={pluginSearchResult}
                        pluginHash={pluginHash}
                        pluginName={pluginName}
                        pluginSearchResultRef={pluginSearchResultRef}
                    />
                );
            },
            () => true,
        )
        : () => <DefaultResults />;
}

/** 结果 scene */
function getSubRouterScene(
    tab: ICommon.SupportMediaType,
    routes: Array<{ key: string; title: string }>,
) {
    const scene: Record<string, React.FC> = {};
    routes.forEach(r => {
        scene[r.key] = r.key === aggregateKey ? AggregateResults : getResultComponent(tab, r.key, r.title);
    });
    return SceneMap(scene);
}

function ResultSubPanel(props: IResultSubPanelProps) {
    const params = useParams<"search-page">();
    const [index, setIndex] = useState(0);
    const getDisplayName = usePluginDisplayNameResolver();
    const { t } = useI18N();
    // Do not over-memoize: plugins can load/enable after mount.
    const routes = scopeSearchPlugins(useSearchablePlugins(props.tab), params?.pluginHash).map(
        _ => ({
            key: _.hash,
            title: getDisplayName(_),
        }),
    );
    if (props.tab === "music" && !params?.pluginHash && routes.length) {
        routes.unshift({ key: aggregateKey, title: t("aggregate.allSources") });
    }
    // 标题参与 memo key：插件改名后场景随之重建，避免残留旧名字
    const routeKey = routes.map(r => `${r.key}:${r.title}`).join("|");
    const renderScene = useMemo(
        () => getSubRouterScene(props.tab, routes),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when plugin set changes
        [props.tab, routeKey],
    );

    const safeIndex = routes.length
        ? Math.min(index, routes.length - 1)
        : 0;

    if (!routes.length) {
        return <Empty />;
    }

    return (
        <TabView
            lazy
            navigationState={{
                index: safeIndex,
                routes,
            }}
            renderTabBar={() => (
                <View style={styles.sourceRow}>
                    <ThemeText fontSize="description" fontColor="textSecondary" style={styles.sourceLabel}>{t("searchPage.sourceTitle")}</ThemeText>
                    <PillTabBar
                        routes={routes}
                        index={safeIndex}
                        onIndexChange={setIndex}
                        variant="compact"
                        style={styles.sourceTabs}
                        getAccessibilityLabel={route => t("searchPage.sourceLabel", { source: route.title ?? route.key })}
                    />
                </View>
            )}
            renderScene={renderScene}
            onIndexChange={setIndex}
            initialLayout={{ width: vw(100) }}
        />
    );
}

const styles = StyleSheet.create({
    sourceRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xxs, gap: spacing.md },
    sourceLabel: { flexShrink: 0 },
    sourceTabs: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
});

// 不然会一直重新渲染
export default memo(ResultSubPanel);
