import React, { useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import AppShell from "./index";
import PlayerBar from "./playerBar";
import PlaybackPane from "./playbackPane";
import PrimaryNavigation from "./navigation";
import useContentDimensions from "@/hooks/useContentDimensions";
import { homeTabStore, playbackPaneTabStore } from "@/core/homeNavigation";

let mockWindow = { width: 1280, height: 800, scale: 1, fontScale: 1 };
let mockSong: object | null = { id: "one" };
const mockMount = jest.fn();
const mockUnmount = jest.fn();

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => mockWindow }));
jest.mock("react-native-safe-area-context", () => ({
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
jest.mock("@/core/trackPlayer", () => ({ useCurrentMusic: () => mockSong }));
jest.mock("./navigation", () => "PrimaryNavigation");
jest.mock("./playerBar", () => "PlayerBar");
jest.mock("./playbackPane", () => "PlaybackPane");

function Content() {
    const dimensions = useContentDimensions();
    useEffect(() => {
        mockMount();
        return mockUnmount;
    }, []);
    return <React.Fragment>{JSON.stringify(dimensions)}</React.Fragment>;
}

describe("adaptive app shell", () => {
    const renderers: TestRenderer.ReactTestRenderer[] = [];
    const callbacks = { onSearch: jest.fn(), onSettings: jest.fn(), onSelectHome: jest.fn() };
    function render(routeName = "home", playerOpen = false) {
        let renderer!: TestRenderer.ReactTestRenderer;
        const element = () => <AppShell {...callbacks} routeName={routeName} playerOpen={playerOpen}><Content /></AppShell>;
        act(() => {
            renderer = TestRenderer.create(element());
        });
        renderers.push(renderer);
        return { renderer, update: (route = routeName, open = playerOpen) => {
            routeName = route; playerOpen = open;
            act(() => renderer.update(element()));
        } };
    }
    beforeEach(() => {
        jest.clearAllMocks();
        mockWindow = { width: 1280, height: 800, scale: 1, fontScale: 1 };
        mockSong = { id: "one" };
        homeTabStore.setValue("library");
        playbackPaneTabStore.setValue("lyric");
    });
    afterEach(() => act(() => renderers.splice(0).forEach(renderer => renderer.unmount())));

    it("keeps the same content tree across panes, routes and window breakpoints", () => {
        const { renderer, update } = render();
        act(() => renderer.root.findByType(PlayerBar).props.onSelectPane("queue"));
        expect(renderer.root.findAllByType(PlaybackPane)).toHaveLength(1);
        update("album-detail");
        mockWindow = { ...mockWindow, width: 500 };
        update();
        expect(renderer.root.findAllByType(PrimaryNavigation)).toHaveLength(0);
        expect(renderer.root.findAllByType(PlayerBar)).toHaveLength(0);
        mockWindow = { ...mockWindow, width: 1280 };
        update();
        expect(renderer.root.findAllByType(PlaybackPane)).toHaveLength(1);
        expect(playbackPaneTabStore.getValue()).toBe("queue");
        expect(homeTabStore.getValue()).toBe("library");
        expect(mockMount).toHaveBeenCalledTimes(1);
        expect(mockUnmount).not.toHaveBeenCalled();
    });

    it("switches the supporting tab without accidentally closing it", () => {
        const { renderer } = render();
        const select = (tab: string) => act(() => renderer.root.findByType(PlayerBar).props.onSelectPane(tab));
        select("queue"); select("lyric");
        expect(playbackPaneTabStore.getValue()).toBe("lyric");
        expect(renderer.root.findAllByType(PlaybackPane)).toHaveLength(1);
        select("lyric");
        expect(renderer.root.findAllByType(PlaybackPane)).toHaveLength(0);
    });

    it("suspends supporting content and duplicate controls behind the full player", () => {
        const { renderer, update } = render();
        act(() => renderer.root.findByType(PlayerBar).props.onSelectPane("queue"));
        update("home", true);
        expect(renderer.root.findByType(PlaybackPane).props.active).toBe(false);
        expect(renderer.root.findAllByType(PlayerBar)).toHaveLength(0);
    });

    it("does not reserve a playback pane without a song or inside a file picker", () => {
        const { renderer, update } = render();
        act(() => renderer.root.findByType(PlayerBar).props.onSelectPane("queue"));
        mockSong = null;
        update();
        expect(renderer.root.findAllByType(PlaybackPane)).toHaveLength(0);
        expect(renderer.root.findAllByType(PlayerBar)).toHaveLength(0);
        mockSong = { id: "one" };
        update("file-selector");
        expect(renderer.root.findAllByType(PrimaryNavigation)).toHaveLength(0);
    });
});
