import downloader from "../downloader";
import { DownloadFailReason } from "../downloadTypes";
import Mp3Util from "@/native/mp3Util";

jest.mock("@/constants/commonConst", () => ({ internalSerializeKey: "$", supportLocalMediaType: [] }));
jest.mock("@/constants/pathConst", () => ({ __esModule: true, default: {}, getDownloadMusicPath: () => "/music" }));
jest.mock("@/utils/fileUtils", () => ({ removeFileScheme: (v: string) => v.replace("file://", ""), mkdirR: jest.fn() }));
jest.mock("@/utils/mediaExtra", () => ({}));
jest.mock("@/utils/mediaUtils", () => ({ getMediaUniqueKey: () => "test_1" }));
jest.mock("@/utils/network", () => ({}));
jest.mock("@/utils/fileNamingFormatter", () => ({}));
jest.mock("@/utils/androidSaf", () => ({ isAndroidSafUri: () => false }));
jest.mock("../downloadPath", () => ({}));
jest.mock("../downloadHistory", () => ({}));
jest.mock("../localMusicSheet", () => ({}));
jest.mock("../downloadCompanionFiles", () => ({}));
jest.mock("../musicMetadataManager", () => ({}));
jest.mock("@/native/cenc", () => ({ __esModule: true, default: { isAvailable: () => true } }));
jest.mock("@/native/mp3Util", () => ({
    __esModule: true,
    default: { isMflacDecryptAvailable: () => true, decryptMflacToFlac: jest.fn(async () => true) },
}));

const subject = downloader as any;
beforeEach(() => {
    jest.clearAllMocks();
    subject.configService = { getConfig: () => undefined };
    subject.pluginManagerService = { getByName: () => undefined };
});
it.each([
    { url: "https://host/a.mflac" },
    { url: "https://host/opaque", ekey: "legacy" },
    { url: "file:///a.mflac" },
    { url: "https://host/a.mflac", qmcRawKey: "invalid!" },
])("rejects unsupported fallback sources before starting downloads %#", async source => {
    expect(await subject.resolveTaskForNative({ id: "1", platform: "test", ...source })).toEqual({ failReason: DownloadFailReason.MissingDecryptionKey });
});
it("does not fall back to a stale opaque URL after rejecting plugin EKey", async () => {
    subject.pluginManagerService = { getByName: () => ({ instance: {}, methods: { getMediaSource: async () => ({ url: "https://host/opaque", ekey: "wrapped" }) } }) };
    expect(await subject.resolveTaskForNative({ id: "1", platform: "test", url: "https://host/opaque" })).toEqual({ failReason: DownloadFailReason.MissingDecryptionKey });
});
it("passes raw song keys to the file decoder without truncating them", async () => {
    await subject.flushDownloadedAudio({ willDownloadEncrypted: true, tempEncryptedPath: "/a.part", targetDownloadPath: "/a.flac", mflacRawSongKey: "base64:ABEi/w==" });
    expect(Mp3Util.decryptMflacToFlac).toHaveBeenCalledWith("/a.part", "/a.flac", "base64:ABEi/w==");
});
it("rejects pre-migration tasks containing only mflacEkey", async () => {
    await expect(subject.flushDownloadedAudio({ willDownloadEncrypted: true, tempEncryptedPath: "/a.part", targetDownloadPath: "/a.flac", mflacEkey: "legacy" })).rejects.toThrow("raw song key");
    expect(Mp3Util.decryptMflacToFlac).not.toHaveBeenCalled();
});

it("retains raw keys in the resolved native download task", async () => {
    subject.generateFilename = jest.fn(() => "audio");
    subject.getDownloadPath = jest.fn(() => "/music/audio.flac");
    subject.resolveUniqueDownloadPaths = jest.fn(async () => ({ targetDownloadPath: "/music/audio.flac", tempEncryptedPath: "/music/audio.part", filename: "audio.flac" }));
    const resolved = await subject.resolveTaskForNative({ id: "1", platform: "test", url: "https://host/audio.mflac", qmcRawKey: "hex:001122ff" });
    expect(resolved.runtimeInfo).toMatchObject({ willDownloadEncrypted: true, mflacRawSongKey: "base64:ABEi/w==" });
    expect(resolved.nativeParams.url).toBe("https://host/audio.mflac");
});
it("can choose a supported lower-quality source after rejecting legacy EKey", async () => {
    const getMediaSource = jest.fn()
        .mockResolvedValueOnce({ url: "https://host/opaque", ekey: "wrapped" })
        .mockResolvedValue({ url: "file:///music/audio.flac" });
    subject.pluginManagerService = { getByName: () => ({ instance: {}, methods: { getMediaSource } }) };
    expect(await subject.resolveTaskForNative({ id: "1", platform: "test" })).toMatchObject({ localFilePath: "/music/audio.flac" });
});
