import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { addListeningInterval } from "@/core/listeningStatsModel";
import { lightColors } from "@/constants/colorPalette";
import { resolveThemeColors } from "@/utils/themeColors";
import ListeningReport from "./index";

const mockNow = new Date(2026, 9, 11, 12).getTime();
let mockData = addListeningInterval({ version: 1, startedAt: mockNow, days: [] }, { id: "song", platform: "source", title: "Music", artist: "Artist", artwork: "cover" }, mockNow - 20 * 86400000, mockNow - 20 * 86400000 + 120000, true);
const mockSeed = mockData;
const mockColors = resolveThemeColors({ ...lightColors, background: lightColors.pageBackground }, false);
jest.mock("@/core/listeningStats", () => ({ useListeningStats: () => mockData }));
jest.mock("@/hooks/useColors", () => () => mockColors);
jest.mock("@/components/base/appBar", () => "AppBar");
jest.mock("@/components/base/verticalSafeAreaView", () => "SafeArea");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/fastImage", () => "FastImage");
jest.mock("@/constants/assetsConst", () => ({ ImgAsset: { albumDefault: 1 } }));
jest.mock("react-native-svg", () => ({ __esModule: true, default: "Svg", Line: "Line", Rect: "Rect" }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string, args?: any) => {
    if (key === "listening.period") return `Last ${args.days} days`;
    if (key === "listening.minutes") return `${args.count} min`;
    if (key === "listening.seconds") return `${args.count} sec`;
    return key;
} }) }));

describe("ListeningReport", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        jest.spyOn(Date, "now").mockReturnValue(mockNow);
        mockData = mockSeed;
        act(() => {
            renderer = TestRenderer.create(<ListeningReport />);
        });
    });
    afterEach(() => {
        act(() => renderer.unmount());
        jest.restoreAllMocks();
    });

    it("filters charts, totals and ranked songs together when changing periods", () => {
        const text = () => renderer.root.findAll(node => node.type === "ThemeText" as any).map(node => node.props.children);
        expect(text()).toContain("2 min");
        expect(text()).toContain("Music");
        act(() => renderer.root.findByProps({ accessibilityLabel: "Last 7 days" }).props.onPress());
        expect(text()).toContain("0 sec");
        expect(text()).not.toContain("Music");
        expect(renderer.root.findByProps({ accessibilityLabel: "Last 7 days" }).props.accessibilityState.selected).toBe(true);
        act(() => renderer.root.findByProps({ accessibilityLabel: "Last 90 days" }).props.onPress());
        expect(text()).toContain("2 min");
        expect(text()).toContain("Music");
    });

    it("shows truthful empty states and refreshes with measured statistics", () => {
        mockData = { version: 1, startedAt: mockNow, days: [] };
        act(() => renderer.update(<ListeningReport />));
        expect(renderer.root.findAll(node => node.props.children === "listening.empty").length).toBeGreaterThan(0);
        expect(renderer.root.findAll(node => node.props.children === "listening.noSongsYet").length).toBeGreaterThan(0);
        mockData = addListeningInterval(mockData, { id: "new", platform: "local", title: "New song", artist: "New artist", artwork: "new-cover" }, mockNow, mockNow + 90000, true);
        act(() => renderer.update(<ListeningReport />));
        expect(renderer.root.findAll(node => node.props.children === "New song").length).toBeGreaterThan(0);
    });
});
