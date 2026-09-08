import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { CircularProgressBase } from "react-native-circular-progress-indicator";
import rpx, { fontRpx } from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import ThemeSwitch from "@/components/base/switch";
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
    const { t } = useI18N();
    const [selectedMinutes, setSelectedMinutes] = useState(30);

    const isCountingDown = countDown !== null;
    const activeMinutes = isCountingDown
        ? Math.max(1, Math.ceil(countDown / 60))
        : selectedMinutes;
    const isCustomTime = !shortCutTimes.includes(selectedMinutes as typeof shortCutTimes[number]);
    const activeStroke = "#6685F7";
    const activeStrokeEnd = "#A174ED";
    const dialRadius = rpx(94);
    const dialKnobSize = rpx(24);
    const dialKnobAngle = ((activeMinutes / 60) * 360 + 90) * (Math.PI / 180);
    const dialKnobPosition = {
        left: dialRadius + Math.cos(dialKnobAngle) * dialRadius - dialKnobSize / 2,
        top: dialRadius + Math.sin(dialKnobAngle) * dialRadius - dialKnobSize / 2,
    };

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
            maskColor="#111A2D"
            positionMethod="top"
            height={rpx(760)}
            renderBody={() => (
                <LinearGradient
                    colors={["#FCFDFF", "#F3F6FF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.sheet}>
                    <LinearGradient
                        colors={[activeStroke, activeStrokeEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.handle}
                    />

                    <ThemeText style={styles.title} fontWeight="bold">
                        {t("sidebar.scheduleClose")}
                    </ThemeText>

                    <View style={styles.dialArea}>
                        <Icon
                            name="moon-outline"
                            size={rpx(38)}
                            color="#C8D0E5"
                            style={styles.sleepIcon}
                        />
                        <View style={styles.dialStack}>
                            <View style={styles.dialLayer} pointerEvents="none">
                                <CircularProgressBase
                                    activeStrokeColor="#E7EBF6"
                                    activeStrokeWidth={rpx(6)}
                                    duration={0}
                                    inActiveStrokeColor="#E7EBF6"
                                    inActiveStrokeWidth={rpx(6)}
                                    maxValue={60}
                                    radius={dialRadius}
                                    rotation={90}
                                    strokeLinecap="round"
                                    value={0}
                                />
                            </View>
                            <View style={styles.dialLayer} pointerEvents="none">
                                <CircularProgressBase
                                    activeStrokeColor={activeStroke}
                                    activeStrokeSecondaryColor={activeStrokeEnd}
                                    activeStrokeWidth={rpx(8)}
                                    clockwise
                                    duration={220}
                                    inActiveStrokeColor="transparent"
                                    inActiveStrokeWidth={rpx(8)}
                                    maxValue={60}
                                    radius={dialRadius}
                                    rotation={90}
                                    strokeLinecap="round"
                                    value={Math.min(activeMinutes, 60)}
                                />
                            </View>
                            <View style={styles.dialTickLayer} pointerEvents="none">
                                <CircularProgressBase
                                    activeStrokeColor="#D6DEF3"
                                    activeStrokeWidth={rpx(1.5)}
                                    dashedStrokeConfig={{ count: 60, width: rpx(1.5) }}
                                    duration={0}
                                    inActiveStrokeColor="#D6DEF3"
                                    inActiveStrokeOpacity={0.82}
                                    inActiveStrokeWidth={rpx(1.5)}
                                    maxValue={60}
                                    radius={rpx(82)}
                                    rotation={90}
                                    strokeLinecap="round"
                                    value={0}
                                />
                            </View>
                            <View style={styles.dialCenter}>
                                <ThemeText style={styles.activeTime} fontWeight="bold">
                                    {activeMinutes}
                                </ThemeText>
                                <ThemeText style={styles.minuteLabel} fontColor="textSecondary">
                                    {t("dialog.setScheduleCloseTime.unit")}
                                </ThemeText>
                            </View>
                            <LinearGradient
                                colors={[activeStroke, activeStrokeEnd]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.dialKnob, dialKnobPosition]}
                            />
                        </View>
                        <Icon
                            name="sun-outline"
                            size={rpx(38)}
                            color="#C8D0E5"
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
                                            colors={[activeStroke, activeStrokeEnd]}
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
                                                { backgroundColor: "#F1F4FC" },
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
                                        borderColor: isCustomTime ? activeStroke : "#A58FFC",
                                        backgroundColor: isCustomTime ? activeStroke : "#F8F9FF",
                                    },
                                ]}>
                                <ThemeText
                                    style={styles.timeOptionText}
                                    color={isCustomTime ? "#FFFFFF" : "#7D68E8"}
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
                                    backgroundColor: "#FFFFFF",
                                    borderColor: "#E9EDF6",
                                },
                            ]}>
                            <ThemeText style={styles.closeAfterPlayText} fontWeight="semibold">
                                {t("panel.timingClose.closeAfterPlay")}
                            </ThemeText>
                            <ThemeSwitch
                                activeTrackColor={activeStroke}
                                inactiveTrackColor="#DDE2ED"
                                thumbColor="#FFFFFF"
                                thumbSize={rpx(28)}
                                trackHeight={rpx(34)}
                                trackWidth={rpx(64)}
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
                            colors={[activeStroke, activeStrokeEnd]}
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
                </LinearGradient>
            )}
        />
    );
}

const styles = StyleSheet.create({
    sheet: {
        flex: 1,
        paddingHorizontal: rpx(30),
        paddingTop: rpx(18),
        paddingBottom: rpx(26),
    },
    handle: {
        alignSelf: "center",
        borderRadius: rpx(6),
        height: rpx(7),
        width: rpx(56),
    },
    title: {
        alignSelf: "center",
        fontSize: fontRpx(28),
        lineHeight: fontRpx(40),
        marginTop: rpx(12),
    },
    dialArea: {
        alignItems: "center",
        flexDirection: "row",
        height: rpx(208),
        justifyContent: "space-between",
        marginTop: rpx(4),
        paddingHorizontal: rpx(120),
    },
    dialCenter: {
        alignItems: "center",
        height: "100%",
        justifyContent: "center",
        position: "absolute",
        width: "100%",
    },
    dialStack: {
        height: rpx(188),
        position: "relative",
        width: rpx(188),
    },
    dialLayer: {
        left: 0,
        position: "absolute",
        top: 0,
    },
    dialTickLayer: {
        left: rpx(12),
        position: "absolute",
        top: rpx(12),
    },
    activeTime: {
        fontSize: fontRpx(52),
        lineHeight: fontRpx(60),
    },
    minuteLabel: {
        fontSize: fontRpx(18),
        lineHeight: fontRpx(26),
        marginTop: 0,
    },
    sleepIcon: {
        opacity: 0.7,
    },
    wakeIcon: {
        opacity: 0.7,
    },
    dialKnob: {
        borderColor: "#EFF2FF",
        borderRadius: rpx(12),
        borderWidth: rpx(2),
        height: rpx(24),
        position: "absolute",
        width: rpx(24),
    },
    timeOptions: {
        flexDirection: "row",
        gap: rpx(7),
        marginTop: 0,
        width: "100%",
    },
    timeOptionTouch: {
        flex: 1,
        minWidth: 0,
    },
    customTimeTouch: {
        width: rpx(78),
    },
    timeOption: {
        alignItems: "center",
        borderRadius: rpx(21),
        height: rpx(46),
        justifyContent: "center",
    },
    timeOptionSelected: {
        alignItems: "center",
        borderRadius: rpx(21),
        height: rpx(46),
        justifyContent: "center",
    },
    customTimeOption: {
        alignItems: "center",
        borderRadius: rpx(21),
        borderWidth: StyleSheet.hairlineWidth,
        height: rpx(46),
        justifyContent: "center",
    },
    timeOptionText: {
        fontSize: fontRpx(16),
    },
    closeAfterSection: {
        marginTop: rpx(24),
    },
    closeAfterPlayRow: {
        alignItems: "center",
        borderRadius: rpx(18),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        height: rpx(66),
        paddingHorizontal: rpx(18),
    },
    closeAfterPlayText: {
        flex: 1,
        fontSize: fontRpx(22),
    },
    closeAfterHint: {
        fontSize: fontRpx(15),
        marginLeft: rpx(18),
        marginTop: rpx(8),
    },
    primaryActionTouch: {
        marginTop: "auto",
    },
    primaryAction: {
        alignItems: "center",
        borderRadius: rpx(34),
        height: rpx(68),
        justifyContent: "center",
        shadowColor: "#8291F8",
        shadowOffset: { width: 0, height: rpx(8) },
        shadowOpacity: 0.22,
        shadowRadius: rpx(12),
    },
});
