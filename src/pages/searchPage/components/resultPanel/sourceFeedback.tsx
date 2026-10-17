import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useAtomValue } from "jotai";
import ThemeText from "@/components/base/themeText";
import { PageAction } from "@/components/base/pageSection";
import { hideDialog, showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { spacing } from "@/constants/designSystem";
import { RequestStateCode } from "@/constants/commonConst";
import { useI18N } from "@/core/i18n";
import PluginManager, { usePluginDisplayNameResolver, useSearchablePlugins } from "@/core/pluginManager";
import { useNavigate } from "@/core/router";
import useSearch from "../../hooks/useSearch";
import { ISearchResult, searchResultsAtom, searchSessionAtom } from "../../store/atoms";

type Result = ISearchResult<ICommon.SupportMediaType>;
interface SourceActions {
    search: ReturnType<typeof useSearch>;
    onManage: () => void;
}

function isPending(result?: Result) {
    return !result || result.state === RequestStateCode.PENDING_FIRST_PAGE || result.state === RequestStateCode.PENDING_REST_PAGE;
}

export function SourceIssue({ pluginHash, result, type, search, onManage, standalone = false }: SourceActions & { pluginHash: string; result: Result; type: ICommon.SupportMediaType; standalone?: boolean }) {
    const { t } = useI18N();
    const getDisplayName = usePluginDisplayNameResolver();
    const deferred = result.phase === "deferred";
    const kind = result.error?.kind ?? "plugin";
    const retryable = deferred || result.error?.retryable !== false;
    const plugin = PluginManager.getByHash(pluginHash);
    const configurable = (kind === "configuration" || kind === "authentication") && !!plugin?.instance.userVariables?.length;
    return (
        <View style={[styles.issue, standalone && styles.standalone]}>
            <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">{t(deferred ? "aggregate.sourceDeferred" : `aggregate.error.${kind}`)}</ThemeText>
            {result.error?.status ? <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">{t("aggregate.httpStatus", { status: result.error.status })}</ThemeText> : null}
            <View style={styles.actions}>
                {retryable ? <PageAction allowFontScaling variant="text" title={t(deferred ? "aggregate.continueSource" : "aggregate.retry")}
                    onPress={() => search(undefined, undefined, type, pluginHash, "retry")} /> : null}
                {configurable && plugin ? <PageAction allowFontScaling variant="text" title={t("aggregate.configureSource")} onPress={() => {
                    hideDialog();
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
                }} /> : null}
                {!retryable && !configurable ? <PageAction allowFontScaling variant="text" title={t("aggregate.manageSources")} onPress={() => {
                    hideDialog();
                    onManage();
                }} /> : null}
            </View>
        </View>
    );
}

function SourceDetails({ hashes, type, session, search, onManage }: SourceActions & { hashes: string[]; type: ICommon.SupportMediaType; session: number }) {
    const available = new Map(useSearchablePlugins(type).map(plugin => [plugin.hash, plugin]));
    // Snapshot failure-first ordering when opening, then keep rows stable during retries.
    const plugins = hashes.flatMap(hash => {
        const plugin = available.get(hash);
        return plugin ? [plugin] : [];
    });
    const results = useAtomValue(searchResultsAtom)[type];
    const currentSession = useAtomValue(searchSessionAtom);
    const { t } = useI18N();
    const getDisplayName = usePluginDisplayNameResolver();
    useEffect(() => {
        if (session !== currentSession || !plugins.length) hideDialog();
    }, [session, currentSession, plugins.length]);
    return (
        <View style={styles.details}>
            {plugins.map(plugin => {
                const result = results[plugin.hash];
                const issue = result?.state === RequestStateCode.ERROR;
                const status = isPending(result) ? t(result?.phase === "loading" ? "aggregate.sourceSearching" : "aggregate.sourceQueued")
                    : result?.data.length ? t("aggregate.sourceReturned", { count: result.data.length }) : t("aggregate.sourceEmpty");
                return <View key={plugin.hash} style={styles.detail}>
                    <ThemeText allowFontScaling fontWeight="medium">{getDisplayName(plugin)}</ThemeText>
                    {issue ? <SourceIssue pluginHash={plugin.hash} type={type} result={result} search={search} onManage={onManage} />
                        : <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">{status}</ThemeText>}
                    {result?.elapsedMs !== undefined ? <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">
                        {t("aggregate.sourceTiming", { page: result.requestedPage ?? result.page ?? 1, seconds: (result.elapsedMs / 1000).toFixed(1) })}
                    </ThemeText> : null}
                </View>;
            })}
        </View>
    );
}

/** The summary always occupies the same two text lines; failures never push songs down. */
export default function SourceFeedback({ plugins, results, type, session }: {
    plugins: { hash: string }[];
    results: Record<string, Result>;
    type: ICommon.SupportMediaType;
    session: number;
}) {
    const { t } = useI18N();
    const search = useSearch();
    const navigate = useNavigate();
    const values = plugins.map(plugin => results[plugin.hash]);
    const pending = values.filter(isPending).length;
    const issues = values.filter(result => result?.state === RequestStateCode.ERROR);
    const responded = values.filter(result => result?.state === RequestStateCode.PARTLY_DONE || result?.state === RequestStateCode.FINISHED).length;
    const retryable = issues.some(result => result.phase === "deferred" || result.error?.retryable !== false);
    return (
        <View style={styles.summary}>
            <View style={styles.summaryRow}>
                <View style={styles.summaryText} accessibilityLiveRegion="polite">
                    <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">{t("aggregate.sourceSummary", { count: responded, total: plugins.length })}</ThemeText>
                    <ThemeText allowFontScaling fontSize="description" fontColor="textSecondary">
                        {pending ? t(issues.length ? "aggregate.pendingWithIssues" : "aggregate.pendingSources", { count: pending, failed: issues.length })
                            : t(issues.length ? "aggregate.issueCount" : "aggregate.searchFinished", { count: issues.length })}
                    </ThemeText>
                </View>
                <PageAction allowFontScaling variant="text" title={t("aggregate.sourceDetails")} onPress={() => showDialog("SimpleDialog", {
                    title: t("aggregate.sourceDetails"),
                    // Global dialogs are outside the screen route context. Capture
                    // scoped actions here; the live dialog never calls route hooks.
                    content: <SourceDetails hashes={plugins.map(plugin => plugin.hash).sort((a, b) => Number(results[b]?.state === RequestStateCode.ERROR) - Number(results[a]?.state === RequestStateCode.ERROR))} type={type} session={session}
                        search={search} onManage={() => navigate("setting", { type: "plugin" })} />,
                })} />
                <PageAction allowFontScaling variant="text" title={t("aggregate.retryIncomplete")} disabled={!!pending || !retryable}
                    onPress={() => search(undefined, undefined, type, undefined, "retry")} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    summary: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.sm },
    summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
    summaryText: { flex: 1, minWidth: 120 },
    details: { gap: spacing.lg },
    detail: { gap: spacing.xs },
    issue: { gap: spacing.xs },
    standalone: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.lg },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
