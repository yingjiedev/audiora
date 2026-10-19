import { createSubscriptionUpdateStore } from "./subscriptionUpdateStore";
import { parseSubscriptions, subscriptionName } from "./subscriptions";
jest.mock("./installPluginFromUrl", () => jest.fn());
const item = { name: "", url: "https://source/plugins.json" };

it("retains all plugin outcomes, persists results and retries only failed plugin URLs", async () => {
    const save = jest.fn();
    const good = { success: true, status: "unchanged" as const, pluginUrl: "https://source/good.js" };
    const bad = { success: false, pluginUrl: "https://source/bad.js", message: "Offline" };
    const install = jest.fn(async (_url, options) => {
        const results = options.pluginUrls ? [{ success: true, status: "updated" as const, pluginUrl: bad.pluginUrl }] : [good, bad];
        options.onProgress({ phase: "updating", total: results.length, results });
        return results;
    });
    const store = createSubscriptionUpdateStore({ install, save });
    const first = store.start([item]);
    expect(store.start([item])).toBe(first);
    await first;
    expect(store.getSnapshot().updates[item.url].results).toEqual([good, bad]);
    await store.start([item], true);
    expect(install.mock.calls[1][1].pluginUrls).toEqual([bad.pluginUrl]);
    expect(store.getSnapshot().updates[item.url]).toMatchObject({ phase: "finished", total: 2 });
    expect(store.getSnapshot().updates[item.url].results.every(result => result.success)).toBe(true);
    const restored = createSubscriptionUpdateStore({ read: () => save.mock.calls[1][0] });
    expect(restored.getSnapshot().updates[item.url].results).toHaveLength(2);
});

it("keeps completed changes on cancellation and never starts the next subscription", async () => {
    const good = { success: true, status: "installed" as const };
    const install = jest.fn(async (_url, options) => {
        options.onProgress({ phase: "updating", total: 3, results: [good] });
        await new Promise<void>(resolve => options.signal.addEventListener("abort", () => resolve(), { once: true }));
        return [good];
    });
    const store = createSubscriptionUpdateStore({ install });
    const pending = store.start([item, { name: "", url: "https://source/next.js" }]);
    await Promise.resolve();
    store.cancel();
    expect(store.getSnapshot().cancelling).toBe(true);
    await pending;
    expect(install).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().updates[item.url]).toMatchObject({ phase: "cancelled", total: 3, results: [good] });
    expect(store.getSnapshot().updates["https://source/next.js"].phase).toBe("cancelled");
    expect(store.getSnapshot().running).toBe(false);
});

it("aborts the batch at its deadline and releases the shared task guard", async () => {
    jest.useFakeTimers();
    try {
        const install = jest.fn(async (_url, options) => {
            await new Promise<void>(resolve => options.signal.addEventListener("abort", () => resolve(), { once: true }));
            return [];
        });
        const store = createSubscriptionUpdateStore({ install });
        const pending = store.start([item]);
        await Promise.resolve();
        jest.advanceTimersByTime(120_000);
        await pending;
        expect(store.getSnapshot()).toMatchObject({ running: false, updates: { [item.url]: { phase: "timedOut" } } });
        install.mockResolvedValueOnce([{ success: true }]);
        await store.start([item]);
        expect(store.getSnapshot().updates[item.url].phase).toBe("finished");
    } finally {
        jest.useRealTimers();
    }
});

it("isolates subscription failures and handles empty results without claiming success", async () => {
    const install = jest.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce([]);
    const store = createSubscriptionUpdateStore({ install, save: () => {
        throw new Error("Disk full");
    } });
    await store.start([item, { name: "", url: "https://source/empty.json" }]);
    expect(store.getSnapshot().running).toBe(false);
    expect(store.getSnapshot().updates[item.url].results[0]).toMatchObject({ success: false, message: "Offline" });
    expect(store.getSnapshot().updates["https://source/empty.json"].results[0].success).toBe(false);
});

it("reads legacy subscriptions and gives empty names a visible host fallback", () => {
    expect(parseSubscriptions(" https://source/plugins.json ")).toEqual([item]);
    expect(subscriptionName(item)).toBe("source");
    expect(subscriptionName({ ...item, name: " Custom " })).toBe("Custom");
    expect(parseSubscriptions("[]")).toEqual([]);
    expect(() => parseSubscriptions("{\"url\":\"bad\"}")).toThrow();
});
