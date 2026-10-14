import { spacing } from "@/constants/designSystem";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import Loading from "@/components/base/loading";
import Chip from "@/components/base/chip";
import useSearch from "../hooks/useSearch";
import { addHistory, getHistory, removeAllHistory, removeHistory } from "../common/historySearch";
import { useSetAtom } from "jotai";
import { PageStatus, initSearchResults, pageStatusAtom, queryAtom, searchResultsAtom } from "../store/atoms";
import ThemeText from "@/components/base/themeText";
import Button from "@/components/base/textButton.tsx";
import Empty from "@/components/base/empty";
import { useI18N } from "@/core/i18n";

export default function () {
    const [history, setHistory] = useState<string[] | null>(null);
    const search = useSearch();

    const setQuery = useSetAtom(queryAtom);
    const setPageStatus = useSetAtom(pageStatusAtom);
    const setSearchResultsState = useSetAtom(searchResultsAtom);
    const { t } = useI18N();

    useEffect(() => {
        getHistory().then(setHistory);
    }, []);

    return (
        <View style={style.wrapper}>
            {history === null ? (
                <Loading />
            ) : (
                <>
                    <View style={style.header}>
                        <ThemeText fontSize="title" fontWeight="semibold">
                            {t("searchPage.history")}
                        </ThemeText>
                        {history.length ? <Button
                            fontColor="textSecondary"
                            onPress={async () => {
                                await removeAllHistory();
                                getHistory().then(setHistory);
                            }}>
                            {t("common.clear")}
                        </Button> : null}
                    </View>
                    <ScrollView
                        style={style.historyContent}
                        contentContainerStyle={history.length ? style.historyContentContainer : style.emptyHistory}>
                        {history.length ? (
                            history.map(_ => (
                                <Chip
                                    key={`search-history-${_}`}
                                    containerStyle={style.chip}
                                    onClose={async () => {
                                        await removeHistory(_);
                                        getHistory().then(setHistory);
                                    }}
                                    onPress={() => {
                                        setSearchResultsState(
                                            initSearchResults,
                                        );
                                        setPageStatus(PageStatus.SEARCHING);
                                        search(_, 1);
                                        addHistory(_);
                                        setQuery(_);
                                    }}>
                                    {_}
                                </Chip>
                            ))
                        ) : (
                            <Empty />
                        )}
                    </ScrollView>
                </>
            )}
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        maxWidth: "100%",
        flexDirection: "column",
        padding: spacing.xxxl,
        flex: 1,
    },
    header: {
        width: "100%",
        flexDirection: "row",
        paddingVertical: spacing.sm,
        paddingBottom: rpx(16),
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 0,
    },
    historyContent: {
        width: "100%",
        flex: 1,
        paddingTop: rpx(24),
    },
    historyContentContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    emptyHistory: {
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    chip: {
        flexGrow: 0,
        marginRight: rpx(12),
        marginBottom: rpx(12),
    },
});
