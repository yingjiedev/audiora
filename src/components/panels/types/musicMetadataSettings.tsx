import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import rpx, { vmax } from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";
import PanelBase from "../base/panelBase";
import { hidePanel } from "../usePanel";
import PanelHeader from "../base/panelHeader";
import Config, { useAppConfig } from "@/core/appConfig";
import ListItem from "@/components/base/listItem";
import ThemeSwitch from "@/components/base/switch";
import Checkbox from "@/components/base/checkbox";
import Divider from "@/components/base/divider";
import Icon from "@/components/base/icon";
import Toast from "@/utils/toast";
import { useI18N } from "@/core/i18n";
import type { ILanguageData } from "@/types/core/i18n";
import { showDialog } from "@/components/dialogs/useDialog";
import SettingSection from "@/pages/setting/components/settingSection";
import SettingRow from "@/pages/setting/components/settingRow";
import { settingsLayout } from "@/pages/setting/components/settingsLayout";

type LyricOrderItem = "original" | "translation" | "romanization";

/** 歌词类型的展示顺序固定，用户勾选后按 lyricOrder 里的先后写入文件 */
const lyricOrderItems: LyricOrderItem[] = [
    "original",
    "translation",
    "romanization",
];

const lyricTypeTitleKey: Record<LyricOrderItem, keyof ILanguageData> = {
    original: "panel.musicMetadata.lyricType.original",
    translation: "panel.musicMetadata.lyricType.translation",
    romanization: "panel.musicMetadata.lyricType.romanization",
};

const lyricTypeDescKey: Record<LyricOrderItem, keyof ILanguageData> = {
    original: "panel.musicMetadata.lyricType.originalDesc",
    translation: "panel.musicMetadata.lyricType.translationDesc",
    romanization: "panel.musicMetadata.lyricType.romanizationDesc",
};

const defaultSettings = {
    writeMetadata: false,
    writeMetadataCover: true,
    writeMetadataLyric: true,
    writeMetadataExtended: false,
    downloadLyricFile: false,
    lyricFileFormat: "lrc" as "lrc" | "txt",
    downloadCoverFile: false,
    coverFileNaming: "sameAsAudio" as "sameAsAudio" | "fixedName",
    lyricOrder: ["romanization", "original", "translation"] as LyricOrderItem[],
    enableWordByWord: false,
};

interface IMusicMetadataSettingsProps {
    // Reserved for future props
}

export default function MusicMetadataSettings(_props: IMusicMetadataSettingsProps) {
    const colors = useColors();
    const { t } = useI18N();

    const currentWriteMetadata = useAppConfig("basic.writeMetadata");
    const currentWriteMetadataCover = useAppConfig("basic.writeMetadataCover");
    const currentWriteMetadataLyric = useAppConfig("basic.writeMetadataLyric");
    const currentWriteMetadataExtended = useAppConfig("basic.writeMetadataExtended");
    const currentDownloadLyricFile = useAppConfig("basic.downloadLyricFile");
    const currentLyricFileFormat = useAppConfig("basic.lyricFileFormat");
    const currentDownloadCoverFile = useAppConfig("basic.downloadCoverFile");
    const currentCoverFileNaming = useAppConfig("basic.downloadCoverFileNaming");
    const currentLyricOrder = useAppConfig("basic.lyricOrder");
    const currentEnableWordByWord = useAppConfig("basic.enableWordByWordLyric");

    const [settings, setSettings] = useState({
        writeMetadata: currentWriteMetadata ?? defaultSettings.writeMetadata,
        writeMetadataCover:
            currentWriteMetadataCover ?? defaultSettings.writeMetadataCover,
        writeMetadataLyric:
            currentWriteMetadataLyric ?? defaultSettings.writeMetadataLyric,
        writeMetadataExtended:
            currentWriteMetadataExtended ?? defaultSettings.writeMetadataExtended,
        downloadLyricFile:
            currentDownloadLyricFile ?? defaultSettings.downloadLyricFile,
        lyricFileFormat:
            currentLyricFileFormat ?? defaultSettings.lyricFileFormat,
        downloadCoverFile:
            currentDownloadCoverFile ?? defaultSettings.downloadCoverFile,
        coverFileNaming:
            currentCoverFileNaming ?? defaultSettings.coverFileNaming,
        lyricOrder: currentLyricOrder ?? defaultSettings.lyricOrder,
        enableWordByWord:
            currentEnableWordByWord ?? defaultSettings.enableWordByWord,
    });

    const handleSave = () => {
        Config.setConfig("basic.writeMetadata", settings.writeMetadata);
        Config.setConfig("basic.writeMetadataCover", settings.writeMetadataCover);
        Config.setConfig("basic.writeMetadataLyric", settings.writeMetadataLyric);
        Config.setConfig(
            "basic.writeMetadataExtended",
            settings.writeMetadataExtended,
        );
        Config.setConfig("basic.downloadLyricFile", settings.downloadLyricFile);
        Config.setConfig("basic.lyricFileFormat", settings.lyricFileFormat);
        Config.setConfig("basic.downloadCoverFile", settings.downloadCoverFile);
        Config.setConfig("basic.downloadCoverFileNaming", settings.coverFileNaming);
        Config.setConfig("basic.lyricOrder", settings.lyricOrder);
        Config.setConfig("basic.enableWordByWordLyric", settings.enableWordByWord);

        Toast.success(t("panel.musicMetadata.toastSaved"));
        hidePanel();
    };

    const handleReset = () => {
        // lyricOrder 是数组，必须复制，否则后续排序会改到默认值本身
        setSettings({
            ...defaultSettings,
            lyricOrder: [...defaultSettings.lyricOrder],
        });
        Toast.success(t("panel.musicMetadata.toastReset"));
    };

    const createSwitchHandler = (key: keyof typeof settings) => {
        return (value: boolean) => {
            setSettings(prev => ({
                ...prev,
                [key]: value,
            }));
        };
    };

    // Lyric order toggle handler
    const toggleLyricOrderItem = (item: LyricOrderItem) => {
        setSettings(prev => {
            const currentOrder = prev.lyricOrder;
            if (currentOrder.includes(item)) {
                // Remove item (allow empty)
                return {
                    ...prev,
                    lyricOrder: currentOrder.filter(i => i !== item),
                };
            }
            // Add item to end
            return {
                ...prev,
                lyricOrder: [...currentOrder, item],
            };
        });
    };

    // Move item up in order
    const moveLyricOrderUp = (item: LyricOrderItem) => {
        setSettings(prev => {
            const currentOrder = [...prev.lyricOrder];
            const index = currentOrder.indexOf(item);
            if (index > 0) {
                [currentOrder[index - 1], currentOrder[index]] = [
                    currentOrder[index],
                    currentOrder[index - 1],
                ];
            }
            return { ...prev, lyricOrder: currentOrder };
        });
    };

    // Move item down in order
    const moveLyricOrderDown = (item: LyricOrderItem) => {
        setSettings(prev => {
            const currentOrder = [...prev.lyricOrder];
            const index = currentOrder.indexOf(item);
            if (index >= 0 && index < currentOrder.length - 1) {
                [currentOrder[index], currentOrder[index + 1]] = [
                    currentOrder[index + 1],
                    currentOrder[index],
                ];
            }
            return { ...prev, lyricOrder: currentOrder };
        });
    };

    const pickLyricFileFormat = () => {
        showDialog("RadioDialog", {
            title: t("panel.musicMetadata.lyricFileFormat"),
            content: [
                { label: ".lrc", value: "lrc" },
                { label: ".txt", value: "txt" },
            ],
            onOk(val) {
                setSettings(prev => ({
                    ...prev,
                    lyricFileFormat: val as "lrc" | "txt",
                }));
            },
        });
    };

    const pickCoverFileNaming = () => {
        showDialog("RadioDialog", {
            title: t("panel.musicMetadata.coverFileNaming"),
            content: [
                {
                    label: t("panel.musicMetadata.coverFileNaming.sameAsAudio"),
                    value: "sameAsAudio",
                },
                {
                    label: t("panel.musicMetadata.coverFileNaming.fixedName"),
                    value: "fixedName",
                },
            ],
            onOk(val) {
                setSettings(prev => ({
                    ...prev,
                    coverFileNaming: val as "sameAsAudio" | "fixedName",
                }));
            },
        });
    };

    const renderLyricOrderItem = (item: LyricOrderItem) => {
        const isChecked = settings.lyricOrder.includes(item);
        const index = settings.lyricOrder.indexOf(item);
        const isFirst = index === 0;
        const isLast = index === settings.lyricOrder.length - 1;

        return (
            <ListItem
                key={item}
                withHorizontalPadding
                heightType="none"
                style={styles.orderRow}
                onPress={() => toggleLyricOrderItem(item)}>
                <Checkbox
                    checked={isChecked}
                    onPress={() => toggleLyricOrderItem(item)}
                />
                <ListItem.Content
                    title={t(lyricTypeTitleKey[item])}
                    description={t(lyricTypeDescKey[item])}
                    containerStyle={styles.orderContent}
                />
                {isChecked ? (
                    <View style={styles.reorderButtons}>
                        <TouchableOpacity
                            accessibilityLabel={t("panel.musicMetadata.moveUp")}
                            disabled={isFirst}
                            style={[
                                styles.reorderButton,
                                styles.rotateUp,
                                isFirst && styles.reorderButtonDisabled,
                            ]}
                            onPress={() => moveLyricOrderUp(item)}>
                            <Icon
                                name="chevron-right"
                                size={rpx(32)}
                                color={colors.text}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            accessibilityLabel={t("panel.musicMetadata.moveDown")}
                            disabled={isLast}
                            style={[
                                styles.reorderButton,
                                styles.rotateDown,
                                isLast && styles.reorderButtonDisabled,
                            ]}
                            onPress={() => moveLyricOrderDown(item)}>
                            <Icon
                                name="chevron-right"
                                size={rpx(32)}
                                color={colors.text}
                            />
                        </TouchableOpacity>
                    </View>
                ) : null}
            </ListItem>
        );
    };

    // Check if lyric features are enabled
    const lyricFeaturesEnabled =
        (settings.writeMetadata && settings.writeMetadataLyric) ||
        settings.downloadLyricFile;

    return (
        <PanelBase
            keyboardAvoidBehavior="height"
            height={vmax(70)}
            renderBody={() => (
                <>
                    <PanelHeader
                        title={t("panel.musicMetadata.title")}
                        onCancel={() => {
                            hidePanel();
                        }}
                        onOk={handleSave}
                    />
                    <ScrollView style={styles.scrollView}>
                        <SettingSection
                            title={t("panel.musicMetadata.group.writeMetadata")}
                            description={t("panel.musicMetadata.description")}>
                            <SettingRow
                                descriptionLines={2}
                                title={t("panel.musicMetadata.writeMetadata")}
                                description={t(
                                    "panel.musicMetadata.writeMetadataDesc",
                                )}
                                right={
                                    <ThemeSwitch
                                        value={settings.writeMetadata}
                                        onValueChange={createSwitchHandler(
                                            "writeMetadata",
                                        )}
                                    />
                                }
                            />
                        </SettingSection>

                        {settings.writeMetadata ? (
                            <SettingSection
                                title={t("panel.musicMetadata.group.writeContent")}>
                                <SettingRow
                                    descriptionLines={2}
                                    title={t(
                                        "panel.musicMetadata.writeMetadataCover",
                                    )}
                                    description={t(
                                        "panel.musicMetadata.writeMetadataCoverDesc",
                                    )}
                                    right={
                                        <ThemeSwitch
                                            value={settings.writeMetadataCover}
                                            onValueChange={createSwitchHandler(
                                                "writeMetadataCover",
                                            )}
                                        />
                                    }
                                />
                                <Divider style={styles.insetDivider} />
                                <SettingRow
                                    descriptionLines={2}
                                    title={t(
                                        "panel.musicMetadata.writeMetadataExtended",
                                    )}
                                    description={t(
                                        "panel.musicMetadata.writeMetadataExtendedDesc",
                                    )}
                                    right={
                                        <ThemeSwitch
                                            value={settings.writeMetadataExtended}
                                            onValueChange={createSwitchHandler(
                                                "writeMetadataExtended",
                                            )}
                                        />
                                    }
                                />
                                <Divider style={styles.insetDivider} />
                                <SettingRow
                                    descriptionLines={2}
                                    title={t(
                                        "panel.musicMetadata.writeMetadataLyric",
                                    )}
                                    description={t(
                                        "panel.musicMetadata.writeMetadataLyricDesc",
                                    )}
                                    right={
                                        <ThemeSwitch
                                            value={settings.writeMetadataLyric}
                                            onValueChange={createSwitchHandler(
                                                "writeMetadataLyric",
                                            )}
                                        />
                                    }
                                />
                            </SettingSection>
                        ) : null}

                        <SettingSection
                            title={t("panel.musicMetadata.group.attachedFiles")}>
                            <SettingRow
                                descriptionLines={2}
                                title={t(
                                    "panel.musicItemLyricOptions.downloadLyricFile",
                                )}
                                description={t(
                                    "panel.musicMetadata.downloadLyricFileDesc",
                                )}
                                right={
                                    <ThemeSwitch
                                        value={settings.downloadLyricFile}
                                        onValueChange={createSwitchHandler(
                                            "downloadLyricFile",
                                        )}
                                    />
                                }
                            />
                            <Divider style={styles.insetDivider} />
                            <SettingRow
                                descriptionLines={2}
                                title={t("panel.musicMetadata.downloadCoverFile")}
                                description={t(
                                    "panel.musicMetadata.downloadCoverFileDesc",
                                )}
                                right={
                                    <ThemeSwitch
                                        value={settings.downloadCoverFile}
                                        onValueChange={createSwitchHandler(
                                            "downloadCoverFile",
                                        )}
                                    />
                                }
                            />
                            {settings.downloadCoverFile ? (
                                <>
                                    <Divider style={styles.insetDivider} />
                                    <SettingRow
                                        descriptionLines={2}
                                        title={t(
                                            "panel.musicMetadata.coverFileNaming",
                                        )}
                                        description={t(
                                            settings.coverFileNaming === "sameAsAudio"
                                                ? "panel.musicMetadata.coverFileNaming.sameAsAudioHint"
                                                : "panel.musicMetadata.coverFileNaming.fixedNameHint",
                                        )}
                                        value={t(
                                            settings.coverFileNaming === "sameAsAudio"
                                                ? "panel.musicMetadata.coverFileNaming.sameAsAudio"
                                                : "panel.musicMetadata.coverFileNaming.fixedName",
                                        )}
                                        showChevron
                                        onPress={pickCoverFileNaming}
                                    />
                                </>
                            ) : null}
                        </SettingSection>

                        {lyricFeaturesEnabled ? (
                            <SettingSection
                                title={t("panel.musicMetadata.group.lyricContent")}
                                description={t(
                                    "panel.musicMetadata.lyricContentDesc",
                                )}>
                                {lyricOrderItems.map(renderLyricOrderItem)}
                                {settings.lyricOrder.length > 0 ? (
                                    <ThemeText
                                        fontSize="description"
                                        fontColor="textSecondary"
                                        style={styles.orderHint}>
                                        {t("panel.musicMetadata.currentOrder", {
                                            order: settings.lyricOrder
                                                .map(i => t(lyricTypeTitleKey[i]))
                                                .join(" → "),
                                        })}
                                    </ThemeText>
                                ) : null}
                                <Divider style={styles.insetDivider} />
                                <SettingRow
                                    descriptionLines={2}
                                    title={t("panel.musicMetadata.enableWordByWord")}
                                    description={t(
                                        "panel.musicMetadata.enableWordByWordDesc",
                                    )}
                                    right={
                                        <ThemeSwitch
                                            value={settings.enableWordByWord}
                                            onValueChange={createSwitchHandler(
                                                "enableWordByWord",
                                            )}
                                        />
                                    }
                                />
                                {settings.downloadLyricFile ? (
                                    <>
                                        <Divider style={styles.insetDivider} />
                                        <SettingRow
                                            descriptionLines={2}
                                            title={t(
                                                "panel.musicMetadata.lyricFileFormat",
                                            )}
                                            value={
                                                settings.lyricFileFormat === "lrc"
                                                    ? ".lrc"
                                                    : ".txt"
                                            }
                                            showChevron
                                            onPress={pickLyricFileFormat}
                                        />
                                    </>
                                ) : null}
                            </SettingSection>
                        ) : null}

                        <SettingSection>
                            <SettingRow
                                descriptionLines={2}
                                title={t("panel.musicMetadata.resetToDefault")}
                                description={t(
                                    "panel.musicMetadata.resetToDefaultDesc",
                                )}
                                onPress={handleReset}
                            />
                        </SettingSection>

                        <View style={styles.bottomPadding} />
                    </ScrollView>
                </>
            )}
        />
    );
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    insetDivider: {
        marginLeft: settingsLayout.rowPadding,
    },
    orderRow: {
        minHeight: settingsLayout.rowMinHeight,
        paddingVertical: rpx(12),
    },
    orderContent: {
        marginLeft: settingsLayout.trailingGap,
    },
    reorderButtons: {
        flexDirection: "row",
        gap: rpx(8),
        flexShrink: 0,
    },
    reorderButton: {
        width: rpx(56),
        height: rpx(56),
        alignItems: "center",
        justifyContent: "center",
    },
    reorderButtonDisabled: {
        opacity: 0.3,
    },
    rotateUp: {
        transform: [{ rotate: "-90deg" }],
    },
    rotateDown: {
        transform: [{ rotate: "90deg" }],
    },
    orderHint: {
        marginHorizontal: settingsLayout.rowPadding,
        marginTop: rpx(12),
        marginBottom: rpx(8),
    },
    bottomPadding: {
        height: rpx(80),
    },
});
