import React, { useMemo } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import rpx from "@/utils/rpx";
import ListItem from "../base/listItem";

import LocalMusicSheet from "@/core/localMusicSheet";
import { showPanel } from "../panels/usePanel";
import ThemeText from "../base/themeText";
import Tag from "../base/tag";
import TrackPlayer from "@/core/trackPlayer";
import Icon from "@/components/base/icon.tsx";
import { ImgAsset } from "@/constants/assetsConst";
import Badge from "../base/badge";

import { resolveArtwork } from "@/utils/artwork";
import { canPlayMusicVideo } from "@/utils/musicVideo";
import { getQualityBadge } from "./musicItemQuality";

interface IMusicItemProps {
    index?: string | number;
    showMoreIcon?: boolean;
    musicItem: IMusic.IMusicItem;
    titleTagSubText?: string;
    musicSheet?: IMusic.IMusicSheetItem;
    onItemPress?: (musicItem: IMusic.IMusicItem) => void;
    onItemLongPress?: () => void;
    itemPaddingRight?: number;
    left?: () => React.ReactElement;
    containerStyle?: StyleProp<ViewStyle>;
    highlight?: boolean
}
export default function MusicItem(props: IMusicItemProps) {
    const {
        musicItem,
        index,
        titleTagSubText,
        onItemPress,
        onItemLongPress,
        musicSheet,
        itemPaddingRight,
        showMoreIcon = true,
        left: Left,
        containerStyle,
        highlight = false,
    } = props;

    const isLocal = LocalMusicSheet.useIsLocal(musicItem);
    const localMusicItem = isLocal
        ? LocalMusicSheet.isLocalMusic(musicItem)
        : undefined;
    // 本地副本优先使用真实技术元数据，避免遗留在线 qualities 覆盖实际档位。
    const qualityBadge = useMemo(
        () => getQualityBadge(musicItem, localMusicItem),
        [localMusicItem, musicItem],
    );
    // 获取 VIP 标志
    const isVip = musicItem.fee === 1;
    const hasMv = useMemo(() => canPlayMusicVideo(musicItem), [musicItem]);

    return (
        <ListItem
            heightType="big"
            style={containerStyle}
            withHorizontalPadding
            leftPadding={index !== undefined ? 0 : undefined}
            rightPadding={itemPaddingRight}
            onLongPress={onItemLongPress}
            onPress={() => {
                if (onItemPress) {
                    onItemPress(musicItem);
                } else {
                    TrackPlayer.play(musicItem);
                }
            }}>
            {Left ? <Left /> : null}
            {index !== undefined ? (
                <ListItem.ListItemText
                    width={rpx(82)}
                    position="none"
                    fixedWidth
                    fontColor={highlight ? "primary" : "text"}
                    contentStyle={styles.indexText}>
                    {index}
                </ListItem.ListItemText>
            ) : null}
            <ListItem.ListItemImage
                uri={resolveArtwork(musicItem) ?? musicItem.artwork}
                fallbackImg={ImgAsset.albumDefault}
            />
            <ListItem.Content
                title={
                    <ThemeText
                        fontColor={highlight ? "primary" : "text"}
                        numberOfLines={1}>
                        {musicItem.title}
                    </ThemeText>
                }
                description={
                    <View style={styles.descContainer}>
                        {isLocal && (
                            <Icon
                                style={styles.icon}
                                color="#11659a"
                                name="check-circle"
                                size={rpx(22)}
                            />
                        )}
                        {qualityBadge && (
                            <Badge type={qualityBadge.type}>{qualityBadge.text}</Badge>
                        )}
                        {isVip && (
                            <Badge type="vip">VIP</Badge>
                        )}
                        {hasMv && (
                            <Badge type="source">MV</Badge>
                        )}
                        <ThemeText
                            numberOfLines={1}
                            fontSize="description"
                            fontColor={highlight ? "primary" : "textSecondary"}
                            style={styles.artistText}>
                            {musicItem.artist}
                            {musicItem.album ? ` - ${musicItem.album}` : ""}
                        </ThemeText>
                    </View>
                }
            />
            {(musicItem.platform || titleTagSubText) ? (
                <View style={styles.rightColumn}>
                    {musicItem.platform ? (
                        <Tag tagName={musicItem.platform} containerStyle={styles.rightTag} />
                    ) : null}
                    {titleTagSubText ? (
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary">
                            {titleTagSubText}
                        </ThemeText>
                    ) : null}
                </View>
            ) : null}
            {showMoreIcon ? (
                <ListItem.ListItemIcon
                    width={rpx(48)}
                    position="none"
                    icon="ellipsis-vertical"
                    onPress={() => {
                        showPanel("MusicItemOptions", {
                            musicItem,
                            musicSheet,
                        });
                    }}
                />
            ) : null}
        </ListItem>
    );
}

const styles = StyleSheet.create({
    icon: {
        marginRight: rpx(6),
    },
    descContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: rpx(16),
    },
    artistText: {
        flex: 1,
    },
    rightColumn: {
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: rpx(12),
        marginRight: rpx(8),
        gap: rpx(6),
    },
    rightTag: {
        marginLeft: 0,
    },
    indexText: {
        fontStyle: "italic",
        textAlign: "center",
        padding: rpx(2),
    },
});
