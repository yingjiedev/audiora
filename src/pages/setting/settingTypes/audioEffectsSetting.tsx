import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Slider from "@react-native-community/slider";
import Icon from "@/components/base/icon";
import ThemeSwitch from "@/components/base/switch";
import ThemeText from "@/components/base/themeText";
import { audioEffects, useAudioEffects } from "@/core/audioEffects";
import { editBand, formatFrequency, formatGain, gainAt, PRESET_IDS, presetBands, sameTuning } from "@/core/audioEffects/model";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import EqualizerCurve from "../components/equalizerCurve";
import SettingRow from "../components/settingRow";
import SettingSection from "../components/settingSection";
import { settingsLayout } from "../components/settingsLayout";

const BAND_GROUPS = ["low", "mid", "high"] as const;
type BandGroup = typeof BAND_GROUPS[number];
const bandGroup = (frequency: number): BandGroup => frequency < 250 ? "low" : frequency < 4000 ? "mid" : "high";

export default function AudioEffectsSetting() {
    const state = useAudioEffects();
    const { settings, status } = state;
    const [selectedTab, setTab] = useState<"presets" | "custom" | null>(null);
    const tab = selectedTab ?? (settings.preset === "custom" ? "custom" : "presets");
    const [group, setGroup] = useState<BandGroup>("low");
    const [saving, setSaving] = useState(false);
    const colors = useColors();
    const { t } = useI18N();
    const unavailable = status === "unsupported";
    const switchDisabled = !state.loaded || (unavailable && !settings.enabled);
    const savedSelected = settings.preset === "custom" && sameTuning(settings, settings.savedCustom);
    const disabled = !settings.enabled || status !== "ready" || !state.loaded;
    const statusText = !state.loaded && !unavailable && status !== "error" ? t("audioEffects.loading") : unavailable ? t("audioEffects.unsupported") :
        status === "error" ? t("audioEffects.error") :
            status === "waiting" ? t("audioEffects.waiting") :
                settings.enabled && state.active ? t("audioEffects.active", { count: state.frequencies.length }) :
                    settings.enabled ? t("audioEffects.inactive") : t("audioEffects.off");
    const currentName = settings.preset === "custom" ? t("audioEffects.custom") : t(`audioEffects.preset.${settings.preset}`);
    const visibleFrequencies = state.frequencies.filter(frequency => bandGroup(frequency) === group);
    const deviceBands = state.frequencies.map(frequencyHz => ({
        frequencyHz,
        gainDb: Math.max(state.minimumGain, Math.min(state.maximumGain, gainAt(settings.bands, frequencyHz))),
    }));

    const setBand = (frequency: number, gain: number, persist: boolean) => {
        audioEffects.update(editBand(audioEffects.getSnapshot(), frequency, gain), persist);
    };
    const setPreamp = (preampDb: number, persist: boolean) => {
        audioEffects.update({ ...audioEffects.getSnapshot().settings, preampDb, preset: "custom" }, persist);
    };
    const saveCustom = async () => {
        setSaving(true);
        try {
            const current = audioEffects.getSnapshot().settings;
            const success = await audioEffects.update({ ...current, preset: "custom", savedCustom: { bands: current.bands, preampDb: current.preampDb } });
            if (success) {
                Toast.success(t("audioEffects.saved"));
            } else {
                Toast.warn(t("audioEffects.saveFailed"));
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SettingSection>
                <SettingRow title={t("audioEffects.enabled")} description={statusText} descriptionLines={3}
                    right={(
                        <Pressable accessibilityRole="switch" accessibilityLabel={t("audioEffects.enabled")}
                            style={styles.switch} accessibilityState={{ checked: settings.enabled, disabled: switchDisabled }}
                            disabled={switchDisabled} onPress={() => {
                                audioEffects.update({ ...audioEffects.getSnapshot().settings, enabled: !settings.enabled });
                            }}>
                            <View pointerEvents="none"><ThemeSwitch value={settings.enabled} disabled={switchDisabled} /></View>
                        </Pressable>
                    )} />
                <View style={[styles.summary, { backgroundColor: colors.cardInset }]}>
                    <Icon name="musical-note" size={rpx(32)} color={colors.onCardInset} />
                    <ThemeText color={colors.onCardInset} style={styles.flex}>{currentName}</ThemeText>
                    <ThemeText fontSize="caption" color={colors.onCardInsetSecondary}>{t("audioEffects.musicOnly")}</ThemeText>
                </View>
                {status === "error" || (unavailable && state.loaded) ? (
                    <SettingRow title={t("audioEffects.retry")} onPress={() => {
                        if (state.loaded) {
                            audioEffects.update(audioEffects.getSnapshot().settings);
                        } else {
                            audioEffects.refresh();
                        }
                    }} />
                ) : null}
            </SettingSection>
            {!unavailable && state.loaded ? (
                <>
                    <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: colors.card }]}>
                        {(["presets", "custom"] as const).map(value => (
                            <Pressable key={value} accessibilityRole="tab" accessibilityLabel={t(`audioEffects.${value}`)} accessibilityState={{ selected: tab === value }}
                                onPress={() => setTab(value)} style={[styles.tab, { backgroundColor: tab === value ? colors.primary : colors.card }]}>
                                <ThemeText color={tab === value ? colors.onPrimary : colors.textSecondary} fontWeight="semibold">
                                    {t(`audioEffects.${value}`)}
                                </ThemeText>
                            </Pressable>
                        ))}
                    </View>
                    {tab === "presets" ? (
                        <>
                            <ThemeText fontSize="description" fontColor="textSecondary" style={styles.hint}>{t("audioEffects.previewHint")}</ThemeText>
                            <View style={styles.presets}>
                                {PRESET_IDS.map(preset => {
                                    const selected = settings.preset === preset;
                                    return (
                                        <Pressable key={preset} accessibilityRole="button" accessibilityLabel={t(`audioEffects.preset.${preset}`)}
                                            accessibilityState={{ selected }} onPress={() => {
                                                audioEffects.update({ ...audioEffects.getSnapshot().settings, preset, bands: presetBands(preset), preampDb: 0 });
                                            }} style={[styles.preset, { backgroundColor: colors.card, borderColor: selected ? colors.active : colors.divider }]}>
                                            <View style={styles.readout}>
                                                <ThemeText fontWeight="semibold" fontColor={selected ? "primary" : "text"} style={styles.flex}>
                                                    {t(`audioEffects.preset.${preset}`)}
                                                </ThemeText>
                                                {selected ? <Icon name="check-circle" size={rpx(32)} color={colors.active} /> : null}
                                            </View>
                                            <EqualizerCurve compact bands={presetBands(preset)} />
                                            <ThemeText fontSize="description" fontColor="textSecondary">{t(`audioEffects.presetHint.${preset}`)}</ThemeText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            {settings.savedCustom ? (
                                <SettingSection title={t("audioEffects.savedPreset")}>
                                    <SettingRow title={t("audioEffects.savedPreset")} description={t("audioEffects.savedPresetHint")}
                                        value={savedSelected ? t("audioEffects.selected") : undefined} showChevron onPress={() => {
                                            const current = audioEffects.getSnapshot().settings;
                                            if (current.savedCustom) {
                                                audioEffects.update({ ...current, ...current.savedCustom, preset: "custom" });
                                                setTab("custom");
                                            }
                                        }} />
                                </SettingSection>
                            ) : null}
                            <SettingSection>
                                <SettingRow title={t("audioEffects.custom")} description={t("audioEffects.customHint")} showChevron onPress={() => setTab("custom")} />
                            </SettingSection>
                        </>
                    ) : (
                        <SettingSection title={t("audioEffects.equalizer")} description={t("audioEffects.curveHint")}>
                            <View style={styles.editor}>
                                <View style={styles.readout}>
                                    <ThemeText fontWeight="semibold" style={styles.flex}>{currentName}</ThemeText>
                                    <ThemeText fontSize="caption" fontColor={savedSelected ? "primary" : "textSecondary"}>
                                        {t(savedSelected ? "audioEffects.savedState" : "audioEffects.editingState")}
                                    </ThemeText>
                                </View>
                                <EqualizerCurve bands={deviceBands.length ? deviceBands : settings.bands}
                                    minimumGain={state.minimumGain} maximumGain={state.maximumGain} />
                                <View accessibilityRole="tablist" style={[styles.bandGroups, { backgroundColor: colors.surface }]}>
                                    {BAND_GROUPS.map(value => (
                                        <Pressable key={value} accessibilityRole="tab" accessibilityLabel={t(`audioEffects.range.${value}`)}
                                            accessibilityState={{ selected: group === value }} onPress={() => setGroup(value)}
                                            style={[styles.tab, { backgroundColor: group === value ? colors.primary : colors.surface }]}>
                                            <ThemeText color={group === value ? colors.onPrimary : colors.textSecondary} fontSize="description">
                                                {t(`audioEffects.range.${value}`)}
                                            </ThemeText>
                                        </Pressable>
                                    ))}
                                </View>
                                <ThemeText fontSize="caption" fontColor="textSecondary" style={styles.rangeHint}>{t(`audioEffects.rangeHint.${group}`)}</ThemeText>
                                {visibleFrequencies.map(frequency => {
                                    const gain = deviceBands.find(band => band.frequencyHz === frequency)!.gainDb;
                                    return (
                                        <View key={frequency} style={styles.band}>
                                            <View style={styles.readout}>
                                                <ThemeText>{formatFrequency(frequency)}</ThemeText>
                                                <ThemeText fontSize="description" fontColor="primary">{formatGain(gain)}</ThemeText>
                                            </View>
                                            <Slider accessibilityLabel={t("audioEffects.bandLabel", { frequency: formatFrequency(frequency) })}
                                                disabled={disabled} minimumValue={state.minimumGain} maximumValue={state.maximumGain} step={0.5} value={gain}
                                                minimumTrackTintColor={colors.active} maximumTrackTintColor={colors.textSecondary} thumbTintColor={colors.active}
                                                style={styles.slider} onValueChange={value => setBand(frequency, value, false)}
                                                onSlidingComplete={value => setBand(frequency, value, true)} />
                                        </View>
                                    );
                                })}
                                {state.frequencies.length === 0 || visibleFrequencies.length === 0 ? (
                                    <ThemeText fontSize="description" fontColor="textSecondary" style={styles.rangeHint}>
                                        {t(state.frequencies.length ? "audioEffects.noBands" : "audioEffects.waiting")}
                                    </ThemeText>
                                ) : null}
                                {!settings.enabled ? <ThemeText fontSize="description" fontColor="textSecondary">{t("audioEffects.enableToEdit")}</ThemeText> : null}
                                {state.supportsPreamp ? (
                                    <View style={[styles.preamp, { borderTopColor: colors.divider }]}>
                                        <View style={styles.readout}>
                                            <ThemeText>{t("audioEffects.preamp")}</ThemeText>
                                            <ThemeText fontSize="description" fontColor="primary">{formatGain(settings.preampDb)}</ThemeText>
                                        </View>
                                        <Slider accessibilityLabel={t("audioEffects.preamp")} disabled={disabled}
                                            minimumValue={-12} maximumValue={0} step={0.5} value={settings.preampDb}
                                            minimumTrackTintColor={colors.active} maximumTrackTintColor={colors.textSecondary} thumbTintColor={colors.active}
                                            style={styles.slider} onValueChange={value => setPreamp(value, false)} onSlidingComplete={value => setPreamp(value, true)} />
                                        <ThemeText fontSize="caption" fontColor="textSecondary">{t("audioEffects.preampHint")}</ThemeText>
                                    </View>
                                ) : null}
                                <View style={styles.actions}>
                                    <Pressable accessibilityRole="button" accessibilityLabel={t("audioEffects.reset")} onPress={() => {
                                        audioEffects.update({ ...audioEffects.getSnapshot().settings, preset: "flat", bands: presetBands("flat"), preampDb: 0 });
                                    }} style={[styles.action, { backgroundColor: colors.surface }]}>
                                        <Icon name="arrow-path" size={rpx(28)} color={colors.text} />
                                        <ThemeText fontSize="description">{t("audioEffects.resetShort")}</ThemeText>
                                    </Pressable>
                                    <Pressable accessibilityRole="button" accessibilityLabel={t("audioEffects.saveCustom")}
                                        accessibilityState={{ disabled: saving }} disabled={saving} onPress={saveCustom}
                                        style={[styles.action, styles.flex, { backgroundColor: colors.primary }]}>
                                        <ThemeText fontSize="description" color={colors.onPrimary}>{t("audioEffects.saveCustom")}</ThemeText>
                                    </Pressable>
                                </View>
                                <ThemeText fontSize="caption" fontColor="textSecondary">{t("audioEffects.saveHint")}</ThemeText>
                            </View>
                        </SettingSection>
                    )}
                    <SettingSection>
                        <SettingRow title={t("audioEffects.headroomTitle")} description={t("audioEffects.headroomHint")} descriptionLines={3}
                            right={<Icon name="shield-keyhole-outline" size={rpx(36)} color={colors.textSecondary} />} />
                        {state.supportsLimiter ? <SettingRow title={t("audioEffects.limiter")} value={t("audioEffects.automatic")} /> : null}
                    </SettingSection>
                </>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    switch: { minWidth: rpx(88), minHeight: rpx(88), alignItems: "center", justifyContent: "center" },
    content: { paddingBottom: rpx(60) },
    flex: { flex: 1, minWidth: 0 },
    summary: { flexDirection: "row", alignItems: "center", gap: rpx(12), margin: rpx(20), marginTop: 0, padding: rpx(20), borderRadius: rpx(16) },
    tabs: { flexDirection: "row", margin: settingsLayout.groupMargin, marginBottom: 0, padding: rpx(8), borderRadius: rpx(24) },
    tab: { flex: 1, minHeight: rpx(88), alignItems: "center", justifyContent: "center", borderRadius: rpx(18) },
    hint: { marginHorizontal: settingsLayout.groupMargin, marginTop: rpx(20), marginBottom: rpx(20) },
    presets: { flexDirection: "row", flexWrap: "wrap", gap: rpx(16), marginHorizontal: settingsLayout.groupMargin },
    preset: { width: "47%", flexGrow: 1, padding: rpx(24), borderRadius: settingsLayout.cardRadius, borderWidth: 1.5, gap: rpx(12) },
    readout: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: rpx(12) },
    editor: { padding: settingsLayout.rowPadding, gap: rpx(20) },
    bandGroups: { flexDirection: "row", padding: rpx(6), borderRadius: rpx(22) },
    rangeHint: { paddingVertical: rpx(8) },
    band: { paddingTop: rpx(4) },
    slider: { width: "100%", minHeight: rpx(88) },
    preamp: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: rpx(24) },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: rpx(16), marginTop: rpx(8) },
    action: { minHeight: rpx(88), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: rpx(12), paddingHorizontal: rpx(24), borderRadius: rpx(18) },
});
