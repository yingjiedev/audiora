import React from "react";

import { useI18N } from "@/core/i18n";
import Theme, {
    DEFAULT_BACKGROUND_BLUR,
    DEFAULT_BACKGROUND_OPACITY,
} from "@/core/theme";
import SliderRow from "./sliderRow";

/**
 * 背景模糊 / 透明度滑杆的唯一实现。
 *
 * 这两条滑杆原本在 `setCustomTheme/body.tsx` 和
 * `setting/settingTypes/themeSetting/backgroundTuning.tsx` 各写了一份，
 * 底层都是 `Theme.setBackground`，属于典型的重复实现（issue #96）：
 * 改量程、改默认值、加判空都只改一处 → 一定漏另一处。
 * 现在两个页面都用这一份。
 */
export default function BackgroundTuningSliders() {
    const { t } = useI18N();
    const backgroundInfo = Theme.useBackground();

    return (
        <>
            <SliderRow
                title={t("setCustomTheme.blur")}
                value={backgroundInfo?.blur ?? DEFAULT_BACKGROUND_BLUR}
                minimumValue={0}
                maximumValue={50}
                step={1}
                onChange={val => {
                    Theme.setBackground({ blur: val });
                }}
            />
            <SliderRow
                title={t("setCustomTheme.opacity")}
                value={backgroundInfo?.opacity ?? DEFAULT_BACKGROUND_OPACITY}
                minimumValue={0}
                maximumValue={1}
                step={0.01}
                format={val => `${Math.round(val * 100)}%`}
                onChange={val => {
                    Theme.setBackground({ opacity: val });
                }}
            />
        </>
    );
}
