import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Slider from "@react-native-community/slider";
import ThemeSwitch from "@/components/base/switch";
import ThemeText from "@/components/base/themeText";
import { audioEffects, useAudioEffects } from "@/core/audioEffects";
import { editBand, formatFrequency, formatGain, gainAt, PRESET_IDS, presetBands, sameTuning } from "@/core/audioEffects/model";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import SettingRow from "../components/settingRow";
import SettingSection from "../components/settingSection";
import { settingsLayout } from "../components/settingsLayout";

export default function AudioEffectsSetting() {
    const state = useAudioEffects();
    const { settings, status } = state;
    const colors = useColors();
    const { t } = useI18N();
    const unavailable = status === "unsupported";
    const switchDisabled = !state.loaded || (unavailable && !settings.enabled);
    const savedSelected = settings.preset === "custom" && sameTuning(settings, settings.savedCustom);
    const disabled = !settings.enabled || status !== "ready" || !state.loaded;
    const statusText = !state.loaded && !unavailable && status !== "error" ? t("audioEffects.loading") : unavailable ? t("audioEffects.unsupported") :
        status === "error" ? t("audioEffects.error") :
            status === "waiting" ? t("audioEffects.waiting") :
                settings.enabled ? t("audioEffects.active", { count: state.frequencies.length }) : t("audioEffects.off");

    const setEnabled = (enabled: boolean) => audioEffects.update({ ...audioEffects.getSnapshot().settings, enabled });
    const setBand = (frequency: number, gain: number, persist: boolean) => {
        audioEffects.update(editBand(audioEffects.getSnapshot(), frequency, gain), persist);
    };
    const setPreamp = (preampDb: number, persist: boolean) => {
        audioEffects.update({ ...audioEffects.getSnapshot().settings, preampDb, preset: "custom" }, persist);
    };

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <SettingSection>
                <SettingRow
                    title={t("audioEffects.enabled")}
                    description={statusText}
                    descriptionLines={3}
                    right={(
                        <Pressable accessibilityRole="switch" accessibilityLabel={t("audioEffects.enabled")}
                            style={styles.switch}
                            accessibilityState={{ checked: settings.enabled, disabled: switchDisabled }}
                            disabled={switchDisabled} onPress={() => {
                                setEnabled(!settings.enabled);
                            }}>
                            <View pointerEvents="none">
                                <ThemeSwitch value={settings.enabled} disabled={switchDisabled} />
                            </View>
                        </Pressable>
                    )}
                />
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
                    <SettingSection title={t("audioEffects.presets")} description={t("audioEffects.previewHint")}>
                        <View style={styles.presets}>
                            {PRESET_IDS.map(preset => (
                                <Pressable key={preset}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: settings.preset === preset }}
                                    onPress={() => audioEffects.update({ ...audioEffects.getSnapshot().settings, preset, bands: presetBands(preset), preampDb: 0 })}
                                    style={[styles.preset, {
                                        backgroundColor: settings.preset === preset ? colors.primary : colors.surface,
                                    }]}>
                                    <ThemeText color={settings.preset === preset ? colors.onPrimary : colors.text}>
                                        {t(`audioEffects.preset.${preset}`)}
                                    </ThemeText>
                                </Pressable>
                            ))}
                            {settings.savedCustom ? (
                                <Pressable accessibilityRole="button" accessibilityState={{ selected: savedSelected }} onPress={() => {
                                    const current = audioEffects.getSnapshot().settings;
                                    if (current.savedCustom) {
                                        audioEffects.update({ ...current, ...current.savedCustom, preset: "custom" });
                                    }
                                }} style={[styles.preset, { backgroundColor: savedSelected ? colors.primary : colors.surface }]}>
                                    <ThemeText color={savedSelected ? colors.onPrimary : colors.text}>{t("audioEffects.savedPreset")}</ThemeText>
                                </Pressable>
                            ) : null}
                        </View>
                    </SettingSection>
                    <SettingSection title={t("audioEffects.equalizer")} description={t("audioEffects.headroomHint")}>
                        {state.frequencies.map(frequency => (
                            <View key={frequency} style={styles.band}>
                                <View style={styles.readout}>
                                    <ThemeText>{formatFrequency(frequency)}</ThemeText>
                                    <ThemeText fontColor="textSecondary">
                                        {formatGain(Math.max(state.minimumGain, Math.min(state.maximumGain, gainAt(settings.bands, frequency))))}
                                    </ThemeText>
                                </View>
                                <Slider accessibilityLabel={t("audioEffects.bandLabel", { frequency: formatFrequency(frequency) })}
                                    disabled={disabled}
                                    minimumValue={state.minimumGain} maximumValue={state.maximumGain} step={0.5}
                                    value={Math.max(state.minimumGain, Math.min(state.maximumGain, gainAt(settings.bands, frequency)))}
                                    minimumTrackTintColor={colors.active} maximumTrackTintColor={colors.textSecondary} thumbTintColor={colors.active}
                                    onValueChange={value => setBand(frequency, value, false)}
                                    onSlidingComplete={value => setBand(frequency, value, true)}
                                />
                            </View>
                        ))}
                        {state.frequencies.length === 0 ? <SettingRow title={t("audioEffects.waiting")} /> : null}
                        <SettingRow title={t("audioEffects.reset")} onPress={() => {
                            audioEffects.update({ ...audioEffects.getSnapshot().settings, preset: "flat", bands: presetBands("flat"), preampDb: 0 });
                        }} />
                        <SettingRow title={t("audioEffects.saveCustom")} description={t("audioEffects.saveHint")} onPress={async () => {
                            const current = audioEffects.getSnapshot().settings;
                            const success = await audioEffects.update({ ...current, preset: "custom", savedCustom: { bands: current.bands, preampDb: current.preampDb } });
                            if (success) {
                                Toast.success(t("audioEffects.saved"));
                            }
                        }} />
                    </SettingSection>
                    {state.supportsPreamp ? (
                        <SettingSection title={t("audioEffects.preamp")} description={t("audioEffects.preampHint")}>
                            <View style={styles.band}>
                                <ThemeText fontColor="textSecondary">{formatGain(settings.preampDb)}</ThemeText>
                                <Slider accessibilityLabel={t("audioEffects.preamp")} disabled={disabled}
                                    minimumValue={-12} maximumValue={0} step={0.5} value={settings.preampDb}
                                    minimumTrackTintColor={colors.active} maximumTrackTintColor={colors.textSecondary} thumbTintColor={colors.active}
                                    onValueChange={value => setPreamp(value, false)} onSlidingComplete={value => setPreamp(value, true)} />
                            </View>
                            <SettingRow title={t("audioEffects.limiter")} value={t("audioEffects.automatic")} />
                        </SettingSection>
                    ) : null}
                </>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    switch: { minWidth: rpx(88), minHeight: rpx(88), alignItems: "center", justifyContent: "center" },
    content: { paddingBottom: rpx(60) },
    presets: { flexDirection: "row", flexWrap: "wrap", padding: settingsLayout.rowPadding, gap: rpx(16) },
    preset: { paddingHorizontal: rpx(24), minHeight: rpx(88), justifyContent: "center", borderRadius: rpx(18) },
    band: { paddingHorizontal: settingsLayout.rowPadding, paddingVertical: rpx(10) },
    readout: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: rpx(12) },
});
