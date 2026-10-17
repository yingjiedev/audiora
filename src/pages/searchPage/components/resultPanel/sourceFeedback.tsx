import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAtomValue } from "jotai";
import ThemeText from "@/components/base/themeText";
import Icon from "@/components/base/icon";
import { PageAction } from "@/components/base/pageSection";
import { showPanel } from "@/components/panels/usePanel";
import { elevation, radius, spacing } from "@/constants/designSystem";
import { RequestStateCode } from "@/constants/commonConst";
import { useI18N } from "@/core/i18n";
import PluginManager, { usePluginDisplayNameResolver } from "@/core/pluginManager";
import { useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import useSearch from "../../hooks/useSearch";
import { ISearchResult, searchResultsAtom, searchSessionAtom } from "../../store/atoms";
import { getSourcePopoverColors, getSourcePopoverLayout, SourceAnchor } from "./sourcePopover";

type Result = ISearchResult<ICommon.SupportMediaType>;
interface SourceActions {
    search: ReturnType<typeof useSearch>;
    onManage: () => void;
    onDismiss?: (after: () => void) => void;
}

function isPending(result?: Result) {
    return !result || result.state === RequestStateCode.IDLE || result.state === RequestStateCode.PENDING_FIRST_PAGE || result.state === RequestStateCode.PENDING_REST_PAGE;
}

export function SourceIssue({ pluginHash, result, type, search, onManage, onDismiss, standalone = false, title, palette }: SourceActions & {
    pluginHash: string; result: Result; type: ICommon.SupportMediaType; standalone?: boolean;
    title?: string; palette?: ReturnType<typeof getSourcePopoverColors>;
}) {
    const { t } = useI18N();
    const getDisplayName = usePluginDisplayNameResolver();
    const deferred = result.phase === "deferred";
    const kind = result.error?.kind ?? "plugin";
    const retryable = deferred || result.error?.retryable !== false;
    const plugin = PluginManager.getByHash(pluginHash);
    const configurable = (kind === "configuration" || kind === "authentication") && !!plugin?.instance.userVariables?.length;
    const afterDismiss = (action: () => void) => {
        if (onDismiss) onDismiss(action);
        else action();
    };
    return <View style={[styles.issue, standalone && styles.standalone, title !== undefined && styles.detailRow]}>
        <View style={title !== undefined ? styles.detailText : undefined}>
            {title !== undefined ? <ThemeText allowFontScaling numberOfLines={1} fontWeight="medium" color={palette?.text}>{title}</ThemeText> : null}
            <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary" color={palette?.secondary}>{t(deferred ? "aggregate.sourceDeferred" : `aggregate.error.${kind}`)}</ThemeText>
            {title === undefined && result.error?.status ? <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">{t("aggregate.httpStatus", { status: result.error.status })}</ThemeText> : null}
        </View>
        <View style={[styles.actions, title !== undefined && styles.compactActions]}>
            {retryable ? <PageAction allowFontScaling variant={title !== undefined ? "tonal" : "text"} title={t(deferred ? "aggregate.continueSource" : "aggregate.retry")}
                onPress={() => search(undefined, undefined, type, pluginHash, "retry")} /> : null}
            {configurable && plugin ? <PageAction allowFontScaling variant={title !== undefined ? "tonal" : "text"} title={t("aggregate.configureSource")} onPress={() => afterDismiss(() => {
                showPanel("SetUserVariables", {
                    title: getDisplayName(plugin),
                    variables: plugin.instance.userVariables!,
                    initValues: PluginManager.getUserVariables(plugin),
                    onOk(values, closePanel) {
                        PluginManager.setUserVariables(plugin, values);
                        closePanel();
                        search(undefined, undefined, type, pluginHash, "retry");
                    },
                });
            })} /> : null}
            {!retryable && !configurable ? <PageAction allowFontScaling variant={title !== undefined ? "tonal" : "text"} title={t("aggregate.manageSources")}
                onPress={() => afterDismiss(onManage)} /> : null}
        </View>
    </View>;
}

interface OpenDetails {
    anchor: SourceAnchor;
    hashes: string[];
    sourceKey: string;
    session: number;
    width: number;
    height: number;
}

/** One fixed-width trigger beside source tabs; details never enter the song list. */
export default function SourceFeedback({ plugins, type }: { plugins: { hash: string }[]; type: ICommon.SupportMediaType }) {
    const results = useAtomValue(searchResultsAtom)[type];
    const session = useAtomValue(searchSessionAtom);
    const { t } = useI18N();
    const colors = useColors();
    const palette = useMemo(() => getSourcePopoverColors(colors), [colors]);
    const search = useSearch();
    const navigate = useNavigate();
    const getDisplayName = usePluginDisplayNameResolver();
    const window = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const trigger = useRef<View>(null);
    const modalRoot = useRef<View>(null);
    const pendingAction = useRef<(() => void) | undefined>(undefined);
    const [open, setOpen] = useState<OpenDetails | null>(null);
    const [viewport, setViewport] = useState({ x: 0, y: 0, width: window.width, height: window.height });
    const sourceKey = plugins.map(plugin => plugin.hash).join("|");
    const latest = useRef({ session, sourceKey, mounted: true });
    latest.current.session = session;
    latest.current.sourceKey = sourceKey;
    useEffect(() => {
        const state = latest.current;
        state.mounted = true;
        return () => {
            state.mounted = false; pendingAction.current = undefined;
        };
    }, []);
    const flushAction = useCallback(() => {
        const action = pendingAction.current;
        pendingAction.current = undefined;
        if (latest.current.mounted) action?.();
    }, []);
    useEffect(() => {
        if (open && (open.session !== session || open.sourceKey !== sourceKey || open.width !== window.width || open.height !== window.height)) {
            pendingAction.current = undefined;
            setOpen(null);
        }
    }, [open, session, sourceKey, window.width, window.height]);
    useEffect(() => {
        // iOS must finish dismissing its native controller before opening a panel.
        if (open || Platform.OS === "ios" || !pendingAction.current) return;
        const frame = requestAnimationFrame(flushAction);
        return () => cancelAnimationFrame(frame);
    }, [open, flushAction]);
    const validOpen = open?.session === session && open.sourceKey === sourceKey ? open : null;
    const values = plugins.map(plugin => results[plugin.hash]);
    const pending = values.filter(isPending).length;
    const issues = values.filter(result => result?.state === RequestStateCode.ERROR);
    const responded = values.filter(result => result?.state === RequestStateCode.PARTLY_DONE || result?.state === RequestStateCode.FINISHED).length;
    const retryable = issues.some(result => result.phase === "deferred" || result.error?.retryable !== false);
    const retryDisabled = !!pending || !retryable;
    const retry = () => {
        if (!retryDisabled) search(undefined, undefined, type, undefined, "retry");
    };
    const dismiss = (after?: () => void) => {
        pendingAction.current = after ? () => {
            if (latest.current.session === session && latest.current.sourceKey === sourceKey) after();
        } : undefined;
        setOpen(null);
    };
    const layout = validOpen ? getSourcePopoverLayout({ ...validOpen.anchor, x: validOpen.anchor.x - viewport.x, y: validOpen.anchor.y - viewport.y }, viewport, {
        ...insets, top: Math.max(0, insets.top - viewport.y),
    }) : null;
    const summary = t("aggregate.sourceSummary", { count: responded, total: plugins.length });
    const progress = pending ? t(issues.length ? "aggregate.pendingWithIssues" : "aggregate.pendingSources", { count: pending, failed: issues.length })
        : t(issues.length ? "aggregate.issueCount" : "aggregate.searchFinished", { count: issues.length });
    if (!plugins.length) return null;
    return <>
        <View ref={trigger} collapsable={false}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${t("aggregate.sourceDetails")}，${summary}，${progress}`}
                accessibilityState={{ expanded: !!validOpen, busy: !!pending }} onPress={() => {
                    Keyboard.dismiss();
                    trigger.current?.measureInWindow((x, y, width, height) => {
                        if (!width || !height || !latest.current.mounted || session !== latest.current.session || sourceKey !== latest.current.sourceKey) return;
                        setOpen({ anchor: { x, y, width, height }, session, sourceKey, width: window.width, height: window.height,
                            hashes: plugins.map(plugin => plugin.hash).sort((a, b) => Number(results[b]?.state === RequestStateCode.ERROR) - Number(results[a]?.state === RequestStateCode.ERROR)),
                        });
                    });
                }} style={({ pressed }) => [styles.trigger, { opacity: pressed ? 0.7 : 1 }]}>
                <View pointerEvents="none" style={[styles.triggerFill, { backgroundColor: colors.tonalSurface }]}>
                    <ThemeText allowFontScaling fontWeight="medium" color={colors.onTonal} numberOfLines={1}>{responded}/{plugins.length}</ThemeText>
                    {pending ? <ActivityIndicator size="small" color={colors.onTonal} /> : <Icon name="information-circle" size={16} color={colors.onTonal} />}
                </View>
            </Pressable>
        </View>
        <Modal visible={!!validOpen} transparent statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" animationType="none"
            onRequestClose={() => dismiss()} onDismiss={flushAction}>
            {validOpen && layout ? <View ref={modalRoot} style={styles.modalRoot} onLayout={event => {
                const { width, height } = event.nativeEvent.layout;
                modalRoot.current?.measureInWindow((x, y) => setViewport({ x, y, width, height }));
            }}>
                <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")} style={StyleSheet.absoluteFill}
                    onPress={() => dismiss()} />
                <View accessibilityViewIsModal importantForAccessibility="yes" onAccessibilityEscape={() => dismiss()}
                    style={[styles.popover, { left: layout.left, top: layout.top, width: layout.width, maxHeight: layout.maxHeight,
                        backgroundColor: palette.surface, shadowColor: colors.shadow, borderColor: colors.border }]}>
                    {layout.showPointer ? <Icon pointerEvents="none" name="play" size={24} color={palette.surface}
                        style={[styles.pointer, { left: layout.pointerLeft }]} /> : null}
                    <View style={[styles.heading, { borderBottomColor: colors.divider }]}>
                        <ThemeText allowFontScaling accessibilityRole="header" fontWeight="semibold" color={palette.text}>{t("aggregate.all")}</ThemeText>
                        <Pressable accessibilityRole="button" accessibilityLabel={t("aggregate.retryIncomplete")}
                            accessibilityState={{ disabled: retryDisabled, busy: !!pending }} disabled={retryDisabled} onPress={retry}
                            style={({ pressed }) => [styles.retry, { opacity: retryDisabled ? 0.45 : pressed ? 0.7 : 1 }]}>
                            <View pointerEvents="none" style={[styles.retryFill, { backgroundColor: colors.tonalSurface }]}>
                                {pending ? <ActivityIndicator size="small" color={colors.onTonal} /> : <Icon name="arrow-path" size={20} color={colors.onTonal} />}
                            </View>
                        </Pressable>
                    </View>
                    <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent} keyboardShouldPersistTaps="handled">
                        {validOpen.hashes.map(hash => {
                            const plugin = PluginManager.getByHash(hash);
                            if (!plugin) return null;
                            const result = results[hash];
                            const name = getDisplayName(plugin);
                            const status = isPending(result) ? t(result?.phase === "loading" ? "aggregate.sourceSearching" : "aggregate.sourceQueued")
                                : result?.data.length ? t("aggregate.sourceReturned", { count: result.data.length }) : t("aggregate.sourceEmpty");
                            return <View key={hash} style={[styles.detail, { borderBottomColor: colors.divider }]}>
                                {result?.state === RequestStateCode.ERROR ? <SourceIssue title={name} palette={palette} pluginHash={hash} result={result} type={type} search={search}
                                    onDismiss={after => dismiss(after)} onManage={() => navigate("setting", { type: "plugin" })} />
                                    : <View style={styles.detailRow}><View style={styles.detailText}>
                                        <ThemeText allowFontScaling numberOfLines={1} fontWeight="medium" color={palette.text}>{name}</ThemeText>
                                        <ThemeText allowFontScaling fontSize="description" color={palette.secondary}>{status}</ThemeText>
                                    </View></View>}
                            </View>;
                        })}
                    </ScrollView>
                </View>
            </View> : null}
        </Modal>
    </>;
}

const styles = StyleSheet.create({
    trigger: { minHeight: 44, minWidth: 78, flexShrink: 0, alignItems: "center", justifyContent: "center" },
    triggerFill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, minHeight: 32, borderRadius: radius.sm },
    modalRoot: { flex: 1 },
    popover: { position: "absolute", borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, ...elevation.mid },
    pointer: { position: "absolute", top: -13, transform: [{ rotate: "-90deg" }] },
    heading: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm,
        paddingLeft: spacing.xl, paddingRight: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
    retry: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
    retryFill: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    details: { flexShrink: 1, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
    detailsContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
    detail: { borderBottomWidth: StyleSheet.hairlineWidth },
    detailRow: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingVertical: spacing.sm },
    detailText: { flex: 1, minWidth: 0, gap: spacing.xs },
    issue: { gap: spacing.xs },
    standalone: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.lg },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, flexShrink: 1 },
    compactActions: { maxWidth: "48%" },
});
