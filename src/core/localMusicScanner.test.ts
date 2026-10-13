import { readDir, stat } from "react-native-fs";
import { scanAndroidSafDirectoryFiles } from "@/utils/androidSaf";
import {
    isSupportedLocalMedia,
    scanLocalMediaPaths,
} from "./localMusicScanner";

const mockReadDir = readDir as jest.MockedFunction<typeof readDir>;
const mockStat = stat as jest.MockedFunction<typeof stat>;
const mockScanAndroidSafDirectoryFiles =
    scanAndroidSafDirectoryFiles as jest.MockedFunction<
        typeof scanAndroidSafDirectoryFiles
    >;

jest.mock("@/utils/androidSaf", () => ({
    getLegacyPathFromAndroidDocumentId: jest.fn(documentId =>
        documentId?.startsWith("primary:")
            ? `/storage/emulated/0/${documentId.slice(8)}`
            : null,
    ),
    scanAndroidSafDirectoryFiles: jest.fn(),
}));

// mediaCompanion 通过 mediaExtra 间接依赖 react-native-reanimated，
// 而它不在 jest 的 transformIgnorePatterns 里；这里只需要它的纯文件名分类逻辑
jest.mock("@/utils/mediaExtra", () => ({
    getMediaExtraProperty: jest.fn(() => null),
}));

function fileStat() {
    return {
        isFile: () => true,
        isDirectory: () => false,
    } as Awaited<ReturnType<typeof stat>>;
}

function directoryStat() {
    return {
        isFile: () => false,
        isDirectory: () => true,
    } as Awaited<ReturnType<typeof stat>>;
}

function directoryEntry(path: string) {
    return {
        path,
        name: path.split("/").pop() ?? path,
        isFile: () => false,
        isDirectory: () => true,
    } as Awaited<ReturnType<typeof readDir>>[number];
}

function fileEntry(path: string) {
    return {
        path,
        name: path.split("/").pop() ?? path,
        isFile: () => true,
        isDirectory: () => false,
    } as Awaited<ReturnType<typeof readDir>>[number];
}

describe("local music scanner", () => {
    beforeEach(() => {
        mockReadDir.mockReset();
        mockStat.mockReset();
        mockScanAndroidSafDirectoryFiles.mockReset();
    });

    it("imports files returned directly by the Android document picker", async () => {
        mockStat.mockResolvedValue(fileStat());

        await expect(scanLocalMediaPaths([
            "file:///storage/app/imported/song.mp3",
            "/storage/app/imported/notes.txt",
        ])).resolves.toEqual({
            audioFiles: [
                {
                    path: "/storage/app/imported/song.mp3",
                    name: "song.mp3",
                    directory: "/storage/app/imported",
                },
            ],
            companionFiles: [],
        });
        expect(mockReadDir).not.toHaveBeenCalled();
    });

    it("recursively scans directories and ignores unsupported files", async () => {
        mockStat.mockImplementation(async path =>
            path === "/music" || path === "/music/live"
                ? directoryStat()
                : fileStat(),
        );
        mockReadDir.mockImplementation(async path => {
            if (path === "/music") {
                return [
                    fileEntry("/music/track.flac"),
                    fileEntry("/music/readme.txt"),
                    directoryEntry("/music/live"),
                ];
            }
            return [fileEntry("/music/live/encore.m4a")];
        });

        await expect(scanLocalMediaPaths(["/music"])).resolves.toEqual({
            audioFiles: [
                {
                    path: "/music/track.flac",
                    name: "track.flac",
                    directory: "/music",
                },
                {
                    path: "/music/live/encore.m4a",
                    name: "encore.m4a",
                    directory: "/music/live",
                },
            ],
            companionFiles: [
                {
                    path: "/music/readme.txt",
                    name: "readme.txt",
                    directory: "/music",
                },
            ],
        });
    });

    it("collects companion lyric and cover files next to the audio", async () => {
        mockStat.mockImplementation(async path =>
            path === "/music" ? directoryStat() : fileStat(),
        );
        mockReadDir.mockImplementation(async () => [
            fileEntry("/music/track.flac"),
            fileEntry("/music/track.lrc"),
            fileEntry("/music/track.jpg"),
            fileEntry("/music/cover.png"),
            fileEntry("/music/notes.md"),
        ]);

        const { audioFiles, companionFiles } = await scanLocalMediaPaths([
            "/music",
        ]);
        expect(audioFiles.map(file => file.path)).toEqual([
            "/music/track.flac",
        ]);
        expect(companionFiles.map(file => file.path)).toEqual([
            "/music/track.lrc",
            "/music/track.jpg",
            "/music/cover.png",
        ]);
    });

    it("scans an authorized SAF directory and keeps companion files", async () => {
        mockScanAndroidSafDirectoryFiles.mockResolvedValue([
            {
                uri: "content://music/song-1",
                name: "Song One.mp3",
                kind: "audio",
                parentUri: "content://music/dir",
                documentId: "primary:Music/Song One.mp3",
            },
            {
                uri: "content://music/song-1-lrc",
                name: "Song One.lrc",
                kind: "lyric",
                parentUri: "content://music/dir",
            },
            {
                uri: "content://music/cover",
                name: "cover.jpg",
                kind: "cover",
                parentUri: "content://music/dir",
            },
        ]);

        await expect(scanLocalMediaPaths([
            "content://com.android.externalstorage.documents/tree/primary%3AMusic",
        ])).resolves.toEqual({
            audioFiles: [
                {
                    path: "content://music/song-1",
                    name: "Song One.mp3",
                    directory: "content://music/dir",
                    legacyPath: "/storage/emulated/0/Music/Song One.mp3",
                },
            ],
            companionFiles: [
                {
                    path: "content://music/song-1-lrc",
                    name: "Song One.lrc",
                    directory: "content://music/dir",
                },
                {
                    path: "content://music/cover",
                    name: "cover.jpg",
                    directory: "content://music/dir",
                },
            ],
        });
        expect(mockStat).not.toHaveBeenCalled();
        expect(mockReadDir).not.toHaveBeenCalled();
    });

    it("stops promptly when an import is cancelled", async () => {
        await expect(scanLocalMediaPaths(
            ["/music/song.mp3"],
            () => false,
        )).rejects.toThrow("Import Broken");
        expect(mockStat).not.toHaveBeenCalled();
    });

    it("recognizes supported extensions case-insensitively", () => {
        expect(isSupportedLocalMedia("/music/SONG.OPUS")).toBe(true);
        expect(isSupportedLocalMedia("/music/cover.png")).toBe(false);
    });
});
