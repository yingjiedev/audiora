import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import Home from "./index";
import { homeTabStore } from "@/core/homeNavigation";
import { ContentDimensionsContext } from "@/hooks/useContentDimensions";

jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: require("react-native").View }));
jest.mock("@/components/base/horizontalSafeAreaView.tsx", () => require("react-native").View);
jest.mock("@/components/base/statusBar", () => "StatusBar");
jest.mock("@/components/musicBar/playerDock", () => "PlayerDock");
jest.mock("./components/navBar", () => "NavBar");
jest.mock("./components/homeBody", () => "HomeBody");
jest.mock("./components/HomeBottomNavigation", () => "BottomNavigation");
jest.mock("./components/MyMusicOverview", () => "MyMusicOverview");
jest.mock("./components/MusicLibraryOverview", () => () => {
    const ReactMock = require("react");
    const [count, setCount] = ReactMock.useState(0);
    return ReactMock.createElement("Library", { count, onPress: () => setCount(count + 1) });
});
jest.mock("@/core/theme", () => ({ __esModule: true, default: { useTheme: () => ({ dark: false }) } }));
jest.mock("@/core/appConfig", () => ({ __esModule: true, default: { getConfig: () => false } }));
jest.mock("@/core/playerOverlay", () => ({ openPlayer: jest.fn() }));

it("keeps visited sections and their local state when switching tabs and window layouts", () => {
    homeTabStore.setValue("home");
    let wide = false;
    let renderer!: TestRenderer.ReactTestRenderer;
    const render = () => <ContentDimensionsContext.Provider value={{ width: wide ? 800 : 390, height: 800, wide }}><Home /></ContentDimensionsContext.Provider>;
    act(() => {
        renderer = TestRenderer.create(render());
    });
    expect(renderer.root.findAllByType("Library" as React.ElementType)).toHaveLength(0);
    act(() => homeTabStore.setValue("library"));
    const library = renderer.root.findByType("Library" as React.ElementType);
    act(() => library.props.onPress());
    act(() => homeTabStore.setValue("mine"));
    act(() => homeTabStore.setValue("library"));
    wide = true;
    act(() => renderer.update(render()));
    expect(renderer.root.findByType("Library" as React.ElementType)).toBe(library);
    expect(library.props.count).toBe(1);
    expect(renderer.root.findAllByType("PlayerDock" as React.ElementType)).toHaveLength(0);
    wide = false;
    act(() => renderer.update(render()));
    expect(renderer.root.findAllByType("PlayerDock" as React.ElementType)).toHaveLength(1);
    expect(library.props.count).toBe(1);
    act(() => renderer.unmount());
});
