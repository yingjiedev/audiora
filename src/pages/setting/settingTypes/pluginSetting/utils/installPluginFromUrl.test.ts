import axios from "axios";
import Config from "@/core/appConfig";
import PluginManager from "@/core/pluginManager";
import installPluginFromUrl from "./installPluginFromUrl";

jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("@/core/appConfig", () => ({ getConfig: jest.fn() }));
jest.mock("@/core/pluginManager", () => ({ installPluginFromUrl: jest.fn() }));

const install = jest.mocked(PluginManager.installPluginFromUrl);
const get = jest.mocked(axios.get);

beforeEach(() => jest.resetAllMocks());

it("loads a trimmed JSON URL without cache and installs every plugin sequentially", async () => {
    get.mockResolvedValue({ data: { plugins: [{ url: "https://source/a.js" }, { url: "https://source/b.js" }] } });
    jest.mocked(Config.getConfig).mockReturnValue(true);
    let finishFirst!: () => void;
    install.mockImplementationOnce(() => new Promise(resolve => {
        finishFirst = () => resolve({ success: true, pluginUrl: "https://source/a.js" });
    })).mockResolvedValueOnce({ success: true, pluginUrl: "https://source/b.js" });

    const pending = installPluginFromUrl(" https://source/plugins.json ");
    await Promise.resolve();
    expect(get).toHaveBeenCalledWith("https://source/plugins.json", expect.objectContaining({
        headers: expect.objectContaining({ "Cache-Control": "no-cache" }),
    }));
    expect(install).toHaveBeenCalledTimes(1);
    finishFirst();
    const results = await pending;
    expect(results).toHaveLength(2);
    expect(results.every(result => result.success)).toBe(true);
    expect(install).toHaveBeenNthCalledWith(2, "https://source/b.js", { notCheckVersion: true });
});

it("keeps every plugin result when one install throws", async () => {
    get.mockResolvedValue({ data: { plugins: [{ url: "https://source/a.js" }, { url: "https://source/b.js" }] } });
    install.mockRejectedValueOnce(new Error("Download failed")).mockResolvedValueOnce({ success: true });
    await expect(installPluginFromUrl("https://source/plugins.json")).resolves.toEqual([
        { success: false, message: "Download failed", pluginUrl: "https://source/a.js" },
        { success: true },
    ]);
});

it("reports a failed manifest download with its URL", async () => {
    get.mockRejectedValue(new Error("Offline"));
    await expect(installPluginFromUrl("https://source/plugins.json")).resolves.toEqual([
        { success: false, message: "Offline", pluginUrl: "https://source/plugins.json" },
    ]);
    expect(install).not.toHaveBeenCalled();
});

it("installs a direct JavaScript URL without fetching a manifest", async () => {
    install.mockResolvedValue({ success: true });
    await expect(installPluginFromUrl(" https://source/plugin.js ")).resolves.toEqual([{ success: true }]);
    expect(install).toHaveBeenCalledWith("https://source/plugin.js", expect.anything());
    expect(get).not.toHaveBeenCalled();
});
