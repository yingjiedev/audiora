import React from "react";
import { useI18N } from "@/core/i18n";
import { PageState } from "./pageSection";
export default function Empty({ content }: { content?: string }) {
    const { t } = useI18N();
    return <PageState title={content || t("common.emptyList")} />;
}
