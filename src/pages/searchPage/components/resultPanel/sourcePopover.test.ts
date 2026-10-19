import { darkColors, lightColors } from "@/constants/colorPalette";
import { contrastRatio } from "@/utils/colorContrast";
import { resolveThemeColors } from "@/utils/themeColors";
import { getSourcePopoverColors, getSourcePopoverLayout } from "./sourcePopover";

describe("source popover bounds", () => {
    it.each([
        [{ width: 390, height: 844 }, { x: 300, y: 140, width: 78, height: 44 }, { top: 24, bottom: 24, left: 0, right: 0 }],
        [{ width: 280, height: 600 }, { x: 220, y: 100, width: 48, height: 44 }, { top: 24, bottom: 24, left: 0, right: 0 }],
        [{ width: 844, height: 390 }, { x: 600, y: 200, width: 80, height: 44 }, { top: 0, bottom: 21, left: 44, right: 44 }],
        [{ width: 390, height: 500 }, { x: 300, y: 430, width: 78, height: 44 }, { top: 24, bottom: 24, left: 0, right: 0 }],
    ])("keeps the panel and its scrollable content inside the actual viewport", (viewport, anchor, insets) => {
        const layout = getSourcePopoverLayout(anchor as any, viewport as any, insets as any);
        expect(layout.left).toBeGreaterThanOrEqual(insets.left! + 12);
        expect(layout.left + layout.width).toBeLessThanOrEqual(viewport.width! - insets.right! - 12);
        expect(layout.top).toBeGreaterThanOrEqual(insets.top! + 8);
        expect(layout.top + layout.maxHeight).toBeLessThanOrEqual(viewport.height! - insets.bottom! - 12);
        expect(layout.maxHeight).toBeGreaterThan(0);
        expect(layout.width).toBeLessThanOrEqual(280);
    });
    it("aligns below the trigger without changing song-list layout and hides a misplaced pointer", () => {
        const viewport = { width: 390, height: 844 };
        const insets = { top: 24, bottom: 24, left: 0, right: 0 };
        expect(getSourcePopoverLayout({ x: 300, y: 140, width: 78, height: 44 }, viewport, insets)).toMatchObject({ left: 98, top: 192, width: 280, showPointer: true });
        expect(getSourcePopoverLayout({ x: 300, y: 800, width: 78, height: 44 }, viewport, insets).showPointer).toBe(false);
    });
});

describe("source popover theme", () => {
    it.each([
        [lightColors, false], [darkColors, true],
        [{ ...lightColors, primary: "#B68CFF", surfaceElevated: "rgba(255,255,255,0.2)" }, false],
        [{ ...darkColors, primary: "#B0F5DA", surfaceElevated: "rgba(24,35,60,0.2)" }, true],
        [{ ...lightColors, text: "#FFFFFF", textSecondary: "rgba(255,255,255,0.6)", surfaceElevated: "rgba(0,0,0,0.3)" }, false],
    ])("uses readable text on its opaque local surface without changing user colors", (palette, dark) => {
        const colors = resolveThemeColors({ ...palette, background: palette.pageBackground }, dark);
        const before = JSON.stringify(colors);
        const popup = getSourcePopoverColors(colors);
        expect(popup.surface).toMatch(/^#[\dA-F]{6}$/);
        expect(contrastRatio(popup.surface, popup.text)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(popup.surface, popup.secondary)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.tonalSurface, colors.onTonal)).toBeGreaterThanOrEqual(4.5);
        expect(JSON.stringify(colors)).toBe(before);
    });
});
