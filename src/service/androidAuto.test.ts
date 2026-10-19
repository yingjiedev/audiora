import { DeviceEventEmitter, NativeModules, Platform } from "react-native";
import bootstrap, { initTrackPlayer } from "@/entry/bootstrap/bootstrap";
import trackPlayer from "@/core/trackPlayer";
import { setupAndroidAutoService } from "./androidAuto";

jest.mock("@/entry/bootstrap/bootstrap", () => ({ __esModule: true, default: jest.fn(async () => undefined), initTrackPlayer: jest.fn(async () => undefined) }));
jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: {
        playList: [{ id: "1", platform: "source" }], currentMusic: { id: "1", platform: "source" },
        play: jest.fn(async () => undefined), pause: jest.fn(async () => undefined),
    },
}));
jest.mock("react-native-track-player", () => ({ __esModule: true, default: { stop: jest.fn(async () => undefined) } }));
jest.mock("jotai", () => ({ atom: jest.fn(), getDefaultStore: () => ({ get: () => ({ state: "Done" }) }) }));

it("installs the listener once and consumes commands queued before the headless service attached", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    const bridge = {
        isConnected: jest.fn(() => true),
        takeCommands: jest.fn().mockResolvedValueOnce([
            { id: 1, command: "play", createdAt: Date.now() },
            { id: 2, command: "pause", createdAt: Date.now() },
        ]).mockResolvedValue([]),
        reportError: jest.fn(),
    };
    NativeModules.AndroidAuto = bridge;
    const listener = jest.spyOn(DeviceEventEmitter, "addListener");
    setupAndroidAutoService();
    setupAndroidAutoService();
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(initTrackPlayer).toHaveBeenCalledTimes(1);
    expect(trackPlayer.play).toHaveBeenCalledWith(trackPlayer.currentMusic);
    expect(trackPlayer.pause).toHaveBeenCalledTimes(1);
    expect(bridge.reportError).not.toHaveBeenCalled();
    listener.mock.results[0].value.remove();
    listener.mockRestore();
    jest.restoreAllMocks();
    delete NativeModules.AndroidAuto;
});
