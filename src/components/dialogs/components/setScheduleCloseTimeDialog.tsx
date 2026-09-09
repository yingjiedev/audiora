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

interface ISetScheduleCloseTimeDialogProps {
    onOk?: (minutes: number) => void;
}

export default function SetScheduleCloseTimeDialog(
    props: ISetScheduleCloseTimeDialogProps,
) {
    const { onOk } = props;
    const { t } = useI18N();

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
            containerStyle={style.dialogContainer}
            onDismiss={hideDialog}>
            <LinearGradient
                colors={["#FAFBFF", "#F5F8FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={style.dialogSurface}>
                <ThemeText style={style.title} fontWeight="semibold">
                    {t("dialog.setScheduleCloseTime.title")}
                </ThemeText>

                <View style={style.stepper}>
                    <TouchableOpacity
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel={`-5 ${t("dialog.setScheduleCloseTime.unit")}`}
                        onPress={() => adjustMinutes(-5)}
                        style={style.stepButton}>
                        <Icon name="minus" size={rpx(34)} color="#4E73F5" />
                    </TouchableOpacity>

                    <View style={style.timeValueContainer}>
                        <Input
                            hasHorizontalPadding={false}
                            accessibilityLabel={t("dialog.setScheduleCloseTime.title")}
                            selectTextOnFocus
                            style={style.textInput}
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
                        <ThemeText style={style.unitText} color="#7D869B">
                            {t("dialog.setScheduleCloseTime.unit")}
                        </ThemeText>
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel={`+5 ${t("dialog.setScheduleCloseTime.unit")}`}
                        onPress={() => adjustMinutes(5)}
                        style={style.stepButton}>
                        <Icon name="plus" size={rpx(34)} color="#4E73F5" />
                    </TouchableOpacity>
                </View>

                <ThemeText style={style.hintText} color="#7D869B">
                    {t("dialog.setScheduleCloseTime.hint")}
                </ThemeText>

                <View style={style.actions}>
                    <TouchableOpacity
                        activeOpacity={0.72}
                        accessibilityRole="button"
                        accessibilityLabel={t("common.cancel")}
                        onPress={hideDialog}
                        style={style.cancelButton}>
                        <ThemeText
                            style={style.actionText}
                            color="#27314A"
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
                            colors={["#5B84F7", "#3F6CF6"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={style.confirmButton}>
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
        backgroundColor: "#FAFBFF",
        borderColor: "transparent",
        borderRadius: rpx(34),
        borderWidth: 0,
        elevation: 10,
        overflow: "hidden",
        shadowColor: "#43547B",
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
        color: "#121A31",
        fontSize: fontRpx(34),
        lineHeight: fontRpx(48),
    },
    stepper: {
        alignItems: "center",
        backgroundColor: "#F3F6FE",
        borderRadius: rpx(72),
        flexDirection: "row",
        height: rpx(168),
        justifyContent: "space-between",
        marginTop: rpx(48),
        paddingHorizontal: rpx(42),
    },
    stepButton: {
        alignItems: "center",
        backgroundColor: "#F8FAFF",
        borderColor: "#E7ECFA",
        borderRadius: rpx(48),
        borderWidth: StyleSheet.hairlineWidth,
        height: rpx(96),
        justifyContent: "center",
        width: rpx(96),
        elevation: 1,
        shadowColor: "#8392BA",
        shadowOffset: {
            width: 0,
            height: rpx(2),
        },
        shadowOpacity: 0.08,
        shadowRadius: rpx(6),
    },
    timeValueContainer: {
        alignItems: "center",
        justifyContent: "center",
        width: rpx(200),
    },
    textInput: {
        color: "#121A31",
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
        backgroundColor: "#EDF1F9",
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
        shadowColor: "#5B84F7",
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
