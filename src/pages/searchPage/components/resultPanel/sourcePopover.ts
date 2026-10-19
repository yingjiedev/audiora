import Color from "color";
import type useColors from "@/hooks/useColors";
import { readableAccent } from "@/utils/themeColors";

export interface SourceAnchor { x: number; y: number; width: number; height: number }

/** Anchor and viewport use the same Modal-local coordinates, including safe areas. */
export function getSourcePopoverLayout(anchor: SourceAnchor, viewport: { width: number; height: number }, insets: { top: number; bottom: number; left: number; right: number }) {
    const leftEdge = insets.left + 12;
    const rightEdge = viewport.width - insets.right - 12;
    const topEdge = insets.top + 8;
    const bottomEdge = viewport.height - insets.bottom - 12;
    const width = Math.max(0, Math.min(280, rightEdge - leftEdge));
    const left = Math.max(leftEdge, Math.min(anchor.x + anchor.width - width, rightEdge - width));
    const below = anchor.y + anchor.height + 8;
    const top = Math.max(topEdge, Math.min(below, bottomEdge - 100));
    return {
        left, top, width,
        maxHeight: Math.max(0, Math.min(420, bottomEdge - top)),
        pointerLeft: Math.max(20, Math.min(anchor.x + anchor.width / 2 - left - 10, width - 40)),
        showPointer: top === below,
    };
}

/** Opaque local surface and matching foregrounds preserve wallpaper/theme settings. */
export function getSourcePopoverColors(colors: ReturnType<typeof useColors>) {
    const surface = Color(colors.surfaceElevated).alpha(1).hex();
    return {
        surface,
        text: readableAccent(colors.text, [surface], 4.5),
        secondary: readableAccent(colors.textSecondary, [surface], 4.5),
    };
}
