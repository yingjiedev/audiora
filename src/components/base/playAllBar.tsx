import { buttonHeight, spacing, controlSize } from "@/constants/designSystem";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { iconSizeConst } from "@/constants/uiConst";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import ThemeText from "./themeText";
import useColors from "@/hooks/useColors";
import { showPanel } from "../panels/usePanel";
import TrackPlayer from "@/core/trackPlayer";
import Toast from "@/utils/toast";
import Icon, { IIconName } from "@/components/base/icon.tsx";
import MusicSheet, { useSheetIsStarred } from "@/core/musicSheet";
import { MusicRepeatMode } from "@/constants/repeatModeConst";
import { useI18N } from "@/core/i18n";
import { useRoute } from "@react-navigation/native";
import RoundActionButton from "./roundActionButton";

const minimumTouch = Math.max(44, controlSize.minimumTouch);

interface IProps {
    musicList: IMusic.IMusicItem[] | null;
    /** Display grouping must not hide sources from editing/export actions. */
    actionMusicList?: IMusic.IMusicItem[];
    canStar?: boolean;
    musicSheet?: IMusic.IMusicSheetItem | null;
    onEdit?: () => void;
}

function ToolbarAction({ name, label, accessibilityLabel = label, color, selected, onPress }: {
    name: IIconName;
    label: string;
    accessibilityLabel?: string;
    color?: string;
    selected?: boolean;
    onPress: () => void;
}) {
    const colors = useColors();
    const foreground = colors.textSecondary ?? colors.text;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={selected === undefined ? undefined : { selected }}
            onPress={onPress}
            style={({ pressed }) => [style.secondaryAction, { opacity: pressed ? 0.7 : 1 }]}>
            <Icon name={name} size={iconSizeConst.light} color={color ?? foreground} />
            <ThemeText fontSize="description" fontWeight="medium" color={foreground} style={style.actionLabel}>{label}</ThemeText>
        </Pressable>
    );
}

export default function PlayAllBar(props: IProps) {
    const route = useRoute();
    const { musicList, canStar, musicSheet, onEdit } = props;
    const actionMusicList = props.actionMusicList ?? musicList;

    const sheetName = musicSheet?.title;
    const sheetId = musicSheet?.id;

    const colors = useColors();
    const navigate = useNavigate();
    const { t } = useI18N();

    const starred = useSheetIsStarred(musicSheet);

    return (
        <View style={style.topWrapper}>
            <Pressable
                style={({ pressed }) => [style.playAll, { opacity: !musicList?.length ? 0.45 : pressed ? 0.7 : 1 }]}
                disabled={!musicList?.length}
                accessibilityRole="button"
                accessibilityLabel={t("playAllBar.title")}
                accessibilityState={{ disabled: !musicList?.length }}
                onPress={() => {
                    if (musicList?.length) {
                        let defaultPlayMusic = musicList[0];
                        if (
                            TrackPlayer.repeatMode ===
                            MusicRepeatMode.SHUFFLE
                        ) {
                            defaultPlayMusic =
                                musicList[
                                    Math.floor(Math.random() * musicList.length)
                                ];
                        }
                        TrackPlayer.playWithReplacePlayList(
                            defaultPlayMusic,
                            musicList,
                            musicSheet ? { sheet: musicSheet, routeName: route.name } : undefined,
                        );
                    }
                }}>
                <RoundActionButton
                    variant="solid"
                    iconName="play"
                    size={buttonHeight.compact}
                    iconSize={iconSizeConst.small}
                />
                <ThemeText fontColor="primary" fontSize="subTitle" fontWeight="semibold" style={style.actionLabel}>{t("playAllBar.title")}</ThemeText>
            </Pressable>
            <View style={style.secondaryActions}>
                {canStar && musicSheet ? (
                    <ToolbarAction
                        name={starred ? "heart" : "heart-outline"}
                        label={t(starred ? "playAllBar.savedAction" : "playAllBar.saveAction")}
                        accessibilityLabel={t(starred ? "playAllBar.unstar" : "playAllBar.star")}
                        color={starred ? colors.favorite : undefined}
                        selected={starred}
                        onPress={async () => {
                            if (!starred) {
                                MusicSheet.starMusicSheet(musicSheet);
                                Toast.success(t("toast.hasStarred"));
                            } else {
                                MusicSheet.unstarMusicSheet(musicSheet);
                                Toast.success(t("toast.hasUnstarred"));
                            }
                        }}
                    />
                ) : null}
                <ToolbarAction
                    name="plus"
                    label={t("musicListEditor.addToSheet")}
                    onPress={async () => {
                        showPanel("AddToMusicSheet", {
                            musicItem: actionMusicList ?? [],
                            newSheetDefaultName: sheetName,
                        });
                    }}
                />
                <ToolbarAction
                    name="pencil-outline"
                    label={t("common.edit")}
                    onPress={async () => {
                        if (onEdit) {
                            onEdit();
                            return;
                        }
                        navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
                            musicList: actionMusicList,
                            musicSheet: {
                                title: sheetName,
                                id: sheetId,
                            },
                        });
                    }}
                />
            </View>
        </View>
    );
}

const style = StyleSheet.create({
    /** playall */
    topWrapper: {
        minHeight: minimumTouch,
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        flexWrap: "wrap",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    playAll: {
        minWidth: minimumTouch,
        minHeight: minimumTouch,
        maxWidth: "100%",
        flexShrink: 0,
        paddingVertical: spacing.xs,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    actionLabel: {
        flexShrink: 1,
    },
    secondaryActions: {
        marginLeft: "auto",
        maxWidth: "100%",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: spacing.xs,
    },
    secondaryAction: {
        minWidth: minimumTouch,
        minHeight: minimumTouch,
        maxWidth: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xs,
        gap: spacing.xxs,
    },
});
