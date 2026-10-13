import React, { Fragment, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PanelBase from "../base/panelBase";
import { hidePanel } from "../usePanel";
import ListItem from "@/components/base/listItem";
import PanelHeader from "../base/panelHeader";
import ThemeText from "@/components/base/themeText";
import type { IIconName } from "@/components/base/icon";
import useColors from "@/hooks/useColors";
import Divider from "@/components/base/divider";

export interface IDownloadTaskOption {
    key: string;
    title: string;
    icon: IIconName;
    /** 右侧灰色说明，用来写清后果（如「保留文件」/「32.4MB」） */
    hint?: string;
    danger?: boolean;
    onPress: () => void;
}

interface IDownloadTaskOptionsProps {
    /** 标题：歌曲名 */
    title: string;
    /** 副标题：只写列表行里没有的信息（下载页当前只传歌手），避免与行内重复 */
    subtitle?: string;
    options: IDownloadTaskOption[];
}

const ACTION_DELAY_MS = 350;

/**
 * 下载任务的单条操作菜单（issue #87）。
 *
 * 与 SimpleSelect 的区别：支持图标、右侧后果说明和危险色，
 * 并且破坏性操作一律放在列表底部——原型评审时定下的规则是
 * 「移除记录 ≠ 删除文件」，两条要在视觉上分开且各自写明后果。
 */
export default function DownloadTaskOptions(props: IDownloadTaskOptionsProps) {
    const { title, subtitle, options = [] } = props ?? ({} as IDownloadTaskOptionsProps);

    const safeAreaInsets = useSafeAreaInsets();
    const colors = useColors();
    const actionPendingRef = useRef(false);

    const handlePress = (option: IDownloadTaskOption) => {
        if (actionPendingRef.current) {
            return;
        }
        actionPendingRef.current = true;
        hidePanel();
        // PanelBase 跑在原生 Modal 里，iOS 上未 dismiss 就拉起下一个控制器会卡死
        setTimeout(() => {
            option.onPress();
        }, ACTION_DELAY_MS);
    };

    return (
        <PanelBase
            height={rpx(560)}
            renderBody={() => (
                <>
                    <PanelHeader title={title} hideButtons />
                    {subtitle ? (
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            numberOfLines={1}
                            style={styles.subtitle}>
                            {subtitle}
                        </ThemeText>
                    ) : null}
                    <Divider />
                    <ScrollView
                        style={[
                            styles.body,
                            { marginBottom: safeAreaInsets.bottom },
                        ]}>
                        {options.map(option => (
                            <Fragment key={option.key}>
                                <ListItem
                                    heightType="small"
                                    withHorizontalPadding
                                    onPress={() => handlePress(option)}>
                                    <ListItem.ListItemIcon
                                        icon={option.icon}
                                        color={option.danger ? colors.danger : colors.text}
                                    />
                                    <ListItem.Content
                                        title={
                                            <ThemeText
                                                numberOfLines={1}
                                                style={option.danger
                                                    ? { color: colors.danger }
                                                    : undefined}>
                                                {option.title}
                                            </ThemeText>
                                        }
                                    />
                                    {option.hint ? (
                                        <View style={styles.hintWrapper}>
                                            <ThemeText
                                                fontSize="description"
                                                fontColor="textSecondary"
                                                numberOfLines={1}>
                                                {option.hint}
                                            </ThemeText>
                                        </View>
                                    ) : null}
                                </ListItem>
                            </Fragment>
                        ))}
                    </ScrollView>
                </>
            )}
        />
    );
}

const styles = StyleSheet.create({
    body: {
        flex: 1,
    },
    subtitle: {
        paddingHorizontal: rpx(24),
        paddingBottom: rpx(16),
        marginTop: -rpx(8),
    },
    hintWrapper: {
        paddingLeft: rpx(24),
        flexShrink: 0,
        maxWidth: rpx(260),
    },
});
