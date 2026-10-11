import React, { useLayoutEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
    closePlayer,
    isPlayerOpen,
    openPlayer,
    playerOverlayStore,
} from "./playerOverlay";

describe("player overlay sessions", () => {
    beforeEach(() => closePlayer());
    afterEach(() => closePlayer());

    it("prepares once and preserves the animation for repeated open requests", () => {
        let progress = 1;
        const prepare = jest.fn(() => {
            progress = 0;
            expect(isPlayerOpen()).toBe(false);
        });
        openPlayer(prepare);
        const session = playerOverlayStore.getValue();
        progress = 1;
        openPlayer(prepare);
        expect(prepare).toHaveBeenCalledTimes(1);
        expect(progress).toBe(1);
        expect(playerOverlayStore.getValue()).toBe(session);
    });

    it("does not reopen or rearm during exit before the current session closes", () => {
        openPlayer();
        const sessionId = playerOverlayStore.getValue().sessionId;
        const prepare = jest.fn();
        openPlayer(prepare);
        expect(prepare).not.toHaveBeenCalled();
        closePlayer(sessionId);
        openPlayer(prepare);
        expect(prepare).toHaveBeenCalledTimes(1);
        expect(playerOverlayStore.getValue().sessionId).toBeGreaterThan(sessionId);
    });

    it("ignores an old session's queued close after the player reopens", () => {
        openPlayer();
        const oldSessionId = playerOverlayStore.getValue().sessionId;
        closePlayer(oldSessionId);
        openPlayer();
        closePlayer(oldSessionId);
        expect(isPlayerOpen()).toBe(true);
        closePlayer(playerOverlayStore.getValue().sessionId);
        expect(isPlayerOpen()).toBe(false);
    });

    it("allows a retry after preparation fails without publishing an open overlay", () => {
        expect(() => openPlayer(() => {
            throw new Error("preparation failed");
        })).toThrow("preparation failed");
        expect(isPlayerOpen()).toBe(false);
        openPlayer();
        expect(isPlayerOpen()).toBe(true);
    });

    it("ignores reentrant preparation requests", () => {
        const nestedPrepare = jest.fn();
        openPlayer(() => openPlayer(nestedPrepare));
        expect(nestedPrepare).not.toHaveBeenCalled();
        expect(isPlayerOpen()).toBe(true);
    });

    it("observes changes between rendering and subscribing", () => {
        function Snapshot() {
            const { open } = playerOverlayStore.useValue();
            useLayoutEffect(() => openPlayer(), []);
            return <React.Fragment>{open ? "open" : "closed"}</React.Fragment>;
        }
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<Snapshot />);
        });
        expect(renderer!.toJSON()).toBe("open");
        act(() => closePlayer());
        expect(renderer!.toJSON()).toBe("closed");
        act(() => renderer!.unmount());
    });
});
