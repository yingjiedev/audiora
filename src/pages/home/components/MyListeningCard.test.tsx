import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { lightColors } from "@/constants/colorPalette";
import zhCN from "@/core/i18n/languages/zh-cn.json";
import zhTW from "@/core/i18n/languages/zh-tw.json";
import enUS from "@/core/i18n/languages/en-us.json";
import { addListeningInterval, ListeningData } from "@/core/listeningStatsModel";
import { resolveThemeColors } from "@/utils/themeColors";
import MyListeningCard from "./MyListeningCard";

const mockNow = new Date(2026, 9, 11, 12).getTime();
const song = { id: "song", platform: "local", title: "Song", artist: "Artist", artwork: "cover" };
const mockNavigate = jest.fn();
const mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
let mockLanguage: Record<string, string> = zhCN;
let mockData: ListeningData;
jest.mock("@/core/listeningStats", () => ({ useListeningStats: () => mockData }));
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("@/core/router", () => ({ ROUTE_PATH: { LOCAL_SHEET_DETAIL: "favorite", LISTENING_REPORT: "report" }, useNavigate: () => mockNavigate }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: Record<string, string | number>) => mockLanguage[key]?.replace(/\{(\w+)\}/g, (_match, name) => String(args?.[name] ?? "")) ?? key }) }));

describe("MyListeningCard", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    const render = () => act(() => {
        renderer = TestRenderer.create(<MyListeningCard sheetId="favorites" count={5} cover="cover" />);
    });
    const text = () => renderer.root.findAll(node => node.type === "ThemeText" as any);
    beforeEach(() => {
        jest.spyOn(Date, "now").mockReturnValue(mockNow);
        mockNavigate.mockClear();
        mockLanguage = zhCN;
        mockData = addListeningInterval({ version: 1, startedAt: mockNow, days: [] }, song, mockNow, mockNow + 41000, true);
    });
    afterEach(() => {
        act(() => renderer?.unmount());
        jest.restoreAllMocks();
    });

    it.each([["zh-CN", zhCN, "41 秒", " 秒"], ["zh-TW", zhTW, "41 秒", " 秒"], ["en-US", enUS, "41 sec", " sec"]] as const)("retains the real duration and makes the unit secondary in %s", (_locale, language, label, unit) => {
        mockLanguage = language;
        render();
        expect(renderer.root.findByProps({ accessibilityLabel: label })).toBeDefined();
        const number = text().find(node => node.props.children === "41")!;
        const suffix = text().find(node => node.props.children === unit)!;
        expect(StyleSheet.flatten(number.props.style).fontSize).toBeGreaterThan(StyleSheet.flatten(suffix.props.style).fontSize);
        expect(suffix.props.fontColor).toBe("textSecondary");
        expect(text().map(node => node.props.children)).not.toContain(mockLanguage["listening.collection"]);
    });

    it("has separate collection and report buttons and keeps the recording start explicit", () => {
        render();
        const collection = renderer.root.findByProps({ accessibilityLabel: zhCN["home.favoriteSheet"] });
        const report = renderer.root.findByProps({ accessibilityLabel: zhCN["listening.openReport"] });
        act(() => {
            collection.props.onPress();
            report.props.onPress();
        });
        expect(mockNavigate.mock.calls).toEqual([["favorite", { id: "favorites" }], ["report"]]);
        expect(report.props.accessibilityHint).toBe("10/11 起记录 · 活跃 1 天");
        expect(renderer.root.findAll(node => node.props.accessibilityLabel === zhCN["listening.todayEntry"])).toHaveLength(0);
        const previewCells = renderer.root.findAll(node => typeof node.props.testID === "string" && node.props.testID.startsWith("listening-day-"));
        expect(new Set(previewCells.map(node => node.props.testID)).size).toBe(91);
    });

    it("keeps hour and minute values readable and renders a truthful empty start", () => {
        mockData = addListeningInterval({ version: 1, startedAt: mockNow - 4000000, days: [] }, song, mockNow - 3660000, mockNow, true);
        render();
        expect(renderer.root.findByProps({ accessibilityLabel: "1 小时 1 分" })).toBeDefined();
        mockData = { version: 1, startedAt: mockNow, days: [] };
        act(() => renderer.update(<MyListeningCard count={0} />));
        expect(renderer.root.findByProps({ accessibilityLabel: zhCN["home.favoriteSheet"] }).props.disabled).toBe(true);
        expect(renderer.root.findByProps({ accessibilityLabel: "0 秒" })).toBeDefined();
        expect(renderer.root.findByProps({ accessibilityLabel: zhCN["listening.openReport"] }).props.accessibilityHint).toBe("10/11 起记录 · 活跃 0 天");
    });
});
