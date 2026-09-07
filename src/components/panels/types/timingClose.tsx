import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Color from "color";
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
import timeformat from "@/utils/timeformat";
import PanelBase from "../base/panelBase";
import { hidePanel } from "../usePanel";
import { useI18N } from "@/core/i18n";
import { showDialog } from "@/components/dialogs/useDialog";

const shortCutTimes = [10, 20, 30, 45, 60] as const;

function makeTint(color: string, alpha: number) {
    try {
        return Color(color).alpha(alpha).toString();
    } catch {
        return color;
    }
}

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
    const primaryTint = makeTint(colors.primary, 0.12);
    const primarySoftTint = makeTint(colors.primary, 0.06);
    const borderTint = makeTint(colors.primary, 0.24);

    const scheduleClose = () => {
        setScheduleClose(Date.now() + selectedMinutes * 60000);
    };

    const chooseCustomTime = () => {
        showDialog("SetScheduleCloseTimeDialog", {
            onOk: (minutes: number) => {
                setSelectedMinutes(minutes);
            },
        });
    };

    return (
        <PanelBase
            keyboardAvoidBehavior="none"
            positionMethod="top"
            height={rpx(660)}
            renderBody={() => (
                <View
                    style={[
                        styles.sheet,
                        { backgroundColor: colors.backdrop },
                    ]}>
                    <LinearGradient
                        colors={[colors.accentCool ?? colors.primary, colors.primary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.handle}
                    />

                    <View style={styles.heading}>
                        <View
                            style={[
                                styles.iconBadge,
                                { backgroundColor: primaryTint },
                            ]}>
                            <Icon
                                name="clock-outline"
                                size={rpx(38)}
                                color={colors.primary}
                            />
                        </View>
                        <View style={styles.headingCopy}>
                            <ThemeText
                                style={styles.title}
                                fontWeight="bold"
                                fontSize="title">
                                {t("sidebar.scheduleClose")}
                            </ThemeText>
                            <ThemeText
                                style={styles.subtitle}
                                fontColor="textSecondary"
                                fontSize="subTitle">
                                {isCountingDown
                                    ? t("panel.timingClose.countdown", {
                                        time: timeformat(countDown),
                                    })
                                    : t("panel.timingClose.customize")}
                            </ThemeText>
                        </View>
                    </View>

                    <View style={styles.timePickerArea}>
                        <View
                            style={[
                                styles.timeRing,
                                {
                                    borderColor: borderTint,
                                    backgroundColor: primarySoftTint,
                                },
                            ]}>
                            <View
                                style={[
                                    styles.timeRingInner,
                                    { backgroundColor: colors.surfaceElevated },
                                ]}>
                                <ThemeText
                                    style={styles.activeTime}
                                    fontWeight="bold">
                                    {activeMinutes}
                                </ThemeText>
                                <ThemeText
                                    style={styles.minuteLabel}
                                    fontColor="textSecondary">
                                    {t("dialog.setScheduleCloseTime.unit")}
                                </ThemeText>
                            </View>
                        </View>
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
                                            colors={[
                                                colors.accentCool ?? colors.primary,
                                                colors.primary,
                                            ]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.timeOptionSelected}>
                                            <ThemeText
                                                style={styles.timeOptionText}
                                                color="#FFFFFF"
                                                fontWeight="semibold">
                                                {time}
                                            </ThemeText>
                                        </LinearGradient>
                                    ) : (
                                        <View
                                            style={[
                                                styles.timeOption,
                                                {
                                                    backgroundColor: colors.surfaceElevated,
                                                    borderColor: colors.border,
                                                },
                                            ]}>
                                            <ThemeText
                                                style={styles.timeOptionText}
                                                fontWeight="semibold">
                                                {time}
                                            </ThemeText>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                        <TouchableOpacity
                            activeOpacity={0.76}
                            accessibilityRole="button"
                            accessibilityLabel={t("panel.timingClose.customize")}
                            onPress={chooseCustomTime}
                            style={styles.timeOptionTouch}>
                            <View
                                style={[
                                    styles.customTimeOption,
                                    {
                                        backgroundColor: colors.surfaceElevated,
                                        borderColor: colors.border,
                                    },
                                ]}>
                                <Icon
                                    name="plus"
                                    size={rpx(26)}
                                    color={colors.primary}
                                />
                                <ThemeText
                                    style={styles.customTimeText}
                                    fontColor="primary"
                                    fontWeight="semibold">
                                    {t("panel.timingClose.customize")}
                                </ThemeText>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View
                        style={[
                            styles.closeAfterPlayRow,
                            {
                                backgroundColor: colors.surfaceElevated,
                                borderColor: colors.border,
                            },
                        ]}>
                        <View
                            style={[
                                styles.musicIconBadge,
                                { backgroundColor: primaryTint },
                            ]}>
                            <Icon
                                name="musical-note"
                                size={rpx(32)}
                                color={colors.primary}
                            />
                        </View>
                        <ThemeText
                            style={styles.closeAfterPlayText}
                            fontWeight="medium">
                            {t("panel.timingClose.closeAfterPlay")}
                        </ThemeText>
                        <ThemeSwitch
                            value={closeAfterPlay}
                            onValueChange={setCloseAfterPlayEnd}
                        />
                    </View>

                    {isCountingDown ? (
                        <TouchableOpacity
                            style={[styles.cancelSchedule, { borderColor: borderTint }]}
                            activeOpacity={0.7}
                            onPress={() => setScheduleClose(null)}>
                            <Icon
                                name="x-mark"
                                size={rpx(24)}
                                color={colors.primary}
                            />
                            <ThemeText
                                style={styles.cancelScheduleText}
                                fontColor="primary"
                                fontWeight="medium">
                                {t("panel.timingClose.cancelScheduleClose")}
                            </ThemeText>
                        </TouchableOpacity>
                    ) : null}

                    <View style={styles.actions}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={hidePanel}
                            style={styles.dismissButton}>
                            <ThemeText fontColor="textSecondary" fontWeight="medium">
                                {t("common.cancel")}
                            </ThemeText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={scheduleClose}
                            style={styles.primaryActionTouch}>
                            <LinearGradient
                                colors={[
                                    colors.accentCool ?? colors.primary,
                                    colors.primary,
                                ]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.primaryAction}>
                                <ThemeText color="#FFFFFF" fontWeight="semibold">
                                    {t("common.confirm")}
                                </ThemeText>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
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
        paddingBottom: rpx(28),
    },
    handle: {
        alignSelf: "center",
        borderRadius: rpx(8),
        height: rpx(8),
        width: rpx(60),
    },
    heading: {
        alignItems: "center",
        flexDirection: "row",
        marginTop: rpx(22),
    },
    iconBadge: {
        alignItems: "center",
        borderRadius: rpx(36),
        height: rpx(72),
        justifyContent: "center",
        width: rpx(72),
    },
    headingCopy: {
        marginLeft: rpx(16),
    },
    title: {
        lineHeight: fontRpx(40),
    },
    subtitle: {
        marginTop: rpx(2),
    },
    timePickerArea: {
        alignItems: "center",
        marginTop: rpx(16),
    },
    timeRing: {
        alignItems: "center",
        borderRadius: rpx(106),
        borderWidth: rpx(8),
        height: rpx(212),
        justifyContent: "center",
        width: rpx(212),
    },
    timeRingInner: {
        alignItems: "center",
        borderRadius: rpx(88),
        height: rpx(172),
        justifyContent: "center",
        width: rpx(172),
    },
    activeTime: {
        fontSize: fontRpx(66),
        lineHeight: fontRpx(74),
    },
    minuteLabel: {
        fontSize: fontRpx(24),
        marginTop: rpx(-2),
    },
    timeOptions: {
        flexDirection: "row",
        gap: rpx(10),
        marginTop: rpx(20),
        width: "100%",
    },
    timeOptionTouch: {
        flex: 1,
        minWidth: 0,
    },
    timeOption: {
        alignItems: "center",
        borderRadius: rpx(20),
        borderWidth: StyleSheet.hairlineWidth,
        height: rpx(72),
        justifyContent: "center",
    },
    timeOptionSelected: {
        alignItems: "center",
        borderRadius: rpx(20),
        height: rpx(72),
        justifyContent: "center",
    },
    timeOptionText: {
        fontSize: fontRpx(26),
    },
    customTimeOption: {
        alignItems: "center",
        borderRadius: rpx(20),
        borderWidth: StyleSheet.hairlineWidth,
        height: rpx(72),
        justifyContent: "center",
    },
    customTimeText: {
        fontSize: fontRpx(18),
        marginTop: rpx(1),
    },
    closeAfterPlayRow: {
        alignItems: "center",
        borderRadius: rpx(24),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        marginTop: rpx(22),
        minHeight: rpx(88),
        paddingHorizontal: rpx(18),
    },
    musicIconBadge: {
        alignItems: "center",
        borderRadius: rpx(24),
        height: rpx(48),
        justifyContent: "center",
        width: rpx(48),
    },
    closeAfterPlayText: {
        flex: 1,
        fontSize: fontRpx(26),
        marginLeft: rpx(14),
    },
    cancelSchedule: {
        alignItems: "center",
        alignSelf: "center",
        borderRadius: rpx(24),
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        marginTop: rpx(14),
        paddingHorizontal: rpx(20),
        paddingVertical: rpx(10),
    },
    cancelScheduleText: {
        fontSize: fontRpx(22),
        marginLeft: rpx(6),
    },
    actions: {
        alignItems: "center",
        flexDirection: "row",
        marginTop: "auto",
    },
    dismissButton: {
        alignItems: "center",
        height: rpx(76),
        justifyContent: "center",
        marginRight: rpx(16),
        width: rpx(132),
    },
    primaryActionTouch: {
        flex: 1,
    },
    primaryAction: {
        alignItems: "center",
        borderRadius: rpx(38),
        height: rpx(76),
        justifyContent: "center",
    },
});
