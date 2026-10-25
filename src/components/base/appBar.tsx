import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
    LayoutRectangle,
    Pressable,
    StyleProp,
    StyleSheet,
    TouchableWithoutFeedback,
    View,
    ViewStyle,
} from "react-native";
import rpx from "@/utils/rpx";
import { controlSize, spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import useHasCustomBackground from "@/hooks/useHasCustomBackground";
import StatusBar from "./statusBar";
import color from "color";
import IconButton from "./iconButton";
import globalStyle from "@/constants/globalStyle";
import { iconSizeConst } from "@/constants/uiConst";
import ThemeText from "./themeText";
import { useNavigation } from "@react-navigation/native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import Portal from "./portal";
import ListItem from "./listItem";
import { IIconName } from "@/components/base/icon.tsx";
import useMotion from "@/hooks/useMotion";
import Theme from "@/core/theme";

interface IAppBarProps {
    titleTextOpacity?: number;
    withStatusBar?: boolean;
    color?: string;
    actions?: Array<{
        icon: IIconName;
        accessibilityLabel?: string;
        onPress?: () => void;
    }>;
    menu?: Array<{
        icon: IIconName;
        title: string;
        show?: boolean;
        onPress?: () => void;
    }>;
    children?: string | ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    actionComponent?: ReactNode;
    onBackPress?: () => void;
}

export default function AppBar(props: IAppBarProps) {
    const {
        titleTextOpacity = 1,
        withStatusBar,
        color: _color,
        actions = [],
        menu = [],
        containerStyle,
        contentStyle,
        children,
        actionComponent,
        onBackPress,
    } = props;

    const colors = useColors();
    const { t } = useI18N();
    const hasCustomBackground = useHasCustomBackground();
    const navigation = useNavigation();

    const bgColor = color(colors.appBar ?? colors.primary).toString();
    const contentColor = _color ?? colors.appBarText;

    const [showMenu, setShowMenu] = useState(false);
    const [menuIconLayout, setMenuIconLayout] =
        useState<(LayoutRectangle & { hostWidth: number }) | null>(null);
    const menuButtonRef = useRef<View>(null);
    const portalRootRef = useRef<View>(null);
    const measurementRef = useRef(0);
    const scaleRate = useSharedValue(0);
    const motion = useMotion();

    const closeMenu = useCallback(() => {
        measurementRef.current += 1;
        setShowMenu(false);
    }, []);

    const openMenu = () => {
        const request = ++measurementRef.current;
        menuButtonRef.current?.measureInWindow((x, y, width, height) => {
            if (request !== measurementRef.current || width <= 0 || height <= 0) return;
            portalRootRef.current?.measureInWindow((hostX, hostY, hostWidth, hostHeight) => {
                if (request !== measurementRef.current || hostWidth <= 0 || hostHeight <= 0) return;
                // The button lives inside a pane; the Portal lives at the app root.
                // Measure both in the window so navigation and safe-area offsets cancel correctly.
                setMenuIconLayout({ x: x - hostX, y: y - hostY, width, height, hostWidth });
                setShowMenu(true);
            });
        });
    };

    useEffect(() => () => {
        measurementRef.current += 1;
    }, []);

    useEffect(() => {
        if (showMenu) {
            scaleRate.value = motion.timing(1, {
                duration: "fast",
                easing: "decelerate",
            });
        } else {
            scaleRate.value = motion.timing(0, {
                duration: "fast",
                easing: "accelerate",
            });
        }
    }, [showMenu, scaleRate, motion]);

    const transformStyle = useAnimatedStyle(() => {
        return {
            opacity: scaleRate.value,
        };
    });

    return (
        <>
            {withStatusBar ? <StatusBar backgroundColor={bgColor} /> : null}
            <View
                onLayout={closeMenu}
                style={[
                    styles.container,
                    containerStyle,
                    {
                        backgroundColor: bgColor,
                        borderBottomColor: colors.border,
                    },
                ]}>
                <Pressable accessibilityRole="button" accessibilityLabel={t("subpage.back")} style={styles.navButton}
                    onPress={onBackPress || (() => navigation.goBack())}>
                    <IconButton name="arrow-left" sizeType="normal" color={contentColor} style={styles.navIcon} />
                </Pressable>
                <View style={[globalStyle.grow, styles.content, contentStyle]}>
                    {typeof children === "string" ? (
                        <ThemeText
                            fontSize="title"
                            fontWeight="semibold"
                            numberOfLines={1}
                            color={
                                titleTextOpacity !== 1
                                    ? color(contentColor)
                                        .alpha(titleTextOpacity)
                                        .toString()
                                    : contentColor
                            }>
                            {children}
                        </ThemeText>
                    ) : (
                        children
                    )}
                </View>
                {actions.map((action, index) => (
                    <Pressable key={index} accessibilityRole="button" accessibilityLabel={action.accessibilityLabel ?? (action.icon === "magnifying-glass" ? t("common.search") : undefined)}
                        style={[styles.navButton, styles.rightButton]} onPress={action.onPress}>
                        <IconButton name={action.icon} sizeType="normal" color={contentColor} style={styles.navIcon} />
                    </Pressable>
                ))}
                {actionComponent ?? null}
                {menu?.length ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={t("subpage.more")} style={[styles.navButton, styles.rightButton]}
                        ref={menuButtonRef} testID="app-bar-menu-anchor" collapsable={false}
                        accessibilityState={{ expanded: showMenu }} onLayout={closeMenu} onPress={openMenu}>
                        <IconButton name="ellipsis-vertical" sizeType="normal" color={contentColor} style={styles.navIcon} />
                    </Pressable>
                ) : null}
            </View>
            <Portal>
                <View ref={portalRootRef} testID="app-bar-menu-overlay" collapsable={false}
                    pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={closeMenu}>
                    {showMenu ? (
                        <TouchableWithoutFeedback
                            onPress={closeMenu}>
                            <View style={styles.blocker} />
                        </TouchableWithoutFeedback>
                    ) : null}
                    <Animated.View
                        testID="app-bar-menu-corner"
                        pointerEvents={showMenu ? "auto" : "none"}
                        style={[
                            {
                                borderBottomColor: hasCustomBackground ? Theme.getDialogSurfaceColor() : colors.surfaceElevated,
                                left:
                                    (menuIconLayout?.x ?? 0) +
                                    (menuIconLayout?.width ?? 0) / 2 -
                                    rpx(10),
                                top:
                                    (menuIconLayout?.y ?? 0) +
                                    (menuIconLayout?.height ?? 0),
                            },
                            transformStyle,
                            styles.bubbleCorner,
                        ]}
                    />
                    <Animated.View
                        testID="app-bar-menu"
                        pointerEvents={showMenu ? "auto" : "none"}
                        style={[
                            {
                                // 有壁纸时菜单用更实的暗底，避免透出壁纸看不清
                                backgroundColor: hasCustomBackground
                                    ? Theme.getDialogSurfaceColor()
                                    : colors.surfaceElevated,
                                borderColor: hasCustomBackground
                                    ? "transparent"
                                    : colors.border,
                                borderWidth: hasCustomBackground
                                    ? 0
                                    : StyleSheet.hairlineWidth,
                                right: Math.max(rpx(24), (menuIconLayout?.hostWidth ?? 0) -
                                    (menuIconLayout?.x ?? 0) - (menuIconLayout?.width ?? 0)),
                                top:
                                    (menuIconLayout?.y ?? 0) +
                                    (menuIconLayout?.height ?? 0) +
                                    rpx(20),
                                shadowColor: hasCustomBackground
                                    ? "transparent"
                                    : colors.shadow,
                                shadowOpacity: hasCustomBackground ? 0 : 0.23,
                                elevation: hasCustomBackground ? 0 : 4,
                            },
                            transformStyle,
                            styles.menu,
                        ]}>
                        {menu.map(it =>
                            it.show !== false ? (
                                <ListItem
                                    key={it.title}
                                    withHorizontalPadding
                                    heightType="small"
                                    onPress={() => {
                                        closeMenu();
                                        // async
                                        setTimeout(() => {
                                            it.onPress?.();
                                        }, 20);
                                    }}>
                                    <ListItem.ListItemIcon icon={it.icon} />
                                    <ListItem.Content title={it.title} />
                                </ListItem>
                            ) : null,
                        )}
                    </Animated.View>
                </View>
            </Portal>
        </>
    );
}

const styles = StyleSheet.create({
    navButton: { minWidth: Math.max(44, controlSize.minimumTouch), minHeight: Math.max(44, controlSize.minimumTouch), flexShrink: 0, alignItems: "center", justifyContent: "center" },
    navIcon: { minWidth: iconSizeConst.normal, height: iconSizeConst.normal },
    container: {
        width: "100%",
        zIndex: 10000,
        minHeight: Math.max(48, controlSize.standard),
        paddingVertical: spacing.xxs,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(24),
        borderBottomWidth: 0,
    },
    content: {
        flexDirection: "row",
        flexBasis: 0,
        minWidth: 0,
        alignItems: "center",
        paddingHorizontal: rpx(24),
    },
    rightButton: {
        marginLeft: spacing.xs,
        minWidth: Math.max(44, controlSize.minimumTouch),
        minHeight: Math.max(44, controlSize.minimumTouch),
    },
    blocker: {
        position: "absolute",
        bottom: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 10010,
    },
    bubbleCorner: {
        position: "absolute",
        borderColor: "transparent",
        borderWidth: rpx(10),
        zIndex: 10012,
        transformOrigin: "right top",
        opacity: 0,
    },
    menu: {
        width: rpx(340),
        maxHeight: rpx(600),
        borderRadius: rpx(18),
        zIndex: 10011,
        position: "absolute",
        opacity: 0,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowRadius: 2.62,
    },
});
