/**
 * 搜索结果面板 一级页
 */
import React, { memo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { vw } from "@/utils/rpx";
import { SceneMap, TabView } from "react-native-tab-view";
import ResultSubPanel from "./resultSubPanel";
import results from "./results";
import PillTabBar from "@/components/base/pillTabBar";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";

const routes = results;

const getRouterScene = (
    routeList: Array<{ key: ICommon.SupportMediaType; title: string }>,
) => {
    const scene: Record<string, React.ComponentType<any>> = {};
    routeList.forEach(r => {
        scene[r.key] = () => <ResultSubPanel tab={r.key} />;
    });
    return SceneMap(scene);
};

const renderScene = getRouterScene(routes);

function ResultPanel() {
    const [index, setIndex] = useState(0);
    const { t } = useI18N();

    return (
        <View style={styles.container}>
            <PillTabBar routes={routes} index={index} variant="underline" onIndexChange={setIndex}
                contentContainerStyle={{ paddingHorizontal: spacing.xxl }} getTitle={route => {
                    const item = routes.find(value => value.key === route.key)!; return item.i18nKey ? t(item.i18nKey as any) : item.title;
                }} />
            <TabView
                lazy
                navigationState={{
                    index,
                    routes,
                }}
                renderTabBar={() => null}
                renderScene={renderScene}
                onIndexChange={setIndex}
                initialLayout={{ width: vw(100) }}
            />
        </View>
    );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
export default memo(ResultPanel);
