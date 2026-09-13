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
import useColors from "@/hooks/useColors";
import { useTheme } from "@react-navigation/native";
import Color from "color";

const shortCutTimes = [10, 20, 30, 45, 60] as const;
const dialMaximum = 80;
const dialStartAngle = 135;

export default function TimingClose() {
    const closeAfterPlay = useCloseAfterPlayEnd();
    const countDown = useScheduleCloseCountDown();
    const { t } = useI18N();
    const colors = useColors();
    const { dark } = useTheme();
    const [selectedMinutes, setSelectedMinutes] = useState(30);

    const isCountingDown = countDown !== null;
    const activeMinutes = isCountingDown
        ? Math.max(1, Math.ceil(countDown / 60))
        : selectedMinutes;
    const isCustomTime = !shortCutTimes.includes(selectedMinutes as typeof shortCutTimes[number]);
    // 品牌紫蓝渐变是这块的设计标识，两个模式都保留；深色下整体提亮一档，
    // 免得压在重色底上发闷
    const activeStroke = dark ? Color("#5B84F7").lighten(0.16).toString() : "#5B84F7";
    const activeStrokeEnd = dark ? Color("#A274EA").lighten(0.16).toString() : "#A274EA";
    // 渐变上的白字按品牌色原样保留（渐变两端都是中亮色，白字足够）；
    // 未选中态、输入框等平面元素则走主题色
    const sheetColors = dark
        ? [colors.surfaceElevated ?? colors.card, colors.card]
        : ["#FAFBFF", "#F5F8FF"];
    const trackColor = dark ? colors.placeholder : "#E1E6F2";
    const tickColor = dark ? Color("#BEC8DF").darken(0.12).toString() : "#BEC8DF";
    const sleepIconColor = dark ? colors.textSecondary : "#BCC6DE";
    const dialRadius = rpx(114);
    const dialKnobSize = rpx(28);
    const dialKnobAngle = (
        (Math.min(activeMinutes, 60) / dialMaximum) * 360 + dialStartAngle
    ) * (Math.PI / 180);
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
            borderTopRadius={rpx(40)}
            keyboardAvoidBehavior="none"
            positionMethod="top"
            height={rpx(740)}
            renderBody={() => (
                <LinearGradient
                    colors={sheetColors}
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
                        <View style={styles.sleepIconGroup}>
                            <Icon
                                name="moon-outline"
                                size={rpx(52)}
                                color={sleepIconColor}
                                style={styles.sleepIcon}
                            />
                            <Icon
                                name="zzz"
                                size={rpx(22)}
                                color={sleepIconColor}
                                style={styles.sleepMarks}
                            />
                        </View>
                        <View style={styles.dialStack}>
                            <View style={styles.dialLayer} pointerEvents="none">
                                <CircularProgressBase
                                    activeStrokeColor={trackColor}
                                    activeStrokeWidth={rpx(7)}
                                    duration={0}
                                    inActiveStrokeColor="transparent"
                                    inActiveStrokeWidth={rpx(7)}
                                    maxValue={dialMaximum}
                                    radius={dialRadius}
                                    rotation={225}
                                    strokeLinecap="round"
                                    value={60}
                                />
                            </View>
                            <View style={styles.dialLayer} pointerEvents="none">
                                <CircularProgressBase
                                    activeStrokeColor={activeStroke}
                                    activeStrokeSecondaryColor={activeStrokeEnd}
                                    activeStrokeWidth={rpx(7)}
                                    clockwise
                                    duration={220}
                                    inActiveStrokeColor="transparent"
                                    inActiveStrokeWidth={rpx(7)}
                                    maxValue={dialMaximum}
                                    radius={dialRadius}
                                    rotation={225}
                                    strokeLinecap="round"
                                    value={Math.min(activeMinutes, 60)}
                                />
                            </View>
                            <View style={styles.dialTickLayer} pointerEvents="none">
                                <CircularProgressBase
                                    activeStrokeColor={tickColor}
                                    activeStrokeWidth={rpx(5)}
                                    dashedStrokeConfig={{ count: 60, width: rpx(1.4) }}
                                    duration={0}
                                    inActiveStrokeColor="transparent"
                                    inActiveStrokeWidth={rpx(5)}
                                    maxValue={dialMaximum}
                                    radius={rpx(100)}
                                    rotation={225}
                                    strokeLinecap="round"
                                    value={60}
                                />
                            </View>
                            <View style={styles.dialCenter}>
                                <ThemeText style={styles.activeTime} fontWeight="semibold">
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
                                style={[styles.dialKnob, dialKnobPosition, dark ? { borderColor: colors.surfaceElevated } : null]}
                            />
                        </View>
                        <Icon
                            name="sun-outline"
                            size={rpx(56)}
                            color={sleepIconColor}
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
                                        <View style={styles.timeOption}>
                                            <ThemeText
                                                style={styles.timeOptionText}
                                                color={dark ? colors.text : "#4E566B"}
                                                fontWeight="medium">
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
                                        borderColor: isCustomTime
                                            ? activeStroke
                                            : dark
                                                ? Color("#A58FFC").lighten(0.14).toString()
                                                : "#A58FFC",
                                        backgroundColor: isCustomTime ? activeStroke : "transparent",
                                    },
                                ]}>
                                <ThemeText
                                    style={styles.timeOptionText}
                                    color={isCustomTime
                                        ? "#FFFFFF"
                                        : dark
                                            ? Color("#7D68E8").lighten(0.3).toString()
                                            : "#7D68E8"}
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
                                    backgroundColor: dark ? colors.card : "#FFFFFF",
                                    borderColor: dark ? colors.border : "#E9EDF6",
                                    shadowColor: dark ? colors.shadow : "#7483A4",
                                    shadowOpacity: dark ? 0.28 : 0.11,
                                },
                            ]}>
                            <ThemeText style={styles.closeAfterPlayText} fontWeight="medium">
                                {t("panel.timingClose.closeAfterPlay")}
                            </ThemeText>
                            <ThemeSwitch
                                activeTrackColor={activeStroke}
                                inactiveTrackColor={dark ? colors.placeholder : "#DDE2ED"}
                                thumbColor={dark ? colors.text : "#FFFFFF"}
                                thumbSize={rpx(40)}
                                trackHeight={rpx(44)}
                                trackWidth={rpx(74)}
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
                            <ThemeText style={styles.primaryActionText} color="#FFFFFF" fontWeight="medium">
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
        paddingHorizontal: rpx(38),
        paddingTop: rpx(18),
        paddingBottom: rpx(42),
    },
    handle: {
        alignSelf: "center",
        borderRadius: rpx(6),
        height: rpx(8),
        width: rpx(68),
    },
    title: {
        alignSelf: "center",
        fontSize: fontRpx(30),
        lineHeight: fontRpx(42),
        marginTop: rpx(26),
    },
    dialArea: {
        alignItems: "center",
        flexDirection: "row",
        height: rpx(248),
        justifyContent: "space-between",
        marginTop: rpx(4),
        paddingHorizontal: rpx(102),
    },
    dialCenter: {
        alignItems: "center",
        height: "100%",
        justifyContent: "center",
        position: "absolute",
        width: "100%",
    },
    dialStack: {
        height: rpx(228),
        position: "relative",
        transform: [{ translateY: rpx(12) }],
        width: rpx(228),
    },
    dialLayer: {
        left: 0,
        position: "absolute",
        top: 0,
    },
    dialTickLayer: {
        left: rpx(14),
        position: "absolute",
        top: rpx(14),
    },
    activeTime: {
        fontSize: fontRpx(54),
        lineHeight: fontRpx(64),
    },
    minuteLabel: {
        fontSize: fontRpx(22),
        lineHeight: fontRpx(30),
        marginTop: 0,
    },
    sleepIconGroup: {
        height: rpx(56),
        position: "relative",
        width: rpx(62),
    },
    sleepIcon: {
        bottom: 0,
        left: 0,
        opacity: 0.9,
        position: "absolute",
    },
    sleepMarks: {
        opacity: 0.9,
        position: "absolute",
        right: 0,
        top: 0,
    },
    wakeIcon: {
        opacity: 0.9,
    },
    dialKnob: {
        borderColor: "#EFF2FF",
        borderRadius: rpx(14),
        borderWidth: rpx(2),
        height: rpx(28),
        position: "absolute",
        width: rpx(28),
    },
    timeOptions: {
        flexDirection: "row",
        gap: rpx(8),
        marginTop: rpx(20),
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
        borderRadius: rpx(26),
        height: rpx(52),
        justifyContent: "center",
    },
    timeOptionSelected: {
        alignItems: "center",
        borderRadius: rpx(26),
        height: rpx(52),
        justifyContent: "center",
        marginHorizontal: rpx(4),
    },
    customTimeOption: {
        alignItems: "center",
        borderRadius: rpx(26),
        borderWidth: StyleSheet.hairlineWidth,
        height: rpx(52),
        justifyContent: "center",
    },
    timeOptionText: {
        fontSize: fontRpx(20),
    },
    closeAfterSection: {
        marginTop: rpx(35),
    },
    closeAfterPlayRow: {
        alignItems: "center",
        borderRadius: rpx(22),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        height: rpx(84),
        paddingHorizontal: rpx(22),
        shadowColor: "#7483A4",
        shadowOffset: { width: 0, height: rpx(7) },
        shadowOpacity: 0.11,
        shadowRadius: rpx(15),
        elevation: 3,
    },
    closeAfterPlayText: {
        flex: 1,
        fontSize: fontRpx(24),
    },
    closeAfterHint: {
        fontSize: fontRpx(17),
        lineHeight: fontRpx(24),
        marginLeft: rpx(22),
        marginTop: rpx(10),
    },
    primaryActionTouch: {
        marginTop: "auto",
    },
    primaryAction: {
        alignItems: "center",
        borderRadius: rpx(44),
        height: rpx(88),
        justifyContent: "center",
        shadowColor: "#8291F8",
        shadowOffset: { width: 0, height: rpx(8) },
        shadowOpacity: 0.3,
        shadowRadius: rpx(18),
        elevation: 8,
    },
    primaryActionText: {
        fontSize: fontRpx(30),
    },
});
