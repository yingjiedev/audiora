import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import PlayList from "@/components/panels/types/playList";
import { playbackPaneTabStore, PlaybackPaneTab } from "@/core/homeNavigation";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import { PlayerOrientationContext } from "@/hooks/usePlayerOrientation";
import Lyric from "@/pages/musicDetail/components/content/lyric";

/** Non-modal supporting content; playback and list actions use the existing stores. */
export default function PlaybackPane(props: { onClose?: () => void; active?: boolean }) {
    const tab = playbackPaneTabStore.useValue();
    const colors = useColors();
    const { t } = useI18N();
    return (
        <View testID="playback-pane" style={[styles.root, { backgroundColor: colors.surface }]}>
            <View style={styles.header}>
                <View accessibilityRole="tablist" style={styles.tabs}>
                    {(["lyric", "queue"] as PlaybackPaneTab[]).map(name => (
                        <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: tab === name }} accessibilityLabel={t(`adaptive.${name}`)}
                            onPress={() => playbackPaneTabStore.setValue(name)} style={styles.tab}>
                            <ThemeText fontWeight={tab === name ? "bold" : "regular"} color={tab === name ? colors.active : colors.textSecondary}>{t(`adaptive.${name}`)}</ThemeText>
                        </Pressable>
                    ))}
                </View>
                {props.onClose ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={t("adaptive.closePane")} onPress={props.onClose} style={styles.close}>
                        <Icon name="x-mark" size={22} color={colors.textSecondary} />
                    </Pressable>
                ) : null}
            </View>
            {props.active !== false ? (
                <View style={[styles.body, tab === "lyric" && { backgroundColor: colors.onMediaScrim }]}>
                    {tab === "queue" ? <PlayList embedded /> : (
                        <PlayerOrientationContext.Provider value="horizontal"><Lyric isActive /></PlayerOrientationContext.Provider>
                    )}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, minHeight: 0 },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, minHeight: 56 },
    tabs: { flex: 1, flexDirection: "row" },
    tab: { minHeight: 48, minWidth: 72, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
    close: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
    body: { flex: 1, minHeight: 0 },
});
