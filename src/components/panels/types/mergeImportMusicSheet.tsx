import ListItem from "@/components/base/listItem";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import { useI18N } from "@/core/i18n";
import PluginManager, { Plugin } from "@/core/pluginManager";
import useColors from "@/hooks/useColors";
import { normalizeImportedMusicSheet } from "@/utils/mediaUtils";
import rpx, { vmax } from "@/utils/rpx";
import { mergeMusicSheetsByPriority } from "@/utils/sheetMerge";
import Toast from "@/utils/toast";
import React, { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PanelBase from "../base/panelBase";
import PanelHeader from "../base/panelHeader";
import { showPanel } from "../usePanel";

interface ISourceRow {
    plugin: Plugin | null;
    url: string;
}

interface ILoadedSheet {
    pluginHash: string;
    pluginName: string;
    sheet: IMusic.IMusicSheetItem;
}

export default function MergeImportMusicSheet() {
    const validPlugins =
        PluginManager.getSortedPluginsWithAbility("importMusicSheet");
    const { t } = useI18N();
    const colors = useColors();
    const safeAreaInsets = useSafeAreaInsets();
    const [rows, setRows] = useState<ISourceRow[]>([
        { plugin: validPlugins[0] ?? null, url: "" },
        { plugin: null, url: "" },
    ]);
    const [merging, setMerging] = useState(false);

    const updateRow = (index: number, patch: Partial<ISourceRow>) => {
        setRows(previous =>
            previous.map((row, rowIndex) =>
                rowIndex === index ? { ...row, ...patch } : row,
            ),
        );
    };

    const moveRow = (index: number, offset: number) => {
        const target = index + offset;
        if (target < 0 || target >= rows.length) {
            return;
        }
        setRows(previous => {
            const next = [...previous];
            const [row] = next.splice(index, 1);
            next.splice(target, 0, row);
            return next;
        });
    };

    const startMerge = async () => {
        if (merging) {
            return;
        }

        const readyRows = rows.filter(row => row.plugin && row.url.trim());
        if (readyRows.length < 2) {
            Toast.warn(t("panel.mergeImportMusicSheet.needTwoSources"));
            return;
        }

        setMerging(true);
        try {
            const loadedSheets: ILoadedSheet[] = [];
            for (const row of readyRows) {
                const plugin = row.plugin!;
                const input = row.url.trim();
                const result = await plugin.methods.importMusicSheet(input);
                const sheet = normalizeImportedMusicSheet(
                    result,
                    plugin.name,
                    input,
                    t("panel.importMusicSheet.fallbackTitle", {
                        plugin: plugin.name,
                    }),
                );
                if (!sheet) {
                    throw new Error(
                        t("panel.mergeImportMusicSheet.sourceFailed", {
                            plugin: plugin.name,
                        }),
                    );
                }
                loadedSheets.push({
                    pluginHash: plugin.hash,
                    pluginName: plugin.name,
                    sheet,
                });
            }

            const { mergedList, stats } = mergeMusicSheetsByPriority(
                loadedSheets.map(source => ({
                    pluginHash: source.pluginHash,
                    pluginName: source.pluginName,
                    musicList: source.sheet.musicList ?? [],
                })),
            );
            const statsText = stats
                .map(stat =>
                    t("panel.mergeImportMusicSheet.sourceStatLine", {
                        plugin: stat.pluginName,
                        total: stat.total,
                        kept: stat.kept,
                        duplicates: stat.duplicates,
                        uncertain: stat.uncertain,
                    }),
                )
                .join("\n");

            showDialog("SimpleDialog", {
                title: t("panel.mergeImportMusicSheet.previewTitle"),
                content: (
                    <ThemeText>
                        {`${statsText}\n\n${t(
                            "panel.mergeImportMusicSheet.totalLine",
                            { count: mergedList.length },
                        )}`}
                    </ThemeText>
                ),
                async onOk() {
                    showPanel("AddToMusicSheet", {
                        musicItem: mergedList,
                        newSheetDefaultName:
                            loadedSheets[0]?.sheet.title ||
                            t("panel.mergeImportMusicSheet.defaultSheetName"),
                    });
                },
            });
        } catch (error: any) {
            Toast.warn(
                error?.message ??
                    t("panel.mergeImportMusicSheet.mergeFailed"),
            );
        } finally {
            setMerging(false);
        }
    };

    return (
        <PanelBase
            height={vmax(70)}
            renderBody={() => (
                <>
                    <PanelHeader
                        title={t("panel.mergeImportMusicSheet.title")}
                        okText={t(
                            merging
                                ? "panel.mergeImportMusicSheet.merging"
                                : "panel.mergeImportMusicSheet.merge",
                        )}
                        onOk={startMerge}
                        onCancel={() => showPanel("ImportMusicSheet")}
                    />
                    <ScrollView
                        style={{ marginBottom: safeAreaInsets.bottom }}
                        contentContainerStyle={styles.content}>
                        <ThemeText
                            fontColor="textSecondary"
                            fontSize="subTitle"
                            style={styles.hint}>
                            {t("panel.mergeImportMusicSheet.priorityHint")}
                        </ThemeText>
                        {rows.map((row, index) => (
                            <View key={`${index}`} style={styles.rowWrapper}>
                                <View style={styles.rowHeader}>
                                    <ThemeText
                                        fontWeight="bold"
                                        fontSize="subTitle">
                                        {`${index + 1}. ${
                                            row.plugin?.name ??
                                            t(
                                                "panel.mergeImportMusicSheet.selectPlugin",
                                            )
                                        }`}
                                    </ThemeText>
                                    <View style={styles.rowActions}>
                                        <TouchableOpacity
                                            style={styles.rowAction}
                                            accessibilityRole="button"
                                            accessibilityLabel={t(
                                                "panel.mergeImportMusicSheet.removeSource",
                                            )}
                                            onPress={() => {
                                                setRows(previous =>
                                                    previous.filter(
                                                        (_, rowIndex) =>
                                                            rowIndex !== index,
                                                    ),
                                                );
                                            }}>
                                            <ThemeText fontColor="primary">
                                                {t(
                                                    "panel.mergeImportMusicSheet.removeSource",
                                                )}
                                            </ThemeText>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.rowAction}
                                            accessibilityRole="button"
                                            disabled={index === 0}
                                            onPress={() => moveRow(index, -1)}>
                                            <ThemeText
                                                fontColor={
                                                    index === 0
                                                        ? "textSecondary"
                                                        : "primary"
                                                }>
                                                {t(
                                                    "panel.mergeImportMusicSheet.moveUp",
                                                )}
                                            </ThemeText>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.rowAction}
                                            accessibilityRole="button"
                                            disabled={index === rows.length - 1}
                                            onPress={() => moveRow(index, 1)}>
                                            <ThemeText
                                                fontColor={
                                                    index === rows.length - 1
                                                        ? "textSecondary"
                                                        : "primary"
                                                }>
                                                {t(
                                                    "panel.mergeImportMusicSheet.moveDown",
                                                )}
                                            </ThemeText>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.pluginScroll}>
                                    <View style={styles.pluginChips}>
                                        {validPlugins.map(plugin => {
                                            const isSelected =
                                                row.plugin?.hash === plugin.hash;
                                            return (
                                                <TouchableOpacity
                                                    key={plugin.hash}
                                                    accessibilityRole="button"
                                                    accessibilityState={{
                                                        selected: isSelected,
                                                    }}
                                                    style={[
                                                        styles.pluginChip,
                                                        {
                                                            backgroundColor:
                                                                isSelected
                                                                    ? colors.primary
                                                                    : colors.placeholder,
                                                        },
                                                    ]}
                                                    onPress={() =>
                                                        updateRow(index, {
                                                            plugin,
                                                        })
                                                    }>
                                                    <ThemeText
                                                        fontSize="subTitle"
                                                        numberOfLines={1}
                                                        style={{
                                                            color: isSelected
                                                                ? "#fff"
                                                                : colors.text,
                                                        }}>
                                                        {plugin.name}
                                                    </ThemeText>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                                <TextInput
                                    value={row.url}
                                    onChangeText={url =>
                                        updateRow(index, { url })
                                    }
                                    style={[
                                        styles.input,
                                        {
                                            color: colors.text,
                                            backgroundColor:
                                                colors.placeholder,
                                        },
                                    ]}
                                    placeholderTextColor={colors.textSecondary}
                                    placeholder={t(
                                        "panel.mergeImportMusicSheet.linkPlaceholder",
                                    )}
                                    maxLength={1000}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>
                        ))}
                        <ListItem
                            withHorizontalPadding
                            heightType="small"
                            onPress={() => {
                                setRows(previous => [
                                    ...previous,
                                    { plugin: null, url: "" },
                                ]);
                            }}>
                            <ListItem.Content
                                title={t(
                                    "panel.mergeImportMusicSheet.addSource",
                                )}
                            />
                        </ListItem>
                    </ScrollView>
                </>
            )}
        />
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: rpx(24),
    },
    hint: {
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(16),
    },
    rowWrapper: {
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(12),
    },
    rowHeader: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    rowActions: {
        alignItems: "center",
        flexDirection: "row",
        gap: rpx(12),
    },
    rowAction: {
        paddingVertical: rpx(8),
    },
    pluginScroll: {
        marginTop: rpx(8),
    },
    pluginChips: {
        flexDirection: "row",
        flexWrap: "nowrap",
        gap: rpx(12),
        paddingVertical: rpx(6),
    },
    pluginChip: {
        borderRadius: rpx(24),
        paddingHorizontal: rpx(20),
        paddingVertical: rpx(10),
    },
    input: {
        borderRadius: rpx(14),
        marginTop: rpx(10),
        paddingHorizontal: rpx(20),
        paddingVertical: rpx(14),
    },
});
