import React, { memo } from "react";
import useColors from "@/hooks/useColors";
import Theme from "@/core/theme";
import CustomBackground from "./customBackground";

function PageBackground() {
    const background = Theme.useActiveBackground();
    const colors = useColors();

    // 自定义背景只属于「自定义背景」主题：切到浅色/深色模式后必须停用，
    // 改按所选模式显示预设底色。这里用 useActiveBackground 而不是 useBackground，
    // 是为了和 useHasCustomBackground（控制边框/阴影）保持同一套语义——
    // 否则会出现「壁纸停了、卡片却还是无边框无投影」的半吊子状态（issue #44）。
    return (
        <CustomBackground
            url={background?.url}
            blur={background?.blur}
            opacity={background?.opacity}
            backgroundColor={colors?.pageBackground ?? colors.background}
        />
    );
}
export default memo(PageBackground, () => true);
