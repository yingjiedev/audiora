import Theme from "@/core/theme";
import { createContext, useContext } from "react";

/**
 * 页面自带背景（例如歌单专属背景）时置为 true。
 * 全局壁纸没开也要让边框/阴影按「有背景」处理，否则会出现细线和黑色投影。
 */
export const LocalBackgroundContext = createContext(false);

/**
 * True when the page actually renders a wallpaper / custom background image.
 *
 * 自定义背景只在「自定义背景」主题下生效：切到浅色/深色模式后壁纸不再显示，
 * 这里必须同步返回 false，让卡片重新拿到边框和投影，否则会在纯色底上留下
 * 一圈"为壁纸准备"的透明描边（issue #44）。判定走 useActiveBackground，
 * 与 PageBackground 同源，避免两边对"有没有背景"理解不一致。
 */
export default function useHasCustomBackground() {
    const background = Theme.useActiveBackground();
    const hasLocalBackground = useContext(LocalBackgroundContext);
    return hasLocalBackground || !!background;
}
