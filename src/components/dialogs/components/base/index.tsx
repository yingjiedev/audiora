import React, { ReactNode, useEffect, useMemo, useRef } from "react";
import {
    BackHandler,
    Dimensions,
    Keyboard,
    Modal,
    NativeEventSubscription,
    Platform,
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    ViewStyle,
} from "react-native";
import rpx, { vh, vw } from "@/utils/rpx";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import useColors from "@/hooks/useColors";
import useMotion from "@/hooks/useMotion";
import useHasCustomBackground from "@/hooks/useHasCustomBackground";
import { KEYBOARD_TIMING } from "@/utils/motion";
import ThemeText from "@/components/base/themeText";
import Divider from "@/components/base/divider";
import { fontSizeConst } from "@/constants/uiConst";
import { ScrollView } from "react-native-gesture-handler";
import useOrientation from "@/hooks/useOrientation.ts";
import Config from "@/core/appConfig";
import Theme from "@/core/theme";

interface IDialogProps {
    onDismiss?: () => void;
    children?: ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
}

function Dialog(props: IDialogProps) {
    const {
        children,
        containerStyle: customContainerStyle,
        onDismiss,
    } = props;

    const sharedShowValue = useSharedValue(0);
    const keyboardHeight = useSharedValue(0);
    const colors = useColors();
    const motion = useMotion();
    const hasCustomBackground = useHasCustomBackground();
    const backHandlerRef = useRef<NativeEventSubscription | null>(null);
    const orientation = useOrientation();
    const keyboardAvoidMode =
        Config.getConfig("basic.keyboardAvoidMode") ?? "auto";

    // Resolved outside the worklets below: calling helpers from inside a
    // worklet is not safe, so the config is captured as a plain object.
    const dialogTiming = useMemo(
        () => ({
            duration: motion.duration("fast"),
            easing: motion.easing("decelerate"),
        }),
        [motion],
    );

    // 对话框宽度
    const dialogContainerStyle: ViewStyle =
        orientation === "vertical"
            ? {
                width: vw(100) - rpx(72),
            }
            : {
                width: "80%",
            };

    useEffect(() => {
        sharedShowValue.value = 1;
        if (backHandlerRef.current) {
            backHandlerRef.current?.remove();
            backHandlerRef.current = null;
        }
        backHandlerRef.current = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                onDismiss?.();
                return true;
            },
        );

        // 监听键盘事件
        const keyboardShowEvent =
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const keyboardHideEvent =
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

        const keyboardShowListener = Keyboard.addListener(
            keyboardShowEvent,
            e => {
                if (keyboardAvoidMode === "off") {
                    keyboardHeight.value = motion.timing(0, KEYBOARD_TIMING);
                    return;
                }
                const windowHeight = Dimensions.get("window").height;
                const keyboardTopY =
                    typeof e.endCoordinates.screenY === "number"
                        ? e.endCoordinates.screenY
                        : windowHeight - e.endCoordinates.height;
                const effectiveKeyboardHeight = Math.max(
                    0,
                    windowHeight - keyboardTopY,
                );
                const targetHeight =
                    keyboardAvoidMode === "manual"
                        ? e.endCoordinates.height
                        : Math.min(
                            e.endCoordinates.height,
                            effectiveKeyboardHeight,
                        );
                keyboardHeight.value = motion.timing(
                    targetHeight / 2,
                    KEYBOARD_TIMING,
                );
            },
        );

        const keyboardHideListener = Keyboard.addListener(
            keyboardHideEvent,
            () => {
                keyboardHeight.value = motion.timing(0, KEYBOARD_TIMING);
            },
        );

        return () => {
            sharedShowValue.value = 0;
            if (backHandlerRef.current) {
                backHandlerRef.current?.remove();
                backHandlerRef.current = null;
            }
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, [
        dialogTiming,
        keyboardAvoidMode,
        keyboardHeight,
        motion,
        onDismiss,
        sharedShowValue,
    ]);

    const containerStyle = useAnimatedStyle(() => {
        return {
            opacity: withTiming(sharedShowValue.value, dialogTiming),
        };
    });

    const scaleAnimationStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    scale: withTiming(
                        0.9 + sharedShowValue.value * 0.1,
                        dialogTiming,
                    ),
                },
                {
                    translateY: -keyboardHeight.value,
                },
            ],
        };
    });

    return (
        <Modal
            visible
            transparent
            animationType="none"
            statusBarTranslucent
            presentationStyle="overFullScreen"
            onRequestClose={onDismiss}>
            <View style={styles.backContainer}>
                <TouchableWithoutFeedback
                    style={styles.container}
                    onPress={onDismiss}>
                    <Animated.View style={[styles.container, containerStyle]} />
                </TouchableWithoutFeedback>
                <Animated.View
                    style={[
                        styles.dialogContainer,
                        dialogContainerStyle,
                        containerStyle,
                        scaleAnimationStyle,
                        {
                            // 弹窗必须是不透明底：设壁纸时 surfaceElevated 会变成
                            // rgba(0,0,0,0.30)，透出壁纸导致正文看不清
                            backgroundColor: Theme.getDialogSurfaceColor(),
                            // Custom wallpaper: no dark outer ring (border + elevation).
                            borderWidth: hasCustomBackground
                                ? 0
                                : StyleSheet.hairlineWidth,
                            borderColor: hasCustomBackground
                                ? "transparent"
                                : colors.border,
                            shadowColor: hasCustomBackground
                                ? "transparent"
                                : colors.shadow,
                            shadowOpacity: hasCustomBackground ? 0 : 0.5,
                            elevation: hasCustomBackground ? 0 : 5,
                        },
                        customContainerStyle,
                    ]}>
                    {children}
                </Animated.View>
            </View>
        </Modal>
    );
}

interface IDialogTitleProps {
    children?: ReactNode;
    withDivider?: boolean;
    stringContent?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
}

function Title(props: IDialogTitleProps) {
    const { children, withDivider, stringContent, containerStyle } = props;

    return (
        <>
            <View style={[styles.titleContainer, containerStyle]}>
                {typeof children === "string" || stringContent ? (
                    <ThemeText
                        fontSize="title"
                        fontWeight="semibold"
                        numberOfLines={1}>
                        {children}
                    </ThemeText>
                ) : (
                    children
                )}
            </View>
            {withDivider ? <Divider /> : null}
        </>
    );
}

interface IDialogContentProps {
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
    needScroll?: boolean;
}

function Content(props: IDialogContentProps) {
    const { children, style, needScroll } = props;

    const content =
        typeof children === "string" ? (
            <ThemeText fontSize="content" style={styles.defaultFontStyle}>
                {children}
            </ThemeText>
        ) : (
            children
        );

    return (
        <View
            style={[
                styles.contentContainer,
                {
                    maxHeight: vh(50),
                },
                style,
            ]}>
            {needScroll ? <ScrollView>{content}</ScrollView> : content}
        </View>
    );
}

interface IDialogActionsProps {
    children?: ReactNode;
    actions?: Array<{
        title: string;
        type?: "normal" | "primary";
        show?: boolean;
        onPress?: () => void;
    }>;
    style?: StyleProp<ViewStyle>;
}

function Actions(props: IDialogActionsProps) {
    const { children, style, actions } = props;

    const validActions = useMemo(
        () => actions?.filter(it => it.show !== false),
        [actions],
    );

    const _children = validActions?.length ? (
        <>
            {validActions.map((it, index) =>
                it.show === false ? null : (
                    <BottomButton
                        key={index}
                        style={index === 0 ? null : styles.actionButton}
                        onPress={it.onPress}
                        text={it.title}
                        type={it.type}
                    />
                ),
            )}
        </>
    ) : (
        children
    );

    return (
        <View style={[styles.actionsContainer, style]}>
            {typeof children === "string" ? (
                <ThemeText fontSize="content" numberOfLines={1}>
                    {children}
                </ThemeText>
            ) : (
                _children
            )}
        </View>
    );
}

function BottomButton(props: {
    type?: "normal" | "primary";
    text: string;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
}) {
    const { type = "normal", text, style, onPress } = props;
    const colors = useColors();

    const hasCustomBackground = useHasCustomBackground();

    // 主色上的文字色由 useColors 按对比度算好，避免亮主色上出现白底白字
    const primaryFontColor = colors.onPrimary ?? "white";

    return (
        <TouchableOpacity
            activeOpacity={0.6}
            onPress={onPress}
            style={[
                styles.bottomBtn,
                {
                    backgroundColor:
                        type === "normal" ? colors.surface : colors.primary,
                    borderColor:
                        type === "primary"
                            ? colors.primary
                            : hasCustomBackground
                                ? "transparent"
                                : colors.border,
                    borderWidth:
                        type === "primary" || !hasCustomBackground
                            ? StyleSheet.hairlineWidth
                            : 0,
                },
                style,
            ]}>
            <ThemeText
                fontWeight="semibold"
                color={type === "normal" ? undefined : primaryFontColor}>
                {text}
            </ThemeText>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    bottomBtn: {
        borderRadius: rpx(36),
        borderWidth: StyleSheet.hairlineWidth,
        flex: 1,
        flexShrink: 0,
        justifyContent: "center",
        alignItems: "center",
        height: rpx(72),
    },
    backContainer: {
        position: "absolute",
        zIndex: 16299,
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        alignItems: "center",
        justifyContent: "center",
    },
    container: {
        zIndex: 16300,
        position: "absolute",
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    dialogContainer: {
        position: "absolute",
        width: "80%",
        zIndex: 16310,
        borderRadius: rpx(28),
        backgroundColor: "red",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowRadius: 4,
    },

    defaultFontStyle: {
        lineHeight: fontSizeConst.content * 1.5,
    },

    /**** title */
    titleContainer: {
        // 用 minHeight 而不是写死高度：title 字号行高已接近 rpx(88)，
        // 固定高度会把标题顶出容器外
        minHeight: rpx(88),
        width: "100%",
        alignItems: "flex-start",
        justifyContent: "center",
        flexDirection: "row",
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(8),
    },
    /** content */
    contentContainer: {
        width: "100%",
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(36),
    },
    /** actions */
    actionsContainer: {
        width: "100%",
        height: rpx(88),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingHorizontal: rpx(24),
        marginBottom: rpx(12),
        flexWrap: "nowrap",
    },
    actionButton: {
        marginLeft: rpx(24),
    },
});

Dialog.Title = Title;
Dialog.Content = Content;
Dialog.Actions = Actions;

export default Dialog;
