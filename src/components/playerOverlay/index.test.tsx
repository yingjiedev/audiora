import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { closePlayer, openPlayer } from "@/core/playerOverlay";
import MusicDetail from "@/pages/musicDetail";
import PlayerOverlay from "./index";

jest.mock("@/pages/musicDetail", () => "MusicDetail");

describe("player overlay host", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    beforeEach(() => {
        closePlayer();
        act(() => {
            renderer = TestRenderer.create(<PlayerOverlay />);
        });
    });

    afterEach(() => {
        act(() => {
            renderer.unmount();
            closePlayer();
        });
    });

    it("removes the full player tree when its session closes", () => {
        act(() => openPlayer());
        expect(renderer.root.findAllByType(MusicDetail)).toHaveLength(1);
        act(() => renderer.root.findByType(MusicDetail).props.onClose());
        expect(renderer.toJSON()).toBeNull();
    });

    it("keeps the existing player for repeated opens", () => {
        act(() => openPlayer());
        const player = renderer.root.findByType(MusicDetail);
        const prepare = jest.fn();
        act(() => openPlayer(prepare));
        expect(prepare).not.toHaveBeenCalled();
        expect(renderer.root.findByType(MusicDetail)).toBe(player);
    });

    it("mounts a new session after batched close/open and ignores the old close callback", () => {
        act(() => openPlayer());
        const oldPlayer = renderer.root.findByType(MusicDetail);
        const oldClose = oldPlayer.props.onClose;
        act(() => {
            closePlayer();
            openPlayer();
        });
        const newPlayer = renderer.root.findByType(MusicDetail);
        expect(newPlayer).not.toBe(oldPlayer);
        act(() => oldClose());
        expect(renderer.root.findByType(MusicDetail)).toBe(newPlayer);
        act(() => newPlayer.props.onClose());
        expect(renderer.toJSON()).toBeNull();
    });
});
