import React from "react";
import { PageState } from "@/components/base/pageSection";
import { useI18N } from "@/core/i18n";
export default function DefaultResults() {
    const { t } = useI18N();
    return <PageState title={t("searchPage.comingSoon")} />;
}
