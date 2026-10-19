import React from "react";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { PageAction, PageState } from "./pageSection";
export default function NoPlugin({ notSupportType }: { notSupportType?: string }) {
    const { t } = useI18N();
    const navigate = useNavigate();
    return <PageState title={notSupportType ? t("noPlugin.titleWithType", { type: notSupportType }) : t("noPlugin.title")} description={t("noPlugin.description")}
        action={<PageAction title={t("sidebar.pluginManagement")} onPress={() => navigate(ROUTE_PATH.SETTING, { type: "plugin" })} />} />;
}
