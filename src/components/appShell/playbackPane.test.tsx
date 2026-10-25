import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import PlaybackPane from "./playbackPane";
import { playbackPaneTabStore } from "@/core/homeNavigation";

jest.mock("@/components/panels/types/playList", () => "EmbeddedQueue");
jest.mock("@/pages/musicDetail/components/content/lyric", () => "Lyric");
jest.mock("@/components/base/icon", () => "Icon");
jest.mock("@/components/base/themeText", () => "ThemeText");
jest.mock("@/hooks/useColors", () => () => ({}));
jest.mock("@/hooks/useOrientation", () => () => "vertical");
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));

it("mounts only the active content and suspends it behind a full-player overlay", () => {
    playbackPaneTabStore.setValue("lyric");
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<PlaybackPane />);
    });
    expect(renderer.root.findAllByType("Lyric" as React.ElementType)).toHaveLength(1);
    act(() => playbackPaneTabStore.setValue("queue"));
    expect(renderer.root.findAllByType("Lyric" as React.ElementType)).toHaveLength(0);
    expect(renderer.root.findByType("EmbeddedQueue" as React.ElementType).props.embedded).toBe(true);
    act(() => renderer.update(<PlaybackPane active={false} />));
    expect(renderer.root.findAllByType("EmbeddedQueue" as React.ElementType)).toHaveLength(0);
    expect(playbackPaneTabStore.getValue()).toBe("queue");
    act(() => renderer.unmount());
});
