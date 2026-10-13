import { Theme, useTheme } from "@react-navigation/native";
import { useMemo } from "react";
import { resolveThemeColors } from "@/utils/themeColors";

type IColors = Theme["colors"];

export interface CustomizedColors extends IColors {
    /** 普通文字 */
    text: string;
    /** 副标题文字颜色 */
    textSecondary?: string;
    /** 高亮文本颜色，也就是主色调 */
    textHighlight?: string;
    /** 页面背景 */
    pageBackground?: string;
    /** 阴影 */
    shadow?: string;
    /** 标题栏颜色 */
    appBar?: string;
    /** 标题栏字体颜色 */
    appBarText?: string;
    /** 音乐栏颜色 */
    musicBar?: string;
    /** 音乐栏字体颜色 */
    musicBarText?: string;
    /** 分割线 */
    divider?: string;
    /** 高亮颜色 */
    listActive?: string;
    /** 输入框背景色 */
    placeholder?: string;
    /** 弹窗、浮层、菜单背景色 */
    backdrop?: string;
    /** 弹窗与面板背后的遮罩 */
    mask?: string;
    /** 卡片背景色 */
    card: string;
    /** 基础表面 */
    surface?: string;
    /** 浮起表面 */
    surfaceElevated?: string;
    /** 边框 */
    border: string;
    /** 暖色强调 */
    accentWarm?: string;
    /** 冷色强调 */
    accentCool?: string;
    success?: string;
    warning?: string;
    danger?: string;
    info?: string;
    /** 喜欢状态；与危险操作分离 */
    favorite?: string;
    /** 主色文字，按实际表面的对比度校准 */
    primaryText?: string;
    /** 正在播放、当前选中项的前景色 */
    active?: string;
    /** paneltabbar 背景色 */
    tabBar?: string;
    /**
     * 主色上的前景色（文字/图标）。
     * 主色会随主题和用户的自定义配色变化，写死白字在调亮后的主色上只有
     * 2.9:1，这里按对比度自动取白或近黑。
     */
    onPrimary?: string;
    /**
     * 沉浸层（播放页）上的主前景色。底图恒为压暗后的封面，不随深浅主题变化，
     * 因此这里给的是一组固定的中性色，页面侧只按语义取用。
     */
    onMedia?: string;
    /** 沉浸层上的次要前景色（副标题、时间标签） */
    onMediaSecondary?: string;
    /** 沉浸层上的轨道 / 分隔色（进度条底槽、未选中态） */
    onMediaTrack?: string;
    /** 沉浸层的压暗底色，用于状态栏顶部遮罩 */
    onMediaScrim?: string;
}

// Theme updates replace the colors object. Share contrast calculations across
// consumers, including the many lyric rows mounted under the same theme.
const resolvedThemes = new WeakMap<CustomizedColors, {
    dark: boolean;
    colors: ReturnType<typeof resolveThemeColors>;
}>();

export default function useColors() {
    const { colors, dark } = useTheme();

    const cColors = useMemo(() => {
        const source = colors as CustomizedColors;
        const cached = resolvedThemes.get(source);
        if (cached?.dark === dark) return cached.colors;
        const resolved = resolveThemeColors(source, dark);
        resolvedThemes.set(source, { dark, colors: resolved });
        return resolved;
    }, [colors, dark]);

    return cColors;
}
