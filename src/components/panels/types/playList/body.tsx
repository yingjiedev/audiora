import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView as GHScrollView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import Loading from "@/components/base/loading";
import FastImage from "@/components/base/fastImage";
import { ImgAsset } from "@/constants/assetsConst";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import { useCurrentMusic, useMusicState } from "@/core/trackPlayer";
import { usePluginDisplayNameResolver } from "@/core/pluginManager";
import { ISheetPlaybackEntry } from "@/core/sheetPlaybackHistory";
import useColors from "@/hooks/useColors";
import useMotion from "@/hooks/useMotion";
import { getMediaUniqueKey, isSameMediaItem } from "@/utils/mediaUtils";
import { musicIsPaused } from "@/utils/trackUtils";
import rpx from "@/utils/rpx";
import { QueueAction } from "./header";

const ITEM_HEIGHT = Math.max(48, rpx(92));

export function SongRow(props: {
    item: IMusic.IMusicItem;
    onPlay: (item: IMusic.IMusicItem) => void;
    onRemove: (item: IMusic.IMusicItem) => void;
    onMove: (item: IMusic.IMusicItem, offset: number) => void;
    onDragging: (dragging: boolean) => void;
}) {
    const { item, onPlay, onRemove, onMove, onDragging } = props;
    const currentMusic = useCurrentMusic();
    const musicState = useMusicState();
    const colors = useColors();
    const motion = useMotion();
    const { t } = useI18N();
    const current = !!isSameMediaItem(item, currentMusic);
    const highlight = colors.active;
    const offset = useSharedValue(0);
    const moving = useSharedValue(false);
    const move = (distance: number) => onMove(item, distance);
    const gesture = Gesture.Pan()
        .activateAfterLongPress(motion.duration("fast"))
        .onStart(() => {
            moving.value = true;
            runOnJS(onDragging)(true);
        })
        .onUpdate(event => {
            offset.value = event.translationY;
        })
        .onEnd((event, success) => {
            if (success) {
                runOnJS(move)(Math.round(event.translationY / ITEM_HEIGHT));
            }
        })
        .onFinalize(() => {
            offset.value = 0;
            if (moving.value) {
                runOnJS(onDragging)(false);
            }
            moving.value = false;
        });
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: offset.value }],
        zIndex: moving.value ? 10 : 0,
        backgroundColor: moving.value ? colors.surfaceElevated ?? colors.card : "transparent",
    }));

    useEffect(() => () => {
        if (moving.value) {
            onDragging(false);
        }
    }, [moving, onDragging]);

    return (
        <Animated.View style={[styles.songRow, animatedStyle]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={[item.title, item.artist].filter(Boolean).join(" - ")}
                accessibilityState={{ selected: current }}
                onPress={() => onPlay(item)}
                style={styles.songText}>
                <ThemeText numberOfLines={1} fontSize="title" color={current ? highlight : colors.text}>
                    {item.title}
                    {item.artist ? (
                        <ThemeText fontSize="content" color={current ? highlight : colors.textSecondary}>
                            {` - ${item.artist}`}
                        </ThemeText>
                    ) : null}
                </ThemeText>
            </Pressable>
            {item.fee === 1 ? <ThemeText fontSize="caption" color={highlight} style={styles.vip}>VIP</ThemeText> : null}
            {current ? <Icon name={musicIsPaused(musicState) ? "pause" : "musical-note"} color={highlight} size={rpx(30)} style={styles.currentIcon} /> : null}
            <QueueAction icon="x-mark" label={t("panel.playList.remove", { title: item.title })} onPress={() => onRemove(item)} />
            <GestureDetector gesture={gesture}>
                <View
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t("panel.playList.reorder", { title: item.title })}
                    accessibilityHint={t("panel.playList.reorderHint")}
                    accessibilityActions={[
                        { name: "increment", label: t("panel.playList.moveDown") },
                        { name: "decrement", label: t("panel.playList.moveUp") },
                    ]}
                    onAccessibilityAction={event => {
                        if (event.nativeEvent.actionName === "increment") {
                            move(1);
                        } else if (event.nativeEvent.actionName === "decrement") {
                            move(-1);
                        }
                    }}
                    style={styles.handle}>
                    <Icon name="bars-3" color={colors.textSecondary ?? colors.text} size={rpx(36)} />
                </View>
            </GestureDetector>
        </Animated.View>
    );
}

interface IBodyProps {
    loading: boolean;
    musics: IMusic.IMusicItem[];
    queue: boolean;
    onPlay: (item: IMusic.IMusicItem) => void;
    onRemove: (item: IMusic.IMusicItem) => void;
    onMove: (item: IMusic.IMusicItem, offset: number) => void;
}

export default function Body(props: IBodyProps) {
    const currentMusic = useCurrentMusic();
    const [dragging, setDragging] = useState(false);
    const insets = useSafeAreaInsets();
    const { t } = useI18N();
    const initialIndex = useMemo(() => {
        const index = props.queue ? props.musics.findIndex(item => isSameMediaItem(item, currentMusic)) : -1;
        return index < 0 ? undefined : index;
    }, [props.queue, props.musics, currentMusic]);

    return props.loading ? <Loading /> : (
        <GestureHandlerRootView style={styles.list}>
            <FlashList
                data={props.musics}
                keyExtractor={getMediaUniqueKey}
                extraData={currentMusic}
                initialScrollIndex={initialIndex}
                scrollEnabled={!dragging}
                renderScrollComponent={GHScrollView as any}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + spacing.sm }}
                ListEmptyComponent={<ThemeText fontColor="textSecondary" style={styles.empty}>{t(props.queue ? "panel.playList.emptyQueue" : "panel.playList.emptyHistory")}</ThemeText>}
                renderItem={({ item }) => <SongRow item={item} onPlay={props.onPlay} onRemove={props.onRemove} onMove={props.onMove} onDragging={setDragging} />}
            />
        </GestureHandlerRootView>
    );
}

export function SheetBody(props: { entries: ISheetPlaybackEntry[]; onOpen: (entry: ISheetPlaybackEntry) => void; onRemove: (entry: ISheetPlaybackEntry) => void }) {
    const { t } = useI18N();
    const getPluginDisplayName = usePluginDisplayNameResolver();
    const insets = useSafeAreaInsets();
    return (
        <GestureHandlerRootView style={styles.list}>
            <FlashList
                data={props.entries}
                keyExtractor={entry => JSON.stringify([entry.routeName, entry.sheet.platform, entry.sheet.id])}
                renderScrollComponent={GHScrollView as any}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + spacing.sm }}
                ListEmptyComponent={<ThemeText fontColor="textSecondary" style={styles.empty}>{t("panel.playList.emptySheets")}</ThemeText>}
                renderItem={({ item }) => (
                    <View style={styles.sheetRow}>
                        <Pressable accessibilityRole="button" accessibilityLabel={item.sheet.title ?? t("common.unknownName")} onPress={() => props.onOpen(item)} style={styles.sheetText}>
                            <FastImage source={item.sheet.coverImg ?? item.sheet.artwork} placeholderSource={ImgAsset.albumDefault} style={styles.sheetCover} />
                            <View style={styles.sheetDetails}>
                                <ThemeText fontSize="title" numberOfLines={1}>{item.sheet.title ?? t("common.unknownName")}</ThemeText>
                                <ThemeText fontSize="content" fontColor="textSecondary" numberOfLines={1}>{item.sheet.artist || getPluginDisplayName(item.sheet.platform)}</ThemeText>
                            </View>
                        </Pressable>
                        <QueueAction icon="x-mark" label={t("panel.playList.remove", { title: item.sheet.title })} onPress={() => props.onRemove(item)} />
                    </View>
                )}
            />
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    list: { flex: 1, minHeight: 0 },
    songRow: { height: ITEM_HEIGHT, flexDirection: "row", alignItems: "center", paddingLeft: spacing.xxxl, paddingRight: spacing.md },
    songText: { flex: 1, minWidth: 0, height: "100%", justifyContent: "center" },
    currentIcon: { marginLeft: spacing.sm, marginRight: spacing.xs },
    vip: { marginLeft: spacing.xs, marginRight: spacing.xs },
    handle: { width: 44, height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
    empty: { textAlign: "center", marginTop: spacing.xxxl * 2, marginHorizontal: spacing.xxxl },
    sheetRow: { height: Math.max(64, rpx(128)), flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xxxl },
    sheetText: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", height: "100%" },
    sheetCover: { width: 44, height: 44, borderRadius: spacing.xs, marginRight: spacing.lg },
    sheetDetails: { flex: 1, minWidth: 0, gap: spacing.xs },
});
