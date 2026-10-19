import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import Config from "@/core/appConfig";
import Toast from "@/utils/toast";
import installPluginFromUrl from "../utils/installPluginFromUrl";
import useUpdateSubscriptions from "./useUpdateSubscriptions";

jest.mock("@/core/appConfig", () => ({ getConfig: jest.fn() }));
jest.mock("@/core/i18n", () => ({ useI18N: () => ({ t: (key: string) => key }) }));
jest.mock("@/utils/toast", () => ({ warn: jest.fn() }));
jest.mock("@/utils/getOrCreateMMKV", () => () => ({ getString: () => undefined, set: jest.fn() }));
jest.mock("../utils/installPluginFromUrl", () => jest.fn());
const install = jest.mocked(installPluginFromUrl);

it("shares an in-flight task across mounted pages and a page remount", async () => {
    let first!: ReturnType<typeof useUpdateSubscriptions>;
    let second!: ReturnType<typeof useUpdateSubscriptions>;
    let finish!: () => void;
    install.mockImplementation(async (_url, options) => {
        options!.onProgress!({ phase: "updating", total: 2, results: [{ success: true, status: "unchanged" }] });
        await new Promise<void>(resolve => {
            finish = resolve;
        });
        return [{ success: true, status: "unchanged" }, { success: true, status: "installed" }];
    });
    function First() {
        first = useUpdateSubscriptions(); return null;
    }
    function Second() {
        second = useUpdateSubscriptions(); return null;
    }
    let one!: TestRenderer.ReactTestRenderer;
    let two!: TestRenderer.ReactTestRenderer;
    act(() => {
        one = TestRenderer.create(<First />); two = TestRenderer.create(<Second />);
    });
    let pending!: Promise<void>;
    await act(async () => {
        pending = first.updateSubscriptions([{ name: "", url: "https://source/shared.json" }]);
    });
    expect(first.updating).toBe(true);
    expect(second.updating).toBe(true);
    act(() => one.unmount());
    act(() => {
        one = TestRenderer.create(<First />);
    });
    expect(first.updates["https://source/shared.json"].results).toHaveLength(1);
    await act(async () => {
        await second.updateSubscriptions([]);
    });
    expect(install).toHaveBeenCalledTimes(1);
    await act(async () => {
        finish(); await pending;
    });
    expect(first.updating).toBe(false);
    expect(second.updates["https://source/shared.json"].phase).toBe("finished");
    act(() => {
        one.unmount(); two.unmount();
    });
});

it("does not start a task for an empty or malformed configuration", async () => {
    let value!: ReturnType<typeof useUpdateSubscriptions>;
    function Probe() {
        value = useUpdateSubscriptions(); return null;
    }
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<Probe />);
    });
    jest.mocked(Config.getConfig).mockReturnValue("[]");
    await act(async () => {
        await value.updateSubscriptions();
    });
    expect(Toast.warn).toHaveBeenCalledWith("toast.noSubscription");
    jest.mocked(Config.getConfig).mockReturnValue("{bad");
    await act(async () => {
        await value.updateSubscriptions();
    });
    expect(Toast.warn).toHaveBeenCalledWith("toast.subscriptionInvalid");
    act(() => renderer.unmount());
});
