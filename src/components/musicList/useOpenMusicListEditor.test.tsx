import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import useOpenMusicListEditor from "./useOpenMusicListEditor";
import { canEditMusicList } from "@/core/musicListEditor";

const mockNavigate = jest.fn();
jest.mock("@/core/router", () => ({ useNavigate: () => mockNavigate, ROUTE_PATH: { MUSIC_LIST_EDITOR: "editor" } }));

let openEditor: ReturnType<typeof useOpenMusicListEditor>;
function Harness() {
    openEditor = useOpenMusicListEditor();
    return null;
}

describe("shared music selection entry", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    beforeEach(() => {
        jest.clearAllMocks();
        act(() => {
            renderer = TestRenderer.create(<Harness />);
        });
    });
    afterEach(() => act(() => renderer.unmount()));

    it("uses the inline editor without pushing another screen", () => {
        const inline = jest.fn();
        openEditor({ musicList: [] }, inline);
        expect(inline).toHaveBeenCalledTimes(1);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("carries action switches and makes paginated sources selection-only even if they have a sheet id", () => {
        const options = { musicList: [], musicSheet: { id: "remote" }, sourceId: "search", selectionOnly: false, actions: { download: false, remove: true } };
        openEditor(options);
        expect(mockNavigate).toHaveBeenCalledWith("editor", { ...options, selectionOnly: true });
        expect(canEditMusicList(options)).toBe(false);
    });

    it("allows full local editing but protects filtered snapshots", () => {
        const options = { musicList: [], musicSheet: { id: "favorite" } };
        openEditor(options);
        expect(mockNavigate).toHaveBeenCalledWith("editor", options);
        expect(canEditMusicList(options)).toBe(true);
        expect(canEditMusicList({ ...options, selectionOnly: true })).toBe(false);
    });
});
