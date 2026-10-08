import Mp3Util from "@/native/mp3Util";
import Cenc from "@/native/cenc";
import { adaptMediaSourceForPlayback } from "./mediaSourceAdapter";
import { QmcKeyError } from "@/service/mflac/songKey";

jest.mock("@/native/mp3Util", () => ({
    __esModule: true,
    default: { registerMflacStream: jest.fn() },
}));
jest.mock("@/native/cenc", () => ({
    __esModule: true,
    default: { registerStream: jest.fn() },
}));

beforeEach(() => jest.resetAllMocks());

it("leaves ordinary audio unchanged", async () => {
    const source = Object.freeze({ url: "https://host/song.flac" });
    expect(await adaptMediaSourceForPlayback(source)).toBe(source);
    expect(Mp3Util.registerMflacStream).not.toHaveBeenCalled();
});
it("passes canonical raw keys and headers to native without mutating cached sources", async () => {
    (Mp3Util.registerMflacStream as jest.Mock).mockResolvedValue("http://127.0.0.1/audio");
    const source = Object.freeze({ url: "https://host/a.mflac", qmcRawKey: "hex:001122ff", headers: { Authorization: "user-provided" } });
    expect(await adaptMediaSourceForPlayback(source)).toEqual({ ...source, url: "http://127.0.0.1/audio", headers: undefined });
    expect(Mp3Util.registerMflacStream).toHaveBeenCalledWith(source.url, "base64:ABEi/w==", source.headers);
    expect(source.url).toBe("https://host/a.mflac");
});
it.each([
    { url: "https://host/a.mflac" },
    { url: "https://host/opaque", ekey: "wrapped" },
    { url: "https://host/a.mflac", qmcRawKey: "!invalid" },
])("refuses unsupported encrypted sources without calling native %#", async source => {
    await expect(adaptMediaSourceForPlayback(source)).rejects.toThrow(QmcKeyError);
    expect(Mp3Util.registerMflacStream).not.toHaveBeenCalled();
});
it("propagates native failures instead of returning encrypted remote bytes", async () => {
    (Mp3Util.registerMflacStream as jest.Mock).mockRejectedValue(new Error("native failure"));
    await expect(adaptMediaSourceForPlayback({ url: "https://host/a.mflac", qmcRawKey: "AA==" })).rejects.toThrow("Encrypted source could not be opened");
});
it.each([undefined, null, ""])("rejects missing native proxy URLs (%s)", async localUrl => {
    (Mp3Util.registerMflacStream as jest.Mock).mockResolvedValue(localUrl);
    await expect(adaptMediaSourceForPlayback({ url: "https://host/a.mflac", qmcRawKey: "AA==" })).rejects.toThrow("Encrypted source could not be opened");
});
it("keeps CENC on its external CEK path", async () => {
    (Cenc.registerStream as jest.Mock).mockResolvedValue("http://127.0.0.1/cenc");
    await adaptMediaSourceForPlayback({ url: "https://host/a.m4a", cek: "external-cek" });
    expect(Cenc.registerStream).toHaveBeenCalledWith("https://host/a.m4a", "external-cek", undefined);
    expect(Mp3Util.registerMflacStream).not.toHaveBeenCalled();
});

it("requires conversion before importing local encrypted files even with a key", async () => {
    await expect(adaptMediaSourceForPlayback({
        url: "file:///music/a.mflac", qmcRawKey: "AA==",
    })).rejects.toThrow(QmcKeyError);
    expect(Mp3Util.registerMflacStream).not.toHaveBeenCalled();
});
