import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { RequestStateCode } from "@/constants/commonConst";
import { spacing } from "@/constants/designSystem";
import { useI18N } from "@/core/i18n";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import ThemeText from "./themeText";
import { PageAction, PageState } from "./pageSection";
export default function ListEmpty({ state, onRetry }: { state: RequestStateCode; onRetry?: () => void }) {
    const colors = useColors();
    const { t } = useI18N();
    if (state === RequestStateCode.PENDING_FIRST_PAGE || state === RequestStateCode.PENDING_REST_PAGE) {
        return <View style={styles.loading}><ActivityIndicator color={colors.primaryText} /><ThemeText fontColor="textSecondary">{t("common.loading")}</ThemeText></View>;
    }
    if (state === RequestStateCode.ERROR) return <PageState icon="x-mark" title={t("common.failToLoad")} tone="danger" action={onRetry ? <PageAction title={t("common.clickToRetry")} icon="arrow-path" onPress={onRetry} /> : undefined} />;
    return <PageState title={t("common.emptyList")} />;
}
const styles = StyleSheet.create({ loading: { minHeight: rpx(360), padding: spacing.xxxl, alignItems: "center", justifyContent: "center", gap: spacing.md } });
