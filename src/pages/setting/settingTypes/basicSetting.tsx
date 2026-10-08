import Paragraph from "@/components/base/paragraph";
import ThemeSwitch from "@/components/base/switch";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { SortType } from "@/constants/commonConst.ts";
import { getDownloadMusicPath } from "@/constants/pathConst";
import Config, { useAppConfig } from "@/core/appConfig";
import DownloadPath from "@/core/downloadPath";
import lyricManager from "@/core/lyricManager";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import { AppConfigPropertyKey } from "@/types/core/config";
import { useParams } from "@/core/router";
import { clearCache, getCacheSize, sizeFormatter } from "@/utils/fileUtils";
import { clearLog, getErrorLogContent } from "@/utils/log";
import { getQualityKeys, getQualityText } from "@/utils/qualities";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import Clipboard from "@react-native-clipboard/clipboard";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, SectionList, StyleSheet, TouchableOpacity, View } from "react-native";
import { FlatList, ScrollView } from "react-native-gesture-handler";
import {
    getPresetTemplates,
    validateTemplate,
    DEFAULT_FILE_NAMING_CONFIG,
    TEMPLATE_VARIABLES,
} from "@/utils/fileNamingFormatter";
import { getAndroidSafDirectoryLabel } from "@/utils/androidSaf";
import SettingRow from "../components/settingRow";
import { settingsLayout } from "../components/settingsLayout";

function createSwitch(
    title: string,
    changeKey: AppConfigPropertyKey,
    value: boolean,
    callback?: (newValue: boolean) => void,
) {
    const onPress = () => {
        if (callback) {
            callback(!value);
        } else {
            Config.setConfig(changeKey, !value);
        }
    };
    return {
        title,
        onPress,
        right: <ThemeSwitch value={value} onValueChange={onPress} />,
    };
}

const createRadio = function (
    title: string,
    changeKey: AppConfigPropertyKey,
    candidates: Array<string | number>,
    value: string | number,
    valueMap?: Record<string | number, string | number>,
    onChange?: (value: string | number) => void,
) {
    const onPress = () => {
        showDialog("RadioDialog", {
            title,
            content: valueMap
                ? candidates.map(_ => ({
                    label: valueMap[_] as string,
                    value: _,
                }))
                : candidates,
            onOk(val) {
                Config.setConfig(changeKey, val);
                onChange?.(val);
            },
        });
    };
    return {
        title,
        right: (
            <ThemeText numberOfLines={1} style={styles.valueText}>
                {valueMap ? valueMap[value] : value}
            </ThemeText>
        ),
        onPress,
    };
};

function useCacheSize() {
    const [cacheSize, setCacheSize] = useState({
        music: 0,
        lyric: 0,
        image: 0,
    });

    const refreshCacheSize = useCallback(async () => {
        const [musicCache, lyricCache, imageCache] = await Promise.all([
            getCacheSize("music"),
            getCacheSize("lyric"),
            getCacheSize("image"),
        ]);
        setCacheSize({
            music: musicCache,
            lyric: lyricCache,
            image: imageCache,
        });
    }, []);

    return [cacheSize, refreshCacheSize] as const;
}

export default function BasicSetting() {
    const { section: requestedSection } = useParams<"setting">();

    const autoPlayWhenAppStart = useAppConfig("basic.autoPlayWhenAppStart");
    const openPlayDetailOnLaunch = useAppConfig("basic.openPlayDetailOnLaunch");
    const useCelluarNetworkPlay = useAppConfig("basic.useCelluarNetworkPlay");
    const useCelluarNetworkDownload = useAppConfig("basic.useCelluarNetworkDownload");
    const maxDownload = useAppConfig("basic.maxDownload");
    const clickMusicInSearch = useAppConfig("basic.clickMusicInSearch");
    const clickMusicInAlbum = useAppConfig("basic.clickMusicInAlbum");
    const downloadPath = useAppConfig("basic.downloadPath");
    const notInterrupt = useAppConfig("basic.notInterrupt");
    const tempRemoteDuck = useAppConfig("basic.tempRemoteDuck");
    const tempRemoteDuckVolume = useAppConfig("basic.tempRemoteDuckVolume");
    const autoStopWhenError = useAppConfig("basic.autoStopWhenError");
    const maxCacheSize = useAppConfig("basic.maxCacheSize");
    const defaultPlayQuality = useAppConfig("basic.defaultPlayQuality");
    const playQualityOrder = useAppConfig("basic.playQualityOrder");
    const defaultDownloadQuality = useAppConfig("basic.defaultDownloadQuality");
    const downloadQualityOrder = useAppConfig("basic.downloadQualityOrder");
    const musicDetailDefault = useAppConfig("basic.musicDetailDefault");
    const musicDetailAwake = useAppConfig("basic.musicDetailAwake");
    const maxHistoryLen = useAppConfig("basic.maxHistoryLen");
    const autoUpdatePlugin = useAppConfig("basic.autoUpdatePlugin");
    const notCheckPluginVersion = useAppConfig("basic.notCheckPluginVersion");
    const lazyLoadPlugin = useAppConfig("basic.lazyLoadPlugin");
    const associateLyricType = useAppConfig("basic.associateLyricType");
    const keyboardAvoidMode = useAppConfig("basic.keyboardAvoidMode");
    const showExitOnNotification = useAppConfig("basic.showExitOnNotification");
    const musicOrderInLocalSheet = useAppConfig("basic.musicOrderInLocalSheet");
    const tryChangeSourceWhenPlayFail = useAppConfig("basic.tryChangeSourceWhenPlayFail");
    
    // 文件命名相关配置
    const fileNamingType = useAppConfig("basic.fileNamingType");
    const fileNamingPreset = useAppConfig("basic.fileNamingPreset");
    const fileNamingCustom = useAppConfig("basic.fileNamingCustom");
    
    // 自定义音质翻译
    const customQualityTranslations = useAppConfig("basic.qualityTranslations");

    const { t, getLanguage } = useI18N();
    const colors = useColors();
    const qualityTextI18n = getQualityText(getLanguage().languageData, customQualityTranslations);

    const debugEnableErrorLog = useAppConfig("debug.errorLog");
    const debugEnableTraceLog = useAppConfig("debug.traceLog");
    const debugEnableDevLog = useAppConfig("debug.devLog");

    const [cacheSize, refreshCacheSize] = useCacheSize();

    const sectionListRef = useRef<SectionList | null>(null);
    // const titleListRef = useRef<FlatList | null>(null);

    useEffect(() => {
        refreshCacheSize();
    }, [refreshCacheSize]);

    const basicOptions = [
        {
            key: "playback",
            title: t("basicSettings.playback"),
            data: [
                createSwitch(
                    t("basicSettings.notInterrupt"),
                    "basic.notInterrupt",
                    notInterrupt ?? false,
                ),
                createSwitch(
                    t("basicSettings.autoPlayWhenAppStart"),
                    "basic.autoPlayWhenAppStart",
                    autoPlayWhenAppStart ?? false,
                ),
                createSwitch(
                    t("basicSettings.openPlayDetailOnLaunch"),
                    "basic.openPlayDetailOnLaunch",
                    openPlayDetailOnLaunch ?? false,
                ),
                createSwitch(
                    t("basicSettings.tryChangeSourceWhenPlayFail"),
                    "basic.tryChangeSourceWhenPlayFail",
                    tryChangeSourceWhenPlayFail ?? false,
                ),
                createSwitch(
                    t("basicSettings.autoStopWhenError"),
                    "basic.autoStopWhenError",
                    autoStopWhenError ?? false,
                ),
                createRadio(
                    t("basicSettings.tempRemoteDuck"),
                    "basic.tempRemoteDuck",
                    ["pause", "lowerVolume"],
                    tempRemoteDuck ?? "pause",
                    {
                        pause: t("basicSettings.tempRemoteDuck.pause"),
                        "lowerVolume": t("basicSettings.tempRemoteDuck.lowerVolume"),
                    }
                ),
                ...(tempRemoteDuck === "lowerVolume" ? [
                    createRadio(
                        t("basicSettings.tempRemoteDuck.volumeDecreaseLevel"),
                        "basic.tempRemoteDuckVolume",
                        [0.3, 0.5, 0.8],
                        tempRemoteDuckVolume ?? 0.5,
                        {
                            0.3: "30%",
                            0.5: "50%",
                            0.8: "80%",
                        }
                    ),
                ] : []),
                createRadio(
                    t("basicSettings.defaultPlayQuality"),
                    "basic.defaultPlayQuality",
                    getQualityKeys(),
                    defaultPlayQuality ?? "master",
                    qualityTextI18n,
                ),
                createRadio(
                    t("basicSettings.playQualityOrder"),
                    "basic.playQualityOrder",
                    ["asc", "desc"],
                    playQualityOrder ?? "desc",
                    {
                        asc: t("basicSettings.playQualityOrder.asc"),
                        desc: t("basicSettings.playQualityOrder.desc"),
                    },
                ),
            ],
        },
        {
            key: "common",
            title: t("basicSettings.common"),
            data: [
                createRadio(
                    t("basicSettings.maxHistoryLength"),
                    "basic.maxHistoryLen",
                    [20, 50, 100, 200, 500],
                    maxHistoryLen ?? 50,
                ),
                createRadio(
                    t("basicSettings.musicDetailDefault"),
                    "basic.musicDetailDefault",
                    ["album", "lyric"],
                    musicDetailDefault ?? "album",
                    {
                        album: t("basicSettings.musicDetailDefault.album"),
                        lyric: t("basicSettings.musicDetailDefault.lyric"),
                    },
                ),
                createSwitch(
                    t("basicSettings.musicDetailAwake"),
                    "basic.musicDetailAwake",
                    musicDetailAwake ?? false,
                ),
                createRadio(
                    t("basicSettings.associateLyricType"),
                    "basic.associateLyricType",
                    ["input", "search"],
                    associateLyricType ?? "search",
                    {
                        input: t("basicSettings.associateLyricType.input"),
                        search: t("basicSettings.associateLyricType.search"),
                    },
                ),
                createRadio(
                    t("basicSettings.keyboardAvoidMode"),
                    "basic.keyboardAvoidMode",
                    ["auto", "manual", "off"],
                    keyboardAvoidMode ?? "auto",
                    {
                        auto: t("basicSettings.keyboardAvoidMode.auto"),
                        manual: t("basicSettings.keyboardAvoidMode.manual"),
                        off: t("basicSettings.keyboardAvoidMode.off"),
                    },
                ),
                createSwitch(
                    t("basicSettings.showExitOnNotification"),
                    "basic.showExitOnNotification",
                    showExitOnNotification ?? false,
                ),
                {
                    title: t("basicSettings.qualityManagement"),
                    right: (
                        <ThemeText numberOfLines={1} fontSize="subTitle" style={styles.valueText}>
                            {t("basicSettings.custom")}
                        </ThemeText>
                    ),
                    onPress() {
                        showPanel("QualityTranslationPanel");
                    },
                },
            ],
        },
        {
            key: "sheetAndAlbum",
            title: t("basicSettings.sheetAndAlbum"),
            data: [
                createRadio(
                    t("basicSettings.clickMusicInSearch"),
                    "basic.clickMusicInSearch",
                    ["playMusic", "playMusicAndReplace"],
                    clickMusicInSearch ?? "playMusic",
                    {
                        playMusic: t("basicSettings.clickMusicInSearch.playMusic"),
                        playMusicAndReplace: t("basicSettings.clickMusicInSearch.playMusicAndReplace"),
                    },
                ),
                createRadio(
                    t("basicSettings.clickMusicInAlbum"),
                    "basic.clickMusicInAlbum",
                    ["playMusic", "playAlbum"],
                    clickMusicInAlbum ?? "playAlbum",
                    {
                        playMusic: t("basicSettings.clickMusicInAlbum.playMusic"),
                        playAlbum: t("basicSettings.clickMusicInAlbum.playAlbum"),
                    },
                ),
                createRadio(
                    t("basicSettings.musicOrderInLocalSheet"),
                    "basic.musicOrderInLocalSheet",
                    [
                        SortType.Title,
                        SortType.Artist,
                        SortType.Album,
                        SortType.Newest,
                        SortType.Oldest,
                    ],
                    musicOrderInLocalSheet ?? "end",
                    {
                        [SortType.Title]: t("basicSettings.musicOrderInLocalSheet.title"),
                        [SortType.Artist]: t("basicSettings.musicOrderInLocalSheet.artist"),
                        [SortType.Album]: t("basicSettings.musicOrderInLocalSheet.album"),
                        [SortType.Newest]: t("basicSettings.musicOrderInLocalSheet.newest"),
                        [SortType.Oldest]: t("basicSettings.musicOrderInLocalSheet.oldest"),
                    },
                ),
            ],
        },
        {
            key: "plugin",
            title: t("basicSettings.plugin"),
            data: [
                createSwitch(
                    t("basicSettings.autoUpdatePlugin"),
                    "basic.autoUpdatePlugin",
                    autoUpdatePlugin ?? false,
                ),
                createSwitch(
                    t("basicSettings.notCheckPluginVersion"),
                    "basic.notCheckPluginVersion",
                    notCheckPluginVersion ?? false,
                ),
                createSwitch(
                    t("basicSettings.lazyLoadPlugin"),
                    "basic.lazyLoadPlugin",
                    lazyLoadPlugin ?? true,
                ),
            ],
        },
        {
            key: "download",
            title: t("basicSettings.download"),
            data: [
                {
                    title: t("basicSettings.downloadPath"),
                    right: (
                        <ThemeText
                            fontSize="subTitle"
                            style={styles.valueText}
                            numberOfLines={3}>
                            {Platform.OS === "android"
                                ? getAndroidSafDirectoryLabel(downloadPath)
                                : getDownloadMusicPath(downloadPath)}
                        </ThemeText>
                    ),
                    async onPress() {
                        if (Platform.OS !== "android") {
                            return;
                        }
                        // basic.downloadPath 的唯一写入口在 core/downloadPath，
                        // 这里只负责触发一次目录选择
                        await DownloadPath.choose();
                    },
                },
                createRadio(
                    t("basicSettings.maxDownload"),
                    "basic.maxDownload",
                    [1, 3, 5, 7],
                    maxDownload ?? 3,
                ),
                createRadio(
                    t("basicSettings.defaultDownloadQuality"),
                    "basic.defaultDownloadQuality",
                    getQualityKeys(),
                    defaultDownloadQuality ?? "master",
                    qualityTextI18n,
                ),
                createRadio(
                    t("basicSettings.downloadQualityOrder"),
                    "basic.downloadQualityOrder",
                    ["asc", "desc"],
                    downloadQualityOrder ?? "desc",
                    {
                        asc: t("basicSettings.downloadQualityOrder.asc"),
                        desc: t("basicSettings.downloadQualityOrder.desc"),
                    },
                ),
                // 文件命名格式设置
                {
                    title: t("basicSettings.fileNaming"),
                    right: (
                        <ThemeText numberOfLines={1}
                            fontSize="subTitle"
                            style={styles.valueText}>
                            {fileNamingType === "custom" ? t("basicSettings.custom") : (fileNamingPreset || t("basicSettings.fileNamingDefaultPreset"))}
                        </ThemeText>
                    ),
                    onPress() {
                        showDialog("RadioDialog", {
                            title: t("basicSettings.fileNamingType"),
                            content: [
                                { label: t("basicSettings.fileNamingPreset"), value: "preset" },
                                { label: t("basicSettings.fileNamingCustom"), value: "custom" },
                            ],
                            onOk(val) {
                                Config.setConfig("basic.fileNamingType", val as "preset" | "custom");
                                // 设置默认值
                                if (val === "preset" && !fileNamingPreset) {
                                    Config.setConfig("basic.fileNamingPreset", DEFAULT_FILE_NAMING_CONFIG.preset);
                                } else if (val === "custom" && !fileNamingCustom) {
                                    Config.setConfig("basic.fileNamingCustom", "{title}-{artist}");
                                }
                            },
                        });
                    },
                },
                // 预设模板选择（仅当选择预设模板时显示）
                ...(fileNamingType === "preset" || !fileNamingType ? [{
                    title: t("basicSettings.fileNamingPreset"),
                    right: (
                        <ThemeText numberOfLines={1}
                            fontSize="subTitle"
                            style={styles.valueText}>
                            {fileNamingPreset || t("basicSettings.fileNamingDefaultPreset")}
                        </ThemeText>
                    ),
                    onPress() {
                        const presetTemplates = getPresetTemplates();
                        showDialog("RadioDialog", {
                            title: t("basicSettings.fileNamingPresetTitle"),
                            content: presetTemplates.map(template => ({
                                label: template,
                                value: template,
                            })),
                            onOk(val) {
                                Config.setConfig("basic.fileNamingPreset", val as IFileNaming.IPresetTemplate);
                            },
                        });
                    },
                }] : []),
                // 自定义模板输入（仅当选择自定义模板时显示）
                ...(fileNamingType === "custom" ? [{
                    title: t("basicSettings.fileNamingCustom"),
                    right: (
                        <ThemeText
                            fontSize="subTitle"
                            style={styles.valueText}
                            numberOfLines={2}>
                            {fileNamingCustom || "{title}-{artist}"}
                        </ThemeText>
                    ),
                    onPress() {
                        showPanel("SimpleInput", {
                            title: t("basicSettings.fileNamingCustomTitle"),
                            placeholder: t("basicSettings.fileNamingPlaceholder"),
                            defaultValue: fileNamingCustom || "{title}-{artist}",
                            tips: t("basicSettings.fileNamingVariables", {
                                variables: Object.entries(TEMPLATE_VARIABLES).map(([key, desc]) => `${key}(${desc})`).join(", "),
                            }),
                            onOk(text, closePanel) {
                                const validation = validateTemplate(text);
                                if (!validation.valid) {
                                    Toast.warn(validation.error || t("basicSettings.fileNamingTemplateInvalid"));
                                    return;
                                }
                                Config.setConfig("basic.fileNamingCustom", text);
                                closePanel();
                                Toast.success(t("basicSettings.fileNamingTemplateSaved"));
                            },
                        });
                    },
                }] : []),
                // 音乐标签设置
                {
                    title: t("basicSettings.musicTagSettings"),
                    right: (
                        <ThemeText numberOfLines={1} fontSize="subTitle" style={styles.valueText}>
                            {t("basicSettings.custom")}
                        </ThemeText>
                    ),
                    onPress() {
                        showPanel("MusicMetadataSettingsPanel");
                    },
                },
            ],
        },
        {
            key: "network",
            title: t("basicSettings.network"),
            data: [
                createSwitch(
                    t("basicSettings.useCelluarNetworkPlay"),
                    "basic.useCelluarNetworkPlay",
                    useCelluarNetworkPlay ?? false,
                ),
                createSwitch(
                    t("basicSettings.useCelluarNetworkDownload"),
                    "basic.useCelluarNetworkDownload",
                    useCelluarNetworkDownload ?? false,
                ),
            ],
        },
        {
            key: "lyric",
            title: t("basicSettings.lyric"),
            data: [],
            footer: <LyricSetting />,
        },
        {
            key: "cache",
            title: t("basicSettings.cache"),
            data: [
                {
                    title: t("basicSettings.cache.musicCacheLimit"),
                    right: (
                        <ThemeText numberOfLines={1} style={styles.valueText}>
                            {maxCacheSize
                                ? sizeFormatter(maxCacheSize)
                                : "512M"}
                        </ThemeText>
                    ),
                    onPress() {
                        showPanel("SimpleInput", {
                            title: t("dialog.setCacheTitle"),
                            placeholder: t("dialog.setCachePlaceholder"),
                            onOk(text, closePanel) {
                                let val = parseInt(text, 10);
                                if (val < 100) {
                                    val = 100;
                                } else if (val > 8192) {
                                    val = 8192;
                                }
                                if (val >= 100 && val <= 8192) {
                                    Config.setConfig(
                                        "basic.maxCacheSize",
                                        val * 1024 * 1024,
                                    );
                                    closePanel();
                                    Toast.success(t("toast.cacheSetSuccess"));
                                }
                            },
                        });
                    },
                },

                {
                    title: t("basicSettings.cache.clearMusicCache"),
                    right: (
                        <ThemeText numberOfLines={1} style={styles.valueText}>
                            {sizeFormatter(cacheSize.music)}
                        </ThemeText>
                    ),
                    onPress() {
                        showDialog("SimpleDialog", {
                            title: t("dialog.clearMusicCacheTitle"),
                            content: t("dialog.clearMusicCacheContent"),
                            async onOk() {
                                await clearCache("music");
                                Toast.success(t("toast.musicCacheCleared"));
                                refreshCacheSize();
                            },
                        });
                    },
                },
                {
                    title: t("basicSettings.cache.clearLyricCache"),
                    right: (
                        <ThemeText numberOfLines={1} style={styles.valueText}>
                            {sizeFormatter(cacheSize.lyric)}
                        </ThemeText>
                    ),
                    onPress() {
                        showDialog("SimpleDialog", {
                            title: t("dialog.clearLyricCacheTitle"),
                            content: t("dialog.clearLyricCacheContent"),
                            async onOk() {
                                await clearCache("lyric");
                                Toast.success(t("toast.lyricCacheCleared"));
                                refreshCacheSize();
                            },
                        });
                    },
                },
                {
                    title: t("basicSettings.cache.clearImageCache"),
                    right: (
                        <ThemeText numberOfLines={1} style={styles.valueText}>
                            {sizeFormatter(cacheSize.image)}
                        </ThemeText>
                    ),
                    onPress() {
                        showDialog("SimpleDialog", {
                            title: t("dialog.clearImageCacheTitle"),
                            content: t("dialog.clearImageCacheContent"),
                            async onOk() {
                                await clearCache("image");
                                Toast.success(t("toast.imageCacheCleared"));
                                refreshCacheSize();
                            },
                        });
                    },
                },
            ],
        },
        {
            key: "developer",
            title: t("basicSettings.developer"),
            data: [
                createSwitch(
                    t("basicSettings.developer.errorLog"),
                    "debug.errorLog",
                    debugEnableErrorLog ?? false,
                ),
                createSwitch(
                    t("basicSettings.developer.traceLog"),
                    "debug.traceLog",
                    debugEnableTraceLog ?? false,
                ),
                createSwitch(
                    t("basicSettings.developer.devLog"),
                    "debug.devLog",
                    debugEnableDevLog ?? false,
                ),
                {
                    title: t("basicSettings.developer.viewErrorLog"),
                    right: undefined,
                    async onPress() {
                        // 获取日志文件夹
                        const errorLogContent = await getErrorLogContent();
                        showDialog("SimpleDialog", {
                            title: t("dialog.errorLogTitle"),
                            content: (
                                <ScrollView>
                                    <Paragraph>
                                        {errorLogContent || t("dialog.errorLogNoRecord")}
                                    </Paragraph>
                                </ScrollView>
                            ),
                            cancelText: t("dialog.errorLogKnow"),
                            okText: t("dialog.errorLogCopy"),
                            onOk() {
                                Clipboard.setString(errorLogContent);
                                Toast.success(t("toast.copiedToClipboard"));
                            },
                        });
                    },
                },
                {
                    title: t("basicSettings.developer.clearLog"),
                    right: undefined,
                    async onPress() {
                        try {
                            await clearLog();
                            Toast.success(t("toast.logCleared"));
                        } catch { }
                    },
                },
            ],
        },
    ];

    const visibleOptions = requestedSection
        ? basicOptions.filter(item => item.key === requestedSection)
        : basicOptions;

    return (
        <View style={styles.wrapper}>
            {!requestedSection ? (
                <FlatList
                    style={styles.headerContainer}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.headerContentContainer}
                    horizontal
                    data={basicOptions.map(it => it.title)}
                    renderItem={({ item, index }) => (
                        <TouchableOpacity
                            onPress={() => {
                                sectionListRef.current?.scrollToLocation({
                                    sectionIndex: index,
                                    itemIndex: 0,
                                });
                            }}
                            activeOpacity={0.7}
                            style={styles.headerItemStyle}>
                            <ThemeText fontWeight="bold">{item}</ThemeText>
                        </TouchableOpacity>
                    )}
                />
            ) : null}
            <SectionList
                contentContainerStyle={styles.sectionListContent}
                sections={visibleOptions}
                renderSectionHeader={({ section }) => (
                    <View style={styles.sectionHeader}>
                        <ThemeText
                            fontSize="subTitle"
                            fontColor="textSecondary"
                            fontWeight="bold">
                            {section.title}
                        </ThemeText>
                    </View>
                )}
                ref={sectionListRef}
                renderSectionFooter={({ section }) => {
                    return section.footer ?? null;
                }}
                renderItem={({ index, item, section }) => {
                    const Right = item.right;
                    const isFirst = index === 0;
                    const isLast = index === section.data.length - 1;

                    return (
                        <SettingRow
                            title={item.title}
                            right={Right}
                            onPress={item.onPress}
                            style={[
                                styles.sectionItem,
                                {
                                    backgroundColor: colors.card,
                                },
                                isFirst ? styles.sectionItemFirst : null,
                                isLast ? styles.sectionItemLast : null,
                            ]}
                        />
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        paddingBottom: rpx(24),
        flex: 1,
    },
    valueText: {
        textAlignVertical: "center",
        // 交给外层控件槽做宽度约束，这里只负责自己能收缩
        flexShrink: 1,
    },
    sectionListContent: {
        paddingBottom: rpx(48),
    },
    sectionHeader: {
        // 与设置行文字左边缘对齐：分组卡片外边距 + 行内边距
        paddingHorizontal: settingsLayout.groupMargin + settingsLayout.rowPadding,
        height: rpx(64),
        flexDirection: "row",
        alignItems: "center",
        marginTop: rpx(12),
    },
    sectionItem: {
        marginHorizontal: settingsLayout.groupMargin,
    },
    sectionItemFirst: {
        borderTopLeftRadius: rpx(16),
        borderTopRightRadius: rpx(16),
    },
    sectionItemLast: {
        borderBottomLeftRadius: rpx(16),
        borderBottomRightRadius: rpx(16),
    },
    headerContainer: {
        height: rpx(80),
    },
    headerContentContainer: {
        height: rpx(80),
        alignItems: "center",
        paddingHorizontal: rpx(24),
    },
    headerItemStyle: {
        paddingHorizontal: rpx(36),
        height: rpx(80),
        justifyContent: "center",
        alignItems: "center",
    },
});

function LyricSetting() {
    const enableAutoSearchLyric = useAppConfig("lyric.autoSearchLyric");
    const enableWordByWord = useAppConfig("lyric.enableWordByWord");
    const enableWordByWordFloat = useAppConfig("lyric.enableWordByWordFloat");
    const pureWhiteMode = useAppConfig("lyric.pureWhiteMode");
    const enableBreathingDots = useAppConfig("lyric.enableBreathingDots");

    const { t } = useI18N();
    const colors = useColors();

    const autoSearchLyric = createSwitch(t("basicSettings.lyric.autoSearchLyric"), "lyric.autoSearchLyric", enableAutoSearchLyric ?? false);
    const wordByWordLyric = createSwitch(
        t("basicSettings.lyric.wordByWord"),
        "lyric.enableWordByWord",
        enableWordByWord ?? true,
        // 重载当前歌词由 lyricManager 统一负责：这个开关只影响歌词解析
        // （QRC 是否保留逐字时间轴），不重载就得等到下一首歌才生效
        newValue => lyricManager.setWordByWordEnabled(newValue),
    );
    const wordByWordFloat = createSwitch(t("basicSettings.lyric.wordByWordFloat"), "lyric.enableWordByWordFloat", enableWordByWordFloat ?? true);
    const highlightColor = createSwitch(t("basicSettings.lyric.pureWhiteMode"), "lyric.pureWhiteMode", pureWhiteMode ?? true);
    const breathingDots = createSwitch(t("basicSettings.lyric.breathingDots"), "lyric.enableBreathingDots", enableBreathingDots ?? true);

    return (
        <View style={[lyricStyles.card, { backgroundColor: colors.card }]}>
            {/* 详情页歌词设置 */}
            <SettingRow title={autoSearchLyric.title} right={autoSearchLyric.right} onPress={autoSearchLyric.onPress} />
            <SettingRow title={wordByWordLyric.title} right={wordByWordLyric.right} onPress={wordByWordLyric.onPress} />
            <SettingRow title={wordByWordFloat.title} right={wordByWordFloat.right} onPress={wordByWordFloat.onPress} />
            <SettingRow title={highlightColor.title} right={highlightColor.right} onPress={highlightColor.onPress} />
            <SettingRow title={breathingDots.title} right={breathingDots.right} onPress={breathingDots.onPress} />
        </View>
    );
}

const lyricStyles = StyleSheet.create({
    card: {
        borderRadius: settingsLayout.cardRadius,
        marginHorizontal: settingsLayout.groupMargin,
        overflow: "hidden",
    },
});
