import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { CircularProgressBase } from "react-native-circular-progress-indicator";
import rpx, { fontRpx } from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import ThemeSwitch from "@/components/base/switch";
import useColors from "@/hooks/useColors";
import {
    setCloseAfterPlayEnd,
    setScheduleClose,
    useCloseAfterPlayEnd,
    useScheduleCloseCountDown,
} from "@/utils/scheduleClose";
import PanelBase from "../base/panelBase";
import { hidePanel } from "../usePanel";
import { useI18N } from "@/core/i18n";
import { showDialog } from "@/components/dialogs/useDialog";

const shortCutTimes = [10, 20, 30, 45, 60] as const;

export default function TimingClose() {
    const closeAfterPlay = useCloseAfterPlayEnd();
    const countDown = useScheduleCloseCountDown();
    const colors = useColors();
    const { t } = useI18N();
    const [selectedMinutes, setSelectedMinutes] = useState(30);

    const isCountingDown = countDown !== null;
    const activeMinutes = isCountingDown
        ? Math.max(1, Math.ceil(countDown / 60))
        : selectedMinutes;
    const isCustomTime = !shortCutTimes.includes(selectedMinutes as typeof shortCutTimes[number]);
    const activeStroke = colors.accentCool ?? colors.primary;

    const startSchedule = () => {
        setScheduleClose(Date.now() + selectedMinutes * 60000);
        hidePanel();
    };

    const chooseCustomTime = () => {
        showDialog("SetScheduleCloseTimeDialog", {
            onOk: (minutes: number) => {
                setSelectedMinutes(minutes);
            },
        });
    };

    const cancelSchedule = () => {
        setScheduleClose(null);
        hidePanel();
    };

    return (
        <PanelBase
            keyboardAvoidBehavior="none"
            positionMethod="top"
            height={rpx(680)}
            renderBody={() => (
                <View style={[styles.sheet, { backgroundColor: colors.backdrop }]}>
                    <LinearGradient
                        colors={[activeStroke, colors.primary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.handle}
                    />

                    <ThemeText style={styles.title} fontWeight="bold">
                        {t("sidebar.scheduleClose")}
                    </ThemeText>

                    <View style={styles.dialArea}>
                        <Icon
                            name="clock-outline"
                            size={rpx(42)}
                            color={colors.textSecondary}
                            style={styles.sleepIcon}
                        />
                        <CircularProgressBase
                            activeStrokeColor={activeStroke}
                            activeStrokeSecondaryColor={colors.primary}
                            activeStrokeWidth={rpx(7)}
                            clockwise
                            dashedStrokeConfig={{ count: 56, width: rpx(2) }}
                            duration={180}
                            inActiveStrokeColor={colors.border}
                            inActiveStrokeOpacity={0.72}
                            inActiveStrokeWidth={rpx(2)}
                            maxValue={60}
                            radius={rpx(92)}
                            rotation={-138}
                            strokeLinecap="round"
                            value={Math.min(activeMinutes, 60)}>
                            <View
                                style={[
                                    styles.dialCenter,
                                    { backgroundColor: colors.backdrop },
                                ]}>
                                <ThemeText style={styles.activeTime} fontWeight="bold">
                                    {activeMinutes}
                                </ThemeText>
                                <ThemeText style={styles.minuteLabel} fontColor="textSecondary">
                                    {t("dialog.setScheduleCloseTime.unit")}
                                </ThemeText>
                            </View>
                        </CircularProgressBase>
                        <View style={[styles.dialKnob, { backgroundColor: activeStroke }]} />
                        <Icon
                            name="power-outline"
                            size={rpx(42)}
                            color={colors.textSecondary}
                            style={styles.wakeIcon}
                        />
                    </View>

                    <View style={styles.timeOptions}>
                        {shortCutTimes.map(time => {
                            const isSelected = time === selectedMinutes;

                            return (
                                <TouchableOpacity
                                    key={time}
                                    activeOpacity={0.76}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: isSelected }}
                                    accessibilityLabel={`${time}${t("dialog.setScheduleCloseTime.unit")}`}
                                    onPress={() => setSelectedMinutes(time)}
                                    style={styles.timeOptionTouch}>
                                    {isSelected ? (
                                        <LinearGradient
                                            colors={[activeStroke, colors.primary]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.timeOptionSelected}>
                                            <ThemeText style={styles.timeOptionText} color="#FFFFFF" fontWeight="semibold">
                                                {time} {t("dialog.setScheduleCloseTime.unit")}
                                            </ThemeText>
                                        </LinearGradient>
                                    ) : (
                                        <View
                                            style={[
                                                styles.timeOption,
                                                { backgroundColor: colors.surfaceElevated },
                                            ]}>
                                            <ThemeText style={styles.timeOptionText} fontColor="textSecondary" fontWeight="medium">
                                                {time} {t("dialog.setScheduleCloseTime.unit")}
                                            </ThemeText>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                        <TouchableOpacity
                            activeOpacity={0.76}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isCustomTime }}
                            accessibilityLabel={t("panel.timingClose.customize")}
                            onPress={chooseCustomTime}
                            style={styles.customTimeTouch}>
                            <View
                                style={[
                                    styles.customTimeOption,
                                    {
                                        borderColor: isCustomTime ? activeStroke : colors.border,
                                        backgroundColor: isCustomTime ? activeStroke : colors.surfaceElevated,
                                    },
                                ]}>
                                <ThemeText
                                    style={styles.timeOptionText}
                                    color={isCustomTime ? "#FFFFFF" : colors.primary}
                                    fontWeight="medium">
                                    {t("panel.timingClose.customize")}
                                </ThemeText>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.closeAfterSection}>
                        <View
                            style={[
                                styles.closeAfterPlayRow,
                                {
                                    backgroundColor: colors.surfaceElevated,
                                    borderColor: colors.border,
                                },
                            ]}>
                            <ThemeText style={styles.closeAfterPlayText} fontWeight="semibold">
                                {t("panel.timingClose.closeAfterPlay")}
                            </ThemeText>
                            <ThemeSwitch
                                value={closeAfterPlay}
                                onValueChange={setCloseAfterPlayEnd}
                            />
                        </View>
                        <ThemeText style={styles.closeAfterHint} fontColor="textSecondary">
                            {t("panel.timingClose.closeAfterPlayHint")}
                        </ThemeText>
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={isCountingDown
                            ? t("panel.timingClose.cancelScheduleClose")
                            : t("panel.timingClose.start")}
                        onPress={isCountingDown ? cancelSchedule : startSchedule}
                        style={styles.primaryActionTouch}>
                        <LinearGradient
                            colors={[activeStroke, colors.primary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.primaryAction}>
                            <ThemeText color="#FFFFFF" fontWeight="semibold">
                                {isCountingDown
                                    ? t("panel.timingClose.cancelScheduleClose")
                                    : t("panel.timingClose.start")}
                            </ThemeText>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    sheet: {
        flex: 1,
        paddingHorizontal: rpx(30),
        paddingTop: rpx(18),
        paddingBottom: rpx(30),
    },
    handle: {
        alignSelf: "center",
        borderRadius: rpx(8),
        height: rpx(8),
        width: rpx(60),
    },
    title: {
        alignSelf: "center",
        fontSize: fontRpx(30),
        lineHeight: fontRpx(42),
        marginTop: rpx(22),
    },
    dialArea: {
        alignItems: "center",
        flexDirection: "row",
        height: rpx(218),
        justifyContent: "center",
        marginTop: rpx(6),
    },
    dialCenter: {
        alignItems: "center",
        borderRadius: rpx(76),
        height: rpx(152),
        justifyContent: "center",
        width: rpx(152),
    },
    activeTime: {
        fontSize: fontRpx(56),
        lineHeight: fontRpx(66),
    },
    minuteLabel: {
        fontSize: fontRpx(20),
        marginTop: rpx(-2),
    },
    sleepIcon: {
        marginRight: rpx(22),
        opacity: 0.48,
    },
    wakeIcon: {
        marginLeft: rpx(22),
        opacity: 0.48,
    },
    dialKnob: {
        borderColor: "#FFFFFF",
        borderRadius: rpx(13),
        borderWidth: rpx(3),
        height: rpx(26),
        left: "50%",
        marginLeft: rpx(-13),
        position: "absolute",
        top: rpx(10),
        width: rpx(26),
    },
    timeOptions: {
        flexDirection: "row",
        gap: rpx(8),
        marginTop: rpx(6),
        width: "100%",
    },
    timeOptionTouch: {
        flex: 1,
        minWidth: 0,
    },
    customTimeTouch: {
        width: rpx(88),
    },
    timeOption: {
        alignItems: "center",
        borderRadius: rpx(22),
        height: rpx(52),
        justifyContent: "center",
    },
    timeOptionSelected: {
        alignItems: "center",
        borderRadius: rpx(22),
        height: rpx(52),
        justifyContent: "center",
    },
    customTimeOption: {
        alignItems: "center",
        borderRadius: rpx(22),
        borderWidth: StyleSheet.hairlineWidth,
        height: rpx(52),
        justifyContent: "center",
    },
    timeOptionText: {
        fontSize: fontRpx(18),
    },
    closeAfterSection: {
        marginTop: rpx(22),
    },
    closeAfterPlayRow: {
        alignItems: "center",
        borderRadius: rpx(20),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        height: rpx(76),
        paddingHorizontal: rpx(18),
    },
    closeAfterPlayText: {
        flex: 1,
        fontSize: fontRpx(24),
    },
    closeAfterHint: {
        fontSize: fontRpx(16),
        marginLeft: rpx(18),
        marginTop: rpx(10),
    },
    primaryActionTouch: {
        marginTop: "auto",
    },
    primaryAction: {
        alignItems: "center",
        borderRadius: rpx(38),
        height: rpx(76),
        justifyContent: "center",
        shadowColor: "#7D8DFF",
        shadowOffset: { width: 0, height: rpx(8) },
        shadowOpacity: 0.22,
        shadowRadius: rpx(12),
    },
});
