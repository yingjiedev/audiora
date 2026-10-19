import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import useHomeOverview from "./useHomeOverview";

let mockSheets = [{ id: "favorite", platform: "local", title: "Favorites", worksNum: 1 }];
let mockMusics = [{ id: "one", platform: "remote", title: "Song", artist: "Artist" }];
const mockUseSheet = jest.fn();
jest.mock("jotai", () => ({ useAtomValue: () => ({}) }));
jest.mock("@/core/musicHistory", () => ({ useMusicHistory: () => [] }));
jest.mock("@/core/musicSheet", () => ({
    __esModule: true, default: { defaultSheet: { id: "favorite", platform: "local", title: "Favorites", worksNum: 0 } },
    useFavoriteCount: () => mockSheets.find(sheet => sheet.id === "favorite")?.worksNum ?? 0,
    useSheetsBase: () => mockSheets,
    useSheetItem: (id: string) => {
        mockUseSheet(id); return { musicList: mockMusics };
    },
}));
jest.mock("@/core/pluginManager", () => ({ __esModule: true, default: { isPluginEnabled: () => true }, useSortedPlugins: () => [] }));
jest.mock("@/core/randomPlay", () => ({ getPrimaryArtist: (artist: string) => artist }));
jest.mock("@/core/trackPlayer", () => ({ useCurrentMusic: () => null }));
jest.mock("@/pages/topList/store/atoms", () => ({ pluginsTopListAtom: {} }));
jest.mock("@/utils/mediaUtils", () => ({ isSameMediaItem: () => false }));

describe("Home Favorites data", () => {
    it("subscribes to the default Favorites sheet and reflects additions/removals", () => {
        let data: ReturnType<typeof useHomeOverview>;
        const Probe = () => {
            data = useHomeOverview(); return null;
        };
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<Probe />);
        });
        expect(mockUseSheet).toHaveBeenCalledWith("favorite");
        expect(data!.favoriteMusics).toBe(mockMusics);
        mockMusics = [];
        act(() => renderer.update(<Probe />));
        expect(data!.favoriteMusics).toEqual([]);
        act(() => renderer.unmount());
    });

    it("never relabels an unrelated user playlist as Favorites while storage initializes", () => {
        mockSheets = [{ id: "other", platform: "local", title: "Travel", worksNum: 8 }];
        let data: ReturnType<typeof useHomeOverview>;
        const Probe = () => {
            data = useHomeOverview(); return null;
        };
        let renderer!: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(<Probe />);
        });
        expect(data!.favoriteSheet.id).toBe("favorite");
        expect(data!.favoriteSheet.title).toBe("Favorites");
        act(() => renderer.unmount());
    });
});
