import React, { useMemo, useState } from "react";
import rpx, { fontRpx } from "@/utils/rpx";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import { hideDialog } from "../useDialog";
import Dialog from "./base";
import Input from "@/components/base/input";
import { useI18N } from "@/core/i18n";
import PersistStatus from "@/utils/persistStatus";
import useColors from "@/hooks/useColors";
import { useTheme } from "@react-navigation/native";
import Color from "color";

interface ISetScheduleCloseTimeDialogProps {
    onOk?: (minutes: number) => void;
}

export default function SetScheduleCloseTimeDialog(
    props: ISetScheduleCloseTimeDialogProps,
) {
    const { onOk } = props;
    const { t } = useI18N();
    const colors = useColors();
    const { dark } = useTheme();
    // 品牌蓝两模式同款，深色下提亮一档
    const brandBlue = dark ? Color("#4E73F5").lighten(0.18).toString() : "#4E73F5";
    const surfaceGradient = dark
        ? [colors.surfaceElevated ?? colors.card, colors.card]
        : ["#FAFBFF", "#F5F8FF"];
    // 加减按钮在两个模式下的描边与投影，浅色沿用设计稿的固定值
    const stepButtonStyle = dark
        ? {
            backgroundColor: colors.placeholder,
            borderColor: colors.border,
            shadowColor: colors.shadow,
            shadowOpacity: 0.28,
        }
        : {
            backgroundColor: "#F8FAFF",
            borderColor: "#E7ECFA",
            shadowColor: "#8392BA",
            shadowOpacity: 0.08,
        };

    const initialMinutes = useMemo(() => {
        const lastCustomTime = Number(
            PersistStatus.get("app.scheduleCloseTime"),
        );

        return Number.isFinite(lastCustomTime)
            && lastCustomTime >= 1
            && lastCustomTime <= 1440
            ? Math.round(lastCustomTime)
            : 30;
    }, []);
    const [timeInput, setTimeInput] = useState(String(initialMinutes));

    const getValidMinutes = () => {
        const minutes = Number.parseInt(timeInput, 10);

        return Number.isNaN(minutes)
            ? initialMinutes
            : Math.min(1440, Math.max(1, minutes));
    };

    const getConfirmedMinutes = () => {
        if (!timeInput.trim()) {
            return initialMinutes;
        }

        const minutes = Number.parseInt(timeInput, 10);

        return Number.isNaN(minutes) || minutes < 1 || minutes > 1440
            ? null
            : minutes;
    };

    const adjustMinutes = (amount: number) => {
        setTimeInput(String(
            Math.min(1440, Math.max(1, getValidMinutes() + amount)),
        ));
    };

    const handleConfirm = () => {
        const minutes = getConfirmedMinutes();

        if (minutes === null) {
            return;
        }

        PersistStatus.set("app.scheduleCloseTime", minutes);
        onOk?.(minutes);
        hideDialog();
    };

    return (
        <Dialog
            containerStyle={[
                style.dialogContainer,
                {
                    backgroundColor: dark ? colors.surfaceElevated : "#FAFBFF",
                    shadowColor: dark ? colors.shadow : "#43547B",
                },
            ]}
            onDismiss={hideDialog}>
            <LinearGradient
                colors={surfaceGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={style.dialogSurface}>
                <ThemeText
                    style={style.title}
                    color={dark ? colors.text : "#121A31"}
                    fontWeight="semibold">
                    {t("dialog.setScheduleCloseTime.title")}
                </ThemeText>

                <View
                    style={[
                        style.stepper,
                        { backgroundColor: dark ? colors.surface : "#F3F6FE" },
                    ]}>
                    <TouchableOpacity
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel={`-5 ${t("dialog.setScheduleCloseTime.unit")}`}
                        onPress={() => adjustMinutes(-5)}
                        style={[style.stepButton, stepButtonStyle]}>
                        <Icon name="minus" size={rpx(34)} color={brandBlue} />
                    </TouchableOpacity>

                    <View style={style.timeValueContainer}>
                        <Input
                            hasHorizontalPadding={false}
                            accessibilityLabel={t("dialog.setScheduleCloseTime.title")}
                            selectTextOnFocus
                            style={[
                                style.textInput,
                                { color: dark ? colors.text : "#121A31" },
                            ]}
                            value={timeInput}
                            onChangeText={text => {
                                const numericText = text.replace(/[^0-9]/g, "");
                                if (numericText.length <= 4) {
                                    setTimeInput(numericText);
                                }
                            }}
                            keyboardType="numeric"
                            maxLength={4}
                        />
                        <ThemeText
                            style={style.unitText}
                            color={dark ? colors.textSecondary : "#7D869B"}>
                            {t("dialog.setScheduleCloseTime.unit")}
                        </ThemeText>
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel={`+5 ${t("dialog.setScheduleCloseTime.unit")}`}
                        onPress={() => adjustMinutes(5)}
                        style={[style.stepButton, stepButtonStyle]}>
                        <Icon name="plus" size={rpx(34)} color={brandBlue} />
                    </TouchableOpacity>
                </View>

                <ThemeText
                    style={style.hintText}
                    color={dark ? colors.textSecondary : "#7D869B"}>
                    {t("dialog.setScheduleCloseTime.hint")}
                </ThemeText>

                <View style={style.actions}>
                    <TouchableOpacity
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel={t("common.cancel")}
                        onPress={hideDialog}
                        style={[
                            style.cancelButton,
                            { backgroundColor: dark ? colors.placeholder : "#EDF1F9" },
                        ]}>
                        <ThemeText
                            style={style.actionText}
                            color={dark ? colors.text : "#27314A"}
                            fontWeight="semibold">
                            {t("common.cancel")}
                        </ThemeText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={t("common.confirm")}
                        onPress={handleConfirm}
                        style={style.confirmTouch}>
                        <LinearGradient
                            colors={dark
                                ? [
                                    Color("#5B84F7").lighten(0.16).toString(),
                                    Color("#3F6CF6").lighten(0.16).toString(),
                                ]
                                : ["#5B84F7", "#3F6CF6"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                                style.confirmButton,
                                { shadowColor: dark ? colors.shadow : "#5B84F7" },
                            ]}>
                            <ThemeText
                                style={style.actionText}
                                color="#FFFFFF"
                                fontWeight="semibold">
                                {t("common.confirm")}
                            </ThemeText>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </Dialog>
    );
}

const style = StyleSheet.create({
    dialogContainer: {
        borderColor: "transparent",
        borderRadius: rpx(34),
        borderWidth: 0,
        elevation: 10,
        overflow: "hidden",
        shadowOffset: {
            width: 0,
            height: rpx(12),
        },
        shadowOpacity: 0.24,
        shadowRadius: rpx(24),
        width: "96.8%",
    },
    dialogSurface: {
        paddingBottom: rpx(36),
        paddingHorizontal: rpx(38),
        paddingTop: rpx(42),
    },
    title: {
        alignSelf: "center",
        fontSize: fontRpx(34),
        lineHeight: fontRpx(48),
    },
    stepper: {
        alignItems: "center",
        borderRadius: rpx(72),
        flexDirection: "row",
        height: rpx(168),
        justifyContent: "space-between",
        marginTop: rpx(48),
        paddingHorizontal: rpx(42),
    },
    stepButton: {
        alignItems: "center",
        borderRadius: rpx(48),
        borderWidth: StyleSheet.hairlineWidth,
        height: rpx(96),
        justifyContent: "center",
        width: rpx(96),
        elevation: 1,
        shadowOffset: {
            width: 0,
            height: rpx(2),
        },
        shadowRadius: rpx(6),
    },
    timeValueContainer: {
        alignItems: "center",
        justifyContent: "center",
        width: rpx(200),
    },
    textInput: {
        fontSize: fontRpx(60),
        fontWeight: "700",
        height: rpx(80),
        includeFontPadding: false,
        lineHeight: fontRpx(70),
        padding: 0,
        borderWidth: 0,
        backgroundColor: "transparent",
        textAlign: "center",
        width: "100%",
    },
    unitText: {
        fontSize: fontRpx(22),
        lineHeight: fontRpx(30),
        marginTop: rpx(4),
    },
    hintText: {
        fontSize: fontRpx(20),
        lineHeight: fontRpx(34),
        marginTop: rpx(44),
        textAlign: "center",
    },
    actions: {
        flexDirection: "row",
        gap: rpx(24),
        marginTop: rpx(40),
    },
    cancelButton: {
        alignItems: "center",
        borderRadius: rpx(44),
        flex: 1,
        height: rpx(88),
        justifyContent: "center",
    },
    confirmTouch: {
        flex: 1,
    },
    confirmButton: {
        alignItems: "center",
        borderRadius: rpx(44),
        height: rpx(88),
        justifyContent: "center",
        shadowOffset: {
            width: 0,
            height: rpx(6),
        },
        shadowOpacity: 0.22,
        shadowRadius: rpx(12),
        elevation: 4,
    },
    actionText: {
        fontSize: fontRpx(26),
    },
});
