/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { getDefaultStore } from "jotai";
import { RequestStateCode } from "@/constants/commonConst";
import { getMusicListSource } from "@/core/musicListSource";
import useMusicListSource from "./useMusicListSource";

jest.mock("@/utils/motion", () => ({ motionDuration: jest.fn(), motionEasing: {} }));
jest.mock("@/utils/mediaExtra", () => ({}));
const mockSetOptions = jest.fn();
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({ setOptions: mockSetOptions }) }));
const song = { id: "one", platform: "A", title: "Song", artist: "Artist" } as IMusic.IMusicItem;

it("keeps an editor's source synchronized with its owner and releases it on unmount", async () => {
    let binding!: ReturnType<typeof useMusicListSource>;
    const loader = jest.fn();
    function Owner() {
        const [musicList, setMusicList] = useState([song]);
        const [state, setState] = useState(RequestStateCode.PARTLY_DONE);
        binding = useMusicListSource({ musicList, state }, async () => {
            loader();
            setState(RequestStateCode.PENDING_REST_PAGE);
            await Promise.resolve();
            setMusicList(previous => [...previous, { ...song, id: "two" }]);
            setState(RequestStateCode.FINISHED);
        });
        return null;
    }
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<Owner />);
    });
    const id = binding.sourceId;
    const release = binding.source.acquireEditor();
    expect(mockSetOptions).toHaveBeenLastCalledWith({ freezeOnBlur: false });
    await act(async () => {
        await getMusicListSource(id)!.loadMore();
    });
    expect(binding.sourceId).toBe(id);
    expect(getDefaultStore().get(binding.source.snapshotAtom)).toMatchObject({
        state: RequestStateCode.FINISHED,
        musicList: [song, { ...song, id: "two" }],
    });
    expect(loader).toHaveBeenCalledTimes(1);
    release();
    expect(mockSetOptions).toHaveBeenLastCalledWith({ freezeOnBlur: true });
    act(() => renderer.unmount());
    expect(getMusicListSource(id)).toBeUndefined();
});
