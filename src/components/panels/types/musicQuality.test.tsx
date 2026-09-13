import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import MusicQuality from "./musicQuality";

jest.mock("../base/panelBase", () => ({ renderBody }: {
    renderBody: () => React.ReactNode;
}) => renderBody());
jest.mock("../base/panelHeader", () => "PanelHeader");
jest.mock("@/components/base/divider", () => "Divider");
jest.mock("@/components/base/themeText", () => {
    const ReactModule = require("react");
    return ({ children }: { children: React.ReactNode }) =>
        ReactModule.createElement("ThemeText", null, children);
});
jest.mock("react-native-gesture-handler", () => {
    const ReactModule = require("react");
    return {
        ScrollView: ({ children }: { children: React.ReactNode }) =>
            ReactModule.createElement("ScrollView", null, children),
    };
});
jest.mock("react-native-safe-area-context", () => ({
    useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock("@/utils/rpx", () => ({
    __esModule: true,
    default: (value: number) => value,
}));
jest.mock("@/core/pluginManager", () => ({
    __esModule: true,
    default: { getByMedia: () => undefined },
}));
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({
        getLanguage: () => ({ languageData: {} }),
        t: (key: string) => key,
    }),
}));
jest.mock("@/core/appConfig", () => ({
    useAppConfig: () => undefined,
}));
jest.mock("@/utils/qualities", () => ({
    getAvailableQualities: (musicItem: IMusic.IMusicItem) =>
        Object.keys(musicItem.qualities ?? {}),
    getQualitySize: () => undefined,
    getQualityText: () => ({ flac: "Online lossless" }),
}));
jest.mock("../usePanel", () => ({ hidePanel: jest.fn() }));

function createMusicItem(
    overrides: Partial<IMusic.IMusicItem> = {},
): IMusic.IMusicItem {
    return {
        id: "song-id",
        platform: "source-plugin",
        title: "Song",
        artist: "Artist",
        duration: 1,
        album: "Album",
        artwork: "",
        ...overrides,
    };
}

describe("MusicQuality local display", () => {
    it("uses the neutral local fallback instead of retained online qualities", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(
                <MusicQuality
                    isLocal
                    musicItem={createMusicItem({
                        qualities: { flac: { size: 100 } },
                        $: { localPath: "/tmp/unknown.m4a" },
                    })}
                    onQualityPress={jest.fn()}
                />,
            );
        });

        const rendered = JSON.stringify(renderer!.toJSON());
        expect(rendered).toContain("localQuality.fallback");
        expect(rendered).not.toContain("Online lossless");

        act(() => renderer!.unmount());
    });

    it("shows real technical details when local metadata is available", () => {
        let renderer: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(
                <MusicQuality
                    isLocal
                    musicItem={createMusicItem({
                        $: {
                            localPath: "/tmp/song.flac",
                            audioMeta: {
                                codec: "flac",
                                bitDepth: 24,
                                sampleRate: 96000,
                                bitrate: 2304000,
                            },
                        },
                    })}
                    onQualityPress={jest.fn()}
                />,
            );
        });

        expect(JSON.stringify(renderer!.toJSON())).toContain(
            "FLAC · 24-bit · 96 kHz · 2304 kbps",
        );

        act(() => renderer!.unmount());
    });
});
