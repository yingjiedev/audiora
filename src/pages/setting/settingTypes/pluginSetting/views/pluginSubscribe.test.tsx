import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import PluginSubscribe from "./pluginSubscribe";

const mockUpdate = jest.fn();
let mockTask: any = { updating: false, cancelling: false, updates: {}, updateSubscriptions: mockUpdate, cancelUpdate: jest.fn() };
const mockItem = { name: "", url: "https://source/plugins.json" };
jest.mock("@/core/appConfig", () => ({ useAppConfig: () => JSON.stringify([mockItem]) }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/useColors", () => () => ({ card: "white", surface: "white", active: "blue", primaryText: "blue" }));
jest.mock("@/hooks/useMotion", () => () => ({ reduceMotion: true }));
jest.mock("@/components/base/themeText", () => "MockText");
jest.mock("@/components/base/appBar", () => "MockAppBar");
jest.mock("@/components/base/horizontalSafeAreaView", () => "MockSafeArea");
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("@/utils/toast", () => ({ success: jest.fn(), warn: jest.fn() }));
jest.mock("../hooks/useUpdateSubscriptions", () => () => mockTask);
jest.mock("@/components/base/pageSection", () => ({
    PageAction: "MockAction",
    PageState: "MockEmpty",
    PageSummary: ({ title, action }: any) => require("react").createElement("MockSummary", { title }, action),
}));
jest.mock("react-native-gesture-handler", () => ({
    FlatList: (props: any) => require("react").createElement("MockList", { data: props.data },
        props.ListHeaderComponent,
        ...props.data.map((item: any, index: number) => require("react").createElement("MockCard", { key: item.url }, props.renderItem({ item, index })))),
}));

it("keeps the subscription card visible while fetching and shows its real progress and results", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<PluginSubscribe />);
    });
    expect(renderer.root.findAllByType("MockText" as any).some(node => node.props.children === "source")).toBe(true);
    const setTask = (value: any) => {
        mockTask = { ...mockTask, ...value };
        act(() => renderer.update(<PluginSubscribe />));
        expect(renderer.root.findAllByType("MockCard" as any)).toHaveLength(1);
    };
    setTask({ updating: true, updates: { [mockItem.url]: { phase: "fetching", results: [] } } });
    expect(renderer.root.findAllByType("MockText" as any).some(node => node.props.children === "subscription.fetching")).toBe(true);
    expect(renderer.root.findAllByProps({ accessibilityRole: "progressbar" })).toHaveLength(0);
    setTask({ updates: { [mockItem.url]: { phase: "updating", total: 4, results: [{ success: true, status: "installed" }] } } });
    const progress = renderer.root.findAllByProps({ accessibilityRole: "progressbar" })[0];
    expect(progress.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 1 });
    expect(renderer.root.findAllByType("ActivityIndicator" as any)).toHaveLength(0);
    setTask({ updating: false, updates: { [mockItem.url]: { phase: "finished", total: 2, finishedAt: 1792203092000, results: [{ success: true }, { success: false, pluginUrl: "https://source/fail.js" }] } } });
    const retry = renderer.root.findAllByType("MockAction" as any).find(node => node.props.title === "subscription.retryFailed")!;
    act(() => retry.props.onPress());
    expect(mockUpdate).toHaveBeenCalledWith([mockItem], true);
    expect(renderer.root.findAllByType("MockText" as any).some(node => node.props.children === "subscription.hasFailures")).toBe(true);
    act(() => renderer.unmount());
});
