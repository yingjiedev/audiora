import axios from "axios";
import Config from "@/core/appConfig";
import PluginManager from "@/core/pluginManager";
import installPluginFromUrl from "./installPluginFromUrl";

jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("@/core/appConfig", () => ({ getConfig: jest.fn() }));
jest.mock("@/core/pluginManager", () => ({ installPluginFromCode: jest.fn() }));
const get = jest.mocked(axios.get);
const install = jest.mocked(PluginManager.installPluginFromCode);
beforeEach(() => jest.resetAllMocks());

it("limits overlapping downloads to three and reports completed plugin counts", async () => {
    const urls = Array.from({ length: 7 }, (_, index) => `https://source/${index}.js`);
    const waiting: Array<() => void> = [];
    let active = 0;
    let maximum = 0;
    get.mockImplementation(async url => {
        if (String(url).includes(".json")) {
            return { data: { plugins: urls.map(pluginUrl => ({ url: pluginUrl })) } };
        }
        active++;
        maximum = Math.max(maximum, active);
        await new Promise<void>(resolve => waiting.push(resolve));
        active--;
        return { data: String(url) };
    });
    install.mockResolvedValue({ success: true, status: "unchanged" });
    const progress = jest.fn();
    const pending = installPluginFromUrl(" https://source/plugins.json?version=1 ", { onProgress: progress });
    await Promise.resolve();
    await Promise.resolve();
    expect(waiting).toHaveLength(3);
    while (waiting.length || active) {
        waiting.splice(0).forEach(resolve => resolve());
        for (let i = 0; i < 12; i++) {
            await Promise.resolve();
        }
    }
    const results = await pending;
    expect(maximum).toBe(3);
    expect(results).toHaveLength(7);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ total: 7, results }));
    expect(get).toHaveBeenCalledWith("https://source/plugins.json?version=1", expect.objectContaining({ timeout: 10_000, signal: expect.anything() }));
});

it("keeps successes and reports each failed download or installation", async () => {
    get.mockImplementation(async url => {
        if (url === "https://source/bad.js") {
            throw new Error("Offline");
        }
        return { data: "code" };
    });
    install.mockResolvedValueOnce({ success: true, status: "installed" }).mockResolvedValueOnce({ success: false, message: "Invalid code" });
    const results = await installPluginFromUrl("https://source/list.json", { pluginUrls: ["https://source/a.js", "https://source/bad.js", "https://source/c.js"] });
    expect(results.filter(result => result.success)).toHaveLength(1);
    expect(results.filter(result => !result.success)).toHaveLength(2);
    expect(results.map(result => result.pluginUrl).sort()).toEqual(["https://source/a.js", "https://source/bad.js", "https://source/c.js"]);
});

it("does not install a download that resolves after cancellation", async () => {
    let finish!: (value: any) => void;
    get.mockImplementation(() => new Promise(resolve => {
        finish = resolve;
    }));
    const controller = new AbortController();
    const pending = installPluginFromUrl("https://source/plugin.js", { signal: controller.signal });
    controller.abort();
    finish({ data: "code" });
    expect(await pending).toEqual([]);
    expect(install).not.toHaveBeenCalled();
});

it.each([{}, { plugins: [] }, { plugins: [null] }])("rejects an invalid manifest without installing anything (%j)", async data => {
    get.mockResolvedValue({ data });
    expect(await installPluginFromUrl("https://source/plugins.json")).toEqual([expect.objectContaining({ success: false })]);
    expect(install).not.toHaveBeenCalled();
});

it("passes a trimmed direct URL and version policy to the serial installer", async () => {
    get.mockResolvedValue({ data: "code" });
    install.mockResolvedValue({ success: true, status: "updated" });
    jest.mocked(Config.getConfig).mockReturnValue(true);
    await installPluginFromUrl(" https://source/plugin.js ");
    expect(install).toHaveBeenCalledWith("code", "https://source/plugin.js", expect.objectContaining({ notCheckVersion: true }));
});

it("imports an explicit custom source URL without treating its extension as a subscription", async () => {
    get.mockResolvedValue({ data: "source code" });
    install.mockResolvedValue({ success: true, status: "installed" });
    await installPluginFromUrl(" https://source/resolver.json ", { scriptSource: true });
    expect(get).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledWith("source code", "https://source/resolver.json", expect.objectContaining({ scriptSource: true }));
});
