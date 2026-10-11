import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { addListeningInterval, calendarDays } from "@/core/listeningStatsModel";
import { lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import ActivityGrid from "./activityGrid";

jest.mock("@/utils/rpx", () => ({ __esModule: true, default: (value: number) => value * 0.35 }));
const mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: any) => key === "listening.activitySummary" ? `${args.active} active, ${args.unrecorded} unrecorded` : key }) }));

describe("ActivityGrid", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    afterEach(() => act(() => renderer?.unmount()));
    const now = new Date(2026, 9, 11, 12).getTime();
    const data = addListeningInterval({ version: 1, startedAt: now - 86400000, days: [] }, { id: "song", platform: "local", title: "Song", artist: "Artist", artwork: "cover" }, now, now + 41000, true);

    it("renders unknown dates as outlines and 41 seconds as a visible activity color", () => {
        act(() => {
            renderer = TestRenderer.create(<ActivityGrid days={calendarDays(data, 91, now)} startedAt={data.startedAt} compact />);
        });
        const cellStyle = (date: string) => StyleSheet.flatten(renderer.root.findByProps({ testID: `listening-day-${date}` }).props.style);
        expect(cellStyle("2026-10-09")).toMatchObject({ borderStyle: "solid", borderWidth: 1, borderColor: mockColors.activityOutline });
        expect(cellStyle("2026-10-09").backgroundColor).toBeUndefined();
        expect(cellStyle("2026-10-10").backgroundColor).toBe(mockColors.activityEmpty);
        expect(cellStyle("2026-10-10")).toMatchObject({ borderWidth: 1, borderColor: mockColors.activityOutline });
        expect(cellStyle("2026-10-10").borderStyle).toBeUndefined();
        expect(cellStyle("2026-10-11").backgroundColor).toBe(mockColors.activityLevels[0]);
        expect(cellStyle("2026-10-11").borderWidth).toBeUndefined();
        expect(renderer.root.findAll(node => node.props.accessibilityLabel === "1 active, 89 unrecorded").length).toBeGreaterThan(0);
        expect(renderer.root.findAll(node => node.props.children === "listening.unrecorded")).toHaveLength(0);
    });

    it.each([[11, 13], [12, 14]])("keeps 91-day cells at least 8dp wide across %i October's week alignment", (date, weekCount) => {
        const days = calendarDays(data, 91, new Date(2026, 9, date, 12).getTime());
        act(() => {
            renderer = TestRenderer.create(<ActivityGrid days={days} startedAt={data.startedAt} compact />);
        });
        const image = renderer.root.findByProps({ accessibilityRole: "image" });
        const width = StyleSheet.flatten(image.props.style).width;
        const cells = renderer.root.findAll(node => node.type === "View" as any && typeof node.props.testID === "string");
        const grid = image.findAll(node => StyleSheet.flatten(node.props.style)?.flexDirection === "row")[0];
        const gap = StyleSheet.flatten(grid.props.style).gap;
        expect((width - (weekCount - 1) * gap) / weekCount).toBeGreaterThanOrEqual(8);
        expect(StyleSheet.flatten(image.props.style).flexShrink).toBe(0);
        expect(cells).toHaveLength(91);
        for (const cell of cells) {
            const style = StyleSheet.flatten(cell.props.style);
            expect(style.borderStyle).not.toBe("dashed");
            expect(style.borderRadius).toBeLessThanOrEqual(2);
        }
    });

    it("provides weekday, date range and unknown-state labels in the full report", () => {
        act(() => {
            renderer = TestRenderer.create(<ActivityGrid days={calendarDays(data, 91, now)} startedAt={data.startedAt} />);
        });
        const text = renderer.root.findAll(node => node.type === "ThemeText" as any).map(node => node.props.children);
        expect(text).toEqual(expect.arrayContaining(["listening.monday", "listening.wednesday", "listening.friday", "listening.unrecorded", "2026-07-13", "2026-10-11"]));
    });
});
