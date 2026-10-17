import React from "react";
import { View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { closePlayer, openPlayer } from "@/core/playerOverlay";
import { panelInfoStore } from "@/components/panels/usePanel";
import Pages from "./index";

jest.mock("@react-navigation/native", () => ({
    NavigationContainer: "NavigationContainer",
}));
jest.mock("react-native/Libraries/Components/StatusBar/StatusBar", () => ({
    __esModule: true,
    default: { setBackgroundColor: jest.fn(), setTranslucent: jest.fn() },
}));
jest.mock("@react-navigation/native-stack", () => ({
    createNativeStackNavigator: () => ({
        Navigator: "Navigator",
        Screen: "Screen",
    }),
}));
jest.mock("react-native-gesture-handler", () => ({
    GestureHandlerRootView: "GestureHandlerRootView",
}));
jest.mock("react-native-safe-area-context", () => ({
    SafeAreaProvider: "SafeAreaProvider",
}));
jest.mock("react-native-reanimated", () => ({
    ReduceMotion: { System: "system" },
    ReducedMotionConfig: "ReducedMotionConfig",
}));
jest.mock("./bootstrap/bootstrap", () => jest.fn());
jest.mock("./bootstrap/BootstrapComponent", () => ({
    BootstrapComponent: "BootstrapComponent",
}));
jest.mock("@/core/theme", () => ({
    setup: jest.fn(),
    useTheme: () => ({ dark: false }),
}));
jest.mock("@/core/router/routes.tsx", () => ({
    routes: [{ path: "home", component: "Home" }],
}));
jest.mock("@/core/notificationLifecycleManager", () => ({
    NotificationLifecycleManager: "NotificationLifecycleManager",
}));
jest.mock("@/utils/log", () => ({ appendStartupBreadcrumb: jest.fn() }));
jest.mock("@/components/panels/usePanel", () => ({
    panelInfoStore: new (require("@/utils/stateMapper").GlobalState)({
        name: null,
    }),
}));
jest.mock("@/components/dialogs", () => "Dialogs");
jest.mock("@/components/panels", () => "Panels");
jest.mock("@/components/mvPlayer", () => "MvPlayerHost");
jest.mock("@/components/base/pageBackground", () => "PageBackground");
jest.mock("@/components/debug", () => "Debug");
jest.mock("@/components/base/portal", () => ({ PortalHost: "PortalHost" }));
jest.mock("@/components/base/splashImageOverlay", () => "SplashImageOverlay");
jest.mock("@/components/playerOverlay", () => "PlayerOverlay");
jest.mock("@/components/base/toast", () => ({
    ToastBaseComponent: "ToastBaseComponent",
}));
jest.mock("@/components/errorBoundary", () => "ErrorBoundary");

function navigationGate(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root
        .findAllByType(View)
        .find(node => node.props.collapsable === false)!;
}

describe("root overlay input isolation", () => {
    beforeEach(() => {
        closePlayer();
        panelInfoStore.setValue({ name: null } as any);
    });

    it("blocks the mounted home until the player has actually closed", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<Pages />);
        });
        expect(navigationGate(renderer!).props.pointerEvents).toBe("auto");
        act(() => openPlayer());
        expect(navigationGate(renderer!).props.pointerEvents).toBe("none");
        expect(navigationGate(renderer!).props.importantForAccessibility).toBe(
            "no-hide-descendants",
        );
        expect(
            navigationGate(renderer!).props.accessibilityElementsHidden,
        ).toBe(true);
        act(() => closePlayer());
        expect(navigationGate(renderer!).props.pointerEvents).toBe("auto");
        expect(
            navigationGate(renderer!).props.accessibilityElementsHidden,
        ).toBe(false);
        act(() => renderer!.unmount());
    });

    it("keeps the home blocked when the player closes underneath a panel", () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<Pages />);
        });
        act(() => {
            openPlayer();
            panelInfoStore.setValue({ name: "PlayList" } as any);
        });
        act(() => closePlayer());
        expect(navigationGate(renderer!).props.pointerEvents).toBe("none");
        act(() => panelInfoStore.setValue({ name: null } as any));
        expect(navigationGate(renderer!).props.pointerEvents).toBe("auto");
        act(() => renderer!.unmount());
    });
});
