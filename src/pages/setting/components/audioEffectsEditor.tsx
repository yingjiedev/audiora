import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Slider from "@react-native-community/slider";
import { PageAction } from "@/components/base/pageSection";
import ThemeText from "@/components/base/themeText";
import { audioEffects } from "@/core/audioEffects";
import { AudioEffectsState, editBand, formatFrequency, formatGain, gainAt, presetBands, sameTuning } from "@/core/audioEffects/model";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import EqualizerCurve from "./equalizerCurve";

const GROUPS = ["low", "mid", "high"] as const;
type BandGroup = typeof GROUPS[number];
const bandGroup = (frequency: number): BandGroup => frequency < 250 ? "low" : frequency < 4000 ? "mid" : "high";

export default function AudioEffectsEditor({ state, title, onCreate, onSave }: {
    state: AudioEffectsState;
    title: string;
    onCreate: () => void;
    onSave: () => Promise<boolean>;
}) {
    const colors = useColors();
    const { t } = useI18N();
    const [group, setGroup] = useState<BandGroup>("low");
    const [saving, setSaving] = useState(false);
    const { settings } = state;
    const activePreset = settings.customPresets.find(entry => entry.id === settings.activeCustomId);
    const unchanged = !!activePreset && sameTuning(settings, activePreset);
    const frequencies = state.frequencies.length ? state.frequencies : presetBands("flat").map(band => band.frequencyHz);
    const bands = frequencies.map(frequencyHz => ({ frequencyHz, gainDb: Math.max(state.minimumGain, Math.min(state.maximumGain, gainAt(settings.bands, frequencyHz))) }));

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.heading}>
                    <View style={styles.flex}>
                        <ThemeText fontSize="title" fontWeight="semibold">{title}</ThemeText>
                        <ThemeText fontSize="description" fontColor="textSecondary" style={styles.subtitle}>
                            {t(unchanged ? "audioEffects.savedState" : "audioEffects.unsavedChanges")}
                        </ThemeText>
                    </View>
                    <PageAction title={t("audioEffects.resetShort")} icon="arrow-path" variant="text" onPress={() => {
                        audioEffects.update({ ...audioEffects.getSnapshot().settings, preset: "custom", bands: presetBands("flat"), preampDb: 0 });
                    }} />
                </View>
                <View style={[styles.plot, { backgroundColor: colors.surface }]}>
                    <EqualizerCurve bands={bands} minimumGain={state.minimumGain} maximumGain={state.maximumGain} />
                </View>
                <View accessibilityRole="tablist" style={styles.groups}>
                    {GROUPS.map(value => (
                        <Pressable key={value} accessibilityRole="tab" accessibilityLabel={t(`audioEffects.range.${value}`)}
                            accessibilityState={{ selected: group === value }} onPress={() => setGroup(value)}
                            style={[styles.group, { backgroundColor: value === group ? colors.primary : colors.surface }]}>
                            <ThemeText fontSize="description" color={group === value ? colors.onPrimary : colors.textSecondary}>
                                {t(`audioEffects.range.${value}`)}
                            </ThemeText>
                        </Pressable>
                    ))}
                </View>
                <ThemeText fontSize="description" fontColor="textSecondary" style={styles.rangeHint}>{t(`audioEffects.rangeHint.${group}`)}</ThemeText>
                {bands.filter(band => bandGroup(band.frequencyHz) === group).map(band => (
                    <View key={band.frequencyHz} style={styles.band}>
                        <View style={styles.heading}>
                            <ThemeText fontWeight="medium">{formatFrequency(band.frequencyHz)}</ThemeText>
                            <ThemeText fontSize="description" fontColor="primary">{formatGain(band.gainDb)}</ThemeText>
                        </View>
                        <Slider accessibilityLabel={t("audioEffects.bandLabel", { frequency: formatFrequency(band.frequencyHz) })}
                            minimumValue={state.minimumGain} maximumValue={state.maximumGain} step={0.5} value={band.gainDb}
                            minimumTrackTintColor={colors.active} maximumTrackTintColor={colors.textSecondary} thumbTintColor={colors.active}
                            style={styles.slider} onValueChange={gain => audioEffects.update(editBand(audioEffects.getSnapshot(), band.frequencyHz, gain), false)}
                            onSlidingComplete={gain => audioEffects.update(editBand(audioEffects.getSnapshot(), band.frequencyHz, gain), true)} />
                    </View>
                ))}
                {!bands.some(band => bandGroup(band.frequencyHz) === group) ? (
                    <ThemeText fontSize="description" fontColor="textSecondary">{t("audioEffects.noBands")}</ThemeText>
                ) : null}
                {state.supportsPreamp ? (
                    <View style={[styles.preamp, { borderTopColor: colors.divider }]}>
                        <View style={styles.heading}>
                            <ThemeText fontWeight="medium">{t("audioEffects.preamp")}</ThemeText>
                            <ThemeText fontSize="description" fontColor="primary">{formatGain(settings.preampDb)}</ThemeText>
                        </View>
                        <Slider accessibilityLabel={t("audioEffects.preamp")} minimumValue={-12} maximumValue={0} step={0.5} value={settings.preampDb}
                            minimumTrackTintColor={colors.active} maximumTrackTintColor={colors.textSecondary} thumbTintColor={colors.active}
                            style={styles.slider} onValueChange={preampDb => audioEffects.update({ ...audioEffects.getSnapshot().settings, preset: "custom", preampDb }, false)}
                            onSlidingComplete={preampDb => audioEffects.update({ ...audioEffects.getSnapshot().settings, preset: "custom", preampDb }, true)} />
                    </View>
                ) : null}
                <ThemeText fontSize="description" fontColor="textSecondary">{t(settings.enabled ? "audioEffects.liveHint" : "audioEffects.offlineEditHint")}</ThemeText>
            </View>
            <View style={styles.actions}>
                {activePreset ? (
                    <PageAction title={t("audioEffects.saveChanges")} variant="primary" size="standard" fullWidth disabled={saving || unchanged}
                        onPress={async () => {
                            setSaving(true);
                            try {
                                await onSave();
                            } finally {
                                setSaving(false);
                            }
                        }} />
                ) : null}
                <PageAction title={t(activePreset ? "audioEffects.saveAsNew" : "audioEffects.createPreset")} icon="plus"
                    variant={activePreset ? "tonal" : "primary"} size="standard" fullWidth onPress={onCreate} />
                <ThemeText fontSize="description" fontColor="textSecondary" style={styles.note}>{t("audioEffects.libraryHint")}</ThemeText>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: { padding: rpx(32), paddingBottom: rpx(48), gap: rpx(24) },
    card: { borderRadius: rpx(32), padding: rpx(28) },
    flex: { flex: 1, minWidth: 0 },
    heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: rpx(12) },
    subtitle: { marginTop: rpx(8) },
    plot: { marginTop: rpx(28), marginBottom: rpx(24), padding: rpx(18), borderRadius: rpx(20) },
    groups: { flexDirection: "row", gap: rpx(12) },
    group: { flex: 1, minHeight: Math.max(44, rpx(88)), alignItems: "center", justifyContent: "center", borderRadius: rpx(18) },
    rangeHint: { marginTop: rpx(20), marginBottom: rpx(24) },
    band: { paddingVertical: rpx(8) },
    slider: { width: "100%", minHeight: Math.max(44, rpx(88)) },
    preamp: { paddingTop: rpx(24), marginTop: rpx(12), marginBottom: rpx(20), borderTopWidth: StyleSheet.hairlineWidth },
    actions: { gap: rpx(16) },
    note: { textAlign: "center", marginTop: rpx(4) },
});
