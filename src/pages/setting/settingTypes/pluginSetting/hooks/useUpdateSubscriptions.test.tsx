import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import Config from "@/core/appConfig";
import Toast from "@/utils/toast";
import { showDialog } from "@/components/dialogs/useDialog";
import installPluginFromUrl from "../utils/installPluginFromUrl";
import useUpdateSubscriptions from "./useUpdateSubscriptions";

jest.mock("@/core/appConfig", () => ({ getConfig: jest.fn() }));
jest.mock("@/core/i18n", () => ({
    useI18N: () => ({ t: (key: string, params?: { detail?: string }) => params?.detail ?? key }),
}));
jest.mock("@/utils/toast", () => ({ success: jest.fn(), warn: jest.fn() }));
jest.mock("@/components/dialogs/useDialog", () => ({ showDialog: jest.fn() }));
jest.mock("../utils/installPluginFromUrl", () => jest.fn());

const install = jest.mocked(installPluginFromUrl);
const subscriptions = jest.mocked(Config.getConfig);

describe("subscription updates", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    let state: ReturnType<typeof useUpdateSubscriptions>;

    function Probe() {
        state = useUpdateSubscriptions();
        return null;
    }

    beforeEach(() => {
        jest.resetAllMocks();
        act(() => {
            renderer = TestRenderer.create(<Probe />);
        });
    });

    afterEach(() => {
        act(() => renderer.unmount());
    });

    it("reports a failure beyond the first plugin and continues with the next subscription", async () => {
        subscriptions.mockReturnValue(JSON.stringify([{ url: "https://source/a.json" }, { url: "https://source/b.js" }]));
        install.mockResolvedValueOnce([
            { success: true, pluginUrl: "https://source/first.js" },
            { success: false, pluginUrl: "https://source/second.js", message: "Network failed" },
        ]).mockResolvedValueOnce([{ success: true }]);

        await act(async () => {
            await state.updateSubscriptions();
        });

        expect(install.mock.calls.map(call => call[0])).toEqual(["https://source/a.json", "https://source/b.js"]);
        expect(Toast.success).not.toHaveBeenCalled();
        expect(Toast.warn).toHaveBeenCalledWith("toast.partialPluginUpdateFailed", expect.anything());
        act(() => {
 jest.mocked(Toast.warn).mock.calls[0][1]!.onActionClick!();
        });
        expect(showDialog).toHaveBeenCalledWith("SimpleDialog", expect.objectContaining({
            content: expect.stringContaining("https://source/second.js"),
        }));
        expect(state.updating).toBe(false);
    });

    it("updates a legacy URL setting", async () => {
        subscriptions.mockReturnValue(" https://source/plugins.json ");
        install.mockResolvedValue([{ success: true }, { success: true }]);
        await act(async () => {
            await state.updateSubscriptions();
        });
        expect(install).toHaveBeenCalledWith("https://source/plugins.json");
        expect(Toast.success).toHaveBeenCalledWith("toast.updatePluginSuccess");
    });

    it.each([undefined, "", "[]"])("does not report an empty configuration as a successful update (%s)", async value => {
        subscriptions.mockReturnValue(value);
        await act(async () => {
            await state.updateSubscriptions();
        });
        expect(install).not.toHaveBeenCalled();
        expect(Toast.warn).toHaveBeenCalledWith("toast.noSubscription");
        expect(Toast.success).not.toHaveBeenCalled();
        expect(state.updating).toBe(false);
    });

    it("reports an empty manifest as invalid and keeps processing later subscriptions", async () => {
        subscriptions.mockReturnValue(JSON.stringify([{ url: "https://source/empty.json" }, { url: "https://source/ok.js" }]));
        install.mockResolvedValueOnce([]).mockResolvedValueOnce([{ success: true }]);
        await act(async () => {
            await state.updateSubscriptions();
        });
        expect(install).toHaveBeenCalledTimes(2);
        expect(Toast.warn).toHaveBeenCalledWith("toast.partialPluginUpdateFailed", expect.anything());
        expect(Toast.success).not.toHaveBeenCalled();
    });

    it("handles a malformed subscription without sending an invalid network request", async () => {
        subscriptions.mockReturnValue(JSON.stringify([null, { url: "  " }]));
        await act(async () => {
            await state.updateSubscriptions();
        });
        expect(install).not.toHaveBeenCalled();
        expect(Toast.warn).toHaveBeenCalledWith("toast.allPluginUpdateFailed", expect.anything());
    });

    it("ignores repeated taps while updating and allows another update after a failure", async () => {
        subscriptions.mockReturnValue("https://source/plugins.json");
        let reject!: (error: Error) => void;
        install.mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => {
            reject = rejectPromise;
        }));
        let pending!: Promise<void>;
        act(() => {
            pending = state.updateSubscriptions();
            state.updateSubscriptions();
        });
        expect(state.updating).toBe(true);
        expect(install).toHaveBeenCalledTimes(1);

        await act(async () => {
            reject(new Error("Unexpected failure"));
            await pending;
        });
        expect(state.updating).toBe(false);
        expect(Toast.warn).toHaveBeenCalledWith("toast.unknownError");

        install.mockResolvedValue([{ success: true }]);
        await act(async () => {
            await state.updateSubscriptions();
        });
        expect(install).toHaveBeenCalledTimes(2);
        expect(Toast.success).toHaveBeenCalledWith("toast.updatePluginSuccess");
    });
});
