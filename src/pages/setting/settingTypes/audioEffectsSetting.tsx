import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppBar from "@/components/base/appBar";
import Icon from "@/components/base/icon";
import { PageAction } from "@/components/base/pageSection";
import ThemeSwitch from "@/components/base/switch";
import ThemeText from "@/components/base/themeText";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { audioEffects, useAudioEffects } from "@/core/audioEffects";
import {
    applyUserPreset, AudioEffectsSettings, AudioEffectsUserPreset, AudioPresetError, createUserPreset, deleteUserPreset,
    LEGACY_CUSTOM_PRESET_ID, MAX_CUSTOM_PRESETS, MAX_PRESET_NAME_LENGTH, PRESET_IDS, presetBands, renameUserPreset, saveUserPreset,
} from "@/core/audioEffects/model";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import { nanoid } from "@/utils/nanoid";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import AudioEffectsEditor from "../components/audioEffectsEditor";
import EqualizerCurve from "../components/equalizerCurve";

const illustrations = {
    stage: require("@/assets/images/audioEffects/stage.png"),
    bass: require("@/assets/images/audioEffects/bass.png"),
    vocal: require("@/assets/images/audioEffects/vocal.png"),
    record: require("@/assets/images/audioEffects/record.png"),
};

export default function AudioEffectsSetting() {
    const state = useAudioEffects();
    const { settings, status } = state;
    const [editing, setEditing] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [switchBarHeight, setSwitchBarHeight] = useState(Math.max(44, rpx(88)) + rpx(24));
    const colors = useColors();
    const { t } = useI18N();
    const { width } = useWindowDimensions();
    const unavailable = status === "unsupported";
    const canConfigure = state.loaded && !unavailable;
    const presetName = (preset: AudioEffectsUserPreset) => preset.id === LEGACY_CUSTOM_PRESET_ID && preset.name === "My preset" ? t("audioEffects.savedPreset") : preset.name;
    const activePreset = settings.customPresets.find(preset => preset.id === settings.activeCustomId);
    const currentName = settings.preset === "custom" ? activePreset ? presetName(activePreset) : t("audioEffects.custom") : t(`audioEffects.preset.${settings.preset}`);
    const statusText = !state.loaded && !unavailable && status !== "error" ? t("audioEffects.loading") : unavailable ? t("audioEffects.unsupported") :
        status === "error" ? t("audioEffects.error") : !settings.enabled ? t("audioEffects.off") :
            state.active ? t("audioEffects.active", { count: state.frequencies.length }) : t("audioEffects.waiting");

    const commit = async (next: AudioEffectsSettings): Promise<boolean> => {
        if (await audioEffects.update(next)) return true;
        Toast.warn(t("audioEffects.saveFailed"));
        await audioEffects.refresh();
        return false;
    };

    const namePreset = (existing?: AudioEffectsUserPreset) => {
        if (!existing && audioEffects.getSnapshot().settings.customPresets.length >= MAX_CUSTOM_PRESETS) {
            Toast.warn(t("audioEffects.presetLimit"));
            return;
        }
        let number = 1;
        const names = new Set(audioEffects.getSnapshot().settings.customPresets.map(preset => preset.name.toLowerCase()));
        while (names.has(t("audioEffects.defaultPresetName", { number }).toLowerCase())) number += 1;
        let submitting = false;
        showPanel("SimpleInput", {
            title: t(existing ? "audioEffects.renamePreset" : "audioEffects.createPreset"),
            placeholder: t("audioEffects.presetNamePlaceholder"),
            defaultValue: existing ? presetName(existing) : t("audioEffects.defaultPresetName", { number }),
            maxLength: MAX_PRESET_NAME_LENGTH,
            hints: [t(existing ? "audioEffects.renameHint" : "audioEffects.createHint")],
            async onOk(text, closePanel) {
                if (submitting) return;
                submitting = true;
                try {
                    const current = audioEffects.getSnapshot().settings;
                    const next = existing ? renameUserPreset(current, existing.id, text) : createUserPreset(current, nanoid(), text);
                    if (await commit(next)) {
                        closePanel();
                        if (!existing) setEditing(true);
                        Toast.success(t(existing ? "audioEffects.renamed" : "audioEffects.created"));
                    }
                } catch (error) {
                    Toast.warn(t(error instanceof AudioPresetError ? `audioEffects.${error.reason}` : "audioEffects.saveFailed"));
                } finally {
                    submitting = false;
                }
            },
        });
    };

    const removePreset = (preset: AudioEffectsUserPreset) => showDialog("SimpleDialog", {
        title: t("audioEffects.deletePreset"),
        content: t("audioEffects.deletePresetHint", { name: presetName(preset) }),
        async onOk() {
            if (await commit(deleteUserPreset(audioEffects.getSnapshot().settings, preset.id))) Toast.success(t("audioEffects.deleted"));
        },
    });

    const heading = (title: string, action?: React.ReactNode) => (
        <View style={styles.heading}>
            <ThemeText fontSize="title" fontWeight="semibold" style={styles.flex}>{title}</ThemeText>
            {action}
        </View>
    );

    return (
        <View style={styles.viewport}>
            <AppBar onBackPress={editing ? () => setEditing(false) : undefined}
                actionComponent={canConfigure ? <PageAction title={t("audioEffects.createPreset")} icon="plus" variant="text" onPress={() => namePreset()} /> : undefined}>
                {t(editing ? "audioEffects.equalizer" : "audioEffects.title")}
            </AppBar>
            <View style={styles.viewport}>
                <View style={[styles.viewport, { marginBottom: switchBarHeight }]}>
                    {editing && canConfigure ? (
                        <AudioEffectsEditor state={state} title={currentName} onCreate={() => namePreset()} onSave={async () => {
                            const current = audioEffects.getSnapshot().settings;
                            if (!current.activeCustomId) return false;
                            try {
                                const success = await commit(saveUserPreset(current, current.activeCustomId));
                                if (success) Toast.success(t("audioEffects.saved"));
                                return success;
                            } catch {
                                Toast.warn(t("audioEffects.saveFailed"));
                                return false;
                            }
                        }} />
                    ) : (
                        <ScrollView style={styles.viewport} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                            {heading(t("audioEffects.featured"))}
                            <View testID="audio-effects-hero" style={[styles.hero, { backgroundColor: colors.card }]}>
                                <View style={[styles.heroArt, { backgroundColor: colors.cardInset }]}>
                                    <View style={[styles.heroBadge, { backgroundColor: colors.card }]}>
                                        <Icon name="musical-note" size={rpx(24)} color={colors.primaryText} />
                                        <ThemeText fontSize="tag" fontColor="primary">{t("audioEffects.heroTag")}</ThemeText>
                                    </View>
                                    <Image source={illustrations.stage} resizeMode="contain" accessible={false} style={styles.heroImage} />
                                </View>
                                <View style={styles.heroCopy}>
                                    <ThemeText fontSize="section" fontWeight="semibold">{currentName}</ThemeText>
                                    <ThemeText fontSize="description" fontColor="textSecondary" style={styles.heroDescription}>{t("audioEffects.heroHint")}</ThemeText>
                                    <PageAction title={t("audioEffects.custom")} icon="pencil-square" variant="primary" size="standard"
                                        disabled={!canConfigure} onPress={() => setEditing(true)} />
                                </View>
                            </View>
                            {canConfigure ? (
                                <>
                                    {heading(t("audioEffects.presets"), <ThemeText fontSize="description" fontColor="textSecondary">{t("audioEffects.presetCount", { count: PRESET_IDS.length })}</ThemeText>)}
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}
                                        decelerationRate="fast" snapToInterval={Math.min(width * 0.29, 152) + rpx(20)}>
                                        {PRESET_IDS.map(preset => {
                                            const selected = settings.preset === preset;
                                            const art = preset === "vocal" || preset === "bright" ? illustrations.vocal : preset === "bass" || preset === "electronic" || preset === "rock" ? illustrations.bass : illustrations.record;
                                            return (
                                                <Pressable key={preset} accessibilityRole="button" accessibilityLabel={t(`audioEffects.preset.${preset}`)}
                                                    accessibilityState={{ selected }} onPress={() => commit({ ...audioEffects.getSnapshot().settings, enabled: true, preset, activeCustomId: null, bands: presetBands(preset), preampDb: 0 })}
                                                    style={[styles.presetCard, { width: Math.min(width * 0.29, 152), backgroundColor: colors.card, borderColor: selected ? colors.active : colors.card }]}>
                                                    <Image source={art} resizeMode="contain" accessible={false} style={styles.presetArt} />
                                                    <ThemeText fontSize="subTitle" fontWeight="semibold" style={styles.center}>{t(`audioEffects.preset.${preset}`)}</ThemeText>
                                                    <ThemeText fontSize="description" fontColor="textSecondary" style={styles.presetHint}>{t(`audioEffects.presetHint.${preset}`)}</ThemeText>
                                                    <View style={[styles.usePill, { backgroundColor: selected && settings.enabled ? colors.primary : colors.tonalSurface }]}>
                                                        {selected && settings.enabled ? <Icon name="check" color={colors.onPrimary} size={rpx(24)} /> : null}
                                                        <ThemeText fontSize="description" color={selected && settings.enabled ? colors.onPrimary : colors.onTonal}>{t(selected && settings.enabled ? "audioEffects.inUse" : "audioEffects.applyPreset")}</ThemeText>
                                                    </View>
                                                </Pressable>
                                            );
                                        })}
                                    </ScrollView>
                                    {heading(t("audioEffects.myPresets"), <PageAction title={t("audioEffects.createPreset")} icon="plus" variant="text" onPress={() => namePreset()} />)}
                                    {settings.customPresets.length ? (
                                        <View style={styles.library}>
                                            {(showAll ? settings.customPresets : settings.customPresets.slice(0, 4)).map(preset => (
                                                <View key={preset.id} style={[styles.userCard, { width: (width - rpx(84)) / 2, backgroundColor: colors.card }]}>
                                                    <Pressable accessibilityRole="button" accessibilityLabel={t("audioEffects.applyNamedPreset", { name: presetName(preset) })}
                                                        accessibilityState={{ selected: settings.activeCustomId === preset.id }} style={styles.userBody}
                                                        onPress={() => commit({ ...applyUserPreset(audioEffects.getSnapshot().settings, preset.id), enabled: true })}>
                                                        <ThemeText fontWeight="semibold" numberOfLines={2}>{presetName(preset)}</ThemeText>
                                                        <EqualizerCurve compact bands={preset.bands} />
                                                        <View style={styles.userStatus}>
                                                            <ThemeText fontSize="description" fontColor={settings.activeCustomId === preset.id ? "primary" : "textSecondary"}>
                                                                {t(settings.activeCustomId === preset.id ? "audioEffects.selected" : "audioEffects.applyPreset")}
                                                            </ThemeText>
                                                            <Icon name="chevron-right" size={rpx(24)} color={colors.textSecondary} />
                                                        </View>
                                                    </Pressable>
                                                    <View style={[styles.userActions, { borderTopColor: colors.divider }]}>
                                                        <PageAction title={t("audioEffects.renamePreset")} variant="text" onPress={() => namePreset(preset)} />
                                                        <Pressable accessibilityRole="button" accessibilityLabel={t("audioEffects.deleteNamedPreset", { name: presetName(preset) })}
                                                            style={styles.iconButton} onPress={() => removePreset(preset)}><Icon name="trash-outline" size={rpx(30)} color={colors.danger} /></Pressable>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <Pressable accessibilityRole="button" accessibilityLabel={t("audioEffects.createFirstPreset")} onPress={() => namePreset()}
                                            style={[styles.emptyLibrary, { backgroundColor: colors.card }]}>
                                            <Image source={illustrations.record} resizeMode="contain" accessible={false} style={styles.emptyArt} />
                                            <View style={styles.flex}>
                                                <ThemeText fontSize="subTitle" fontWeight="semibold">{t("audioEffects.createFirstPreset")}</ThemeText>
                                                <ThemeText fontSize="description" fontColor="textSecondary" style={styles.heroDescription}>{t("audioEffects.createHint")}</ThemeText>
                                                <View style={styles.emptyAction}><Icon name="plus" size={rpx(28)} color={colors.primaryText} /><ThemeText fontSize="description" fontColor="primary">{t("audioEffects.createPreset")}</ThemeText></View>
                                            </View>
                                        </Pressable>
                                    )}
                                    {settings.customPresets.length > 4 ? <PageAction title={t(showAll ? "audioEffects.showLess" : "audioEffects.showAll")} variant="text" onPress={() => setShowAll(!showAll)} /> : null}
                                    <View style={[styles.editEntry, { backgroundColor: colors.card }]}>
                                        <View style={[styles.editIcon, { backgroundColor: colors.tonalSurface }]}><Icon name="pencil-square" size={rpx(40)} color={colors.onTonal} /></View>
                                        <View style={styles.flex}><ThemeText fontWeight="semibold">{t("audioEffects.equalizer")}</ThemeText><ThemeText fontSize="description" fontColor="textSecondary" style={styles.heroDescription}>{t("audioEffects.customHint")}</ThemeText></View>
                                        <PageAction title={t("audioEffects.editSound")} variant="tonal" onPress={() => setEditing(true)} />
                                    </View>
                                    <ThemeText fontSize="description" fontColor="textSecondary" style={styles.note}>{t("audioEffects.libraryHint")}</ThemeText>
                                </>
                            ) : <ThemeText fontSize="description" fontColor="textSecondary" style={styles.note}>{statusText}</ThemeText>}
                            {status === "error" || unavailable && state.loaded ? <PageAction title={t("audioEffects.retry")} variant="text" onPress={() => {
                                if (state.loaded) audioEffects.update(audioEffects.getSnapshot().settings);
                                else audioEffects.refresh();
                            }} /> : null}
                        </ScrollView>
                    )}
                </View>
                <SafeAreaView edges={["bottom"]} testID="audio-effects-switch-bar" onLayout={event => setSwitchBarHeight(event.nativeEvent.layout.height)}
                    style={[styles.switchBar, { backgroundColor: colors.card }]}>
                    <View style={styles.flex}>
                        <ThemeText fontWeight="medium">{t("audioEffects.enabled")}</ThemeText>
                        <ThemeText fontSize="description" fontColor="textSecondary" numberOfLines={2} style={styles.status}>{statusText}</ThemeText>
                    </View>
                    <Pressable accessibilityRole="switch" accessibilityLabel={t("audioEffects.enabled")} accessibilityState={{ checked: settings.enabled, disabled: !state.loaded || unavailable && !settings.enabled }}
                        disabled={!state.loaded || unavailable && !settings.enabled} style={styles.iconButton} onPress={() => commit({ ...audioEffects.getSnapshot().settings, enabled: !settings.enabled })}>
                        <View pointerEvents="none"><ThemeSwitch value={settings.enabled} disabled={!state.loaded || unavailable && !settings.enabled} /></View>
                    </Pressable>
                </SafeAreaView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    viewport: { flex: 1, minHeight: 0 },
    content: { paddingTop: rpx(4), paddingBottom: rpx(28) },
    heading: { flexDirection: "row", alignItems: "center", gap: rpx(12), paddingHorizontal: rpx(32), marginTop: rpx(20), marginBottom: rpx(20), minHeight: rpx(56) },
    hero: { marginHorizontal: rpx(32), borderRadius: rpx(36), overflow: "hidden" },
    heroArt: { height: rpx(220), alignItems: "center", justifyContent: "center" },
    heroImage: { width: "85%", height: "100%" },
    heroBadge: { position: "absolute", left: rpx(22), top: rpx(20), flexDirection: "row", alignItems: "center", gap: rpx(8), paddingHorizontal: rpx(14), paddingVertical: rpx(8), borderRadius: rpx(18), zIndex: 1 },
    heroCopy: { padding: rpx(18), alignItems: "center", gap: rpx(4) },
    heroDescription: { marginTop: rpx(6), marginBottom: rpx(12) },
    rail: { paddingHorizontal: rpx(32), gap: rpx(20), paddingBottom: rpx(8) },
    presetCard: { borderRadius: rpx(28), padding: rpx(16), alignItems: "center", borderWidth: 1.5 },
    presetArt: { width: "100%", height: rpx(112) },
    center: { textAlign: "center" },
    presetHint: { textAlign: "center", minHeight: rpx(40), marginTop: rpx(6), marginBottom: rpx(10) },
    usePill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: rpx(6), paddingHorizontal: rpx(20), minHeight: rpx(56), borderRadius: rpx(44) },
    library: { flexDirection: "row", flexWrap: "wrap", gap: rpx(20), marginHorizontal: rpx(32) },
    userCard: { borderRadius: rpx(28), overflow: "hidden" },
    userBody: { padding: rpx(24), gap: rpx(14), minHeight: rpx(200) },
    userStatus: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    userActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: rpx(16), borderTopWidth: StyleSheet.hairlineWidth },
    iconButton: { minWidth: Math.max(44, rpx(88)), minHeight: Math.max(44, rpx(88)), alignItems: "center", justifyContent: "center" },
    emptyLibrary: { marginHorizontal: rpx(32), borderRadius: rpx(28), padding: rpx(24), flexDirection: "row", alignItems: "center", gap: rpx(20) },
    emptyArt: { width: rpx(164), height: rpx(164) },
    emptyAction: { flexDirection: "row", alignItems: "center", gap: rpx(8), minHeight: Math.max(44, rpx(88)) },
    editEntry: { marginHorizontal: rpx(32), marginTop: rpx(28), borderRadius: rpx(28), flexDirection: "row", alignItems: "center", padding: rpx(24), gap: rpx(20) },
    editIcon: { width: rpx(84), height: rpx(84), alignItems: "center", justifyContent: "center", borderRadius: rpx(24) },
    note: { paddingHorizontal: rpx(40), marginTop: rpx(24) },
    switchBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: rpx(32), paddingVertical: rpx(12), gap: rpx(24), borderTopLeftRadius: rpx(28), borderTopRightRadius: rpx(28) },
    status: { marginTop: rpx(6) },
});
