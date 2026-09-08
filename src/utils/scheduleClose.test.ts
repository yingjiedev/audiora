jest.mock("@/core/trackPlayer", () => ({
    __esModule: true,
    default: {
        pause: jest.fn(async () => undefined),
        once: jest.fn(),
        off: jest.fn(),
        pauseAfterCurrentTrack: jest.fn(),
        cancelPauseAfterCurrentTrack: jest.fn(),
    },
}));

jest.mock("@/utils/persistStatus", () => ({
    __esModule: true,
    default: {
        get: jest.fn(() => null),
        set: jest.fn(),
    },
}));

jest.mock("react-native-background-timer", () => ({
    __esModule: true,
    default: {
        clearTimeout: jest.fn(),
        setTimeout: jest.fn(() => 1),
    },
}));

import { TrackPlayerEvents } from "@/core.defination/trackPlayer";
import TrackPlayer from "@/core/trackPlayer";
import PersistStatus from "@/utils/persistStatus";
import BackgroundTimer from "react-native-background-timer";
import { setCloseAfterPlayEnd, setScheduleClose } from "./scheduleClose";

describe("scheduleClose", () => {
    const now = 1_750_000_000_000;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Date, "now").mockReturnValue(now);
        setCloseAfterPlayEnd(false);
        setScheduleClose(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("persists and arms a future deadline", () => {
        setScheduleClose(now + 60_000);

        expect(PersistStatus.set).toHaveBeenLastCalledWith(
            "app.scheduleCloseDeadline",
            now + 60_000,
        );
        expect(BackgroundTimer.setTimeout).toHaveBeenLastCalledWith(
            expect.any(Function),
            60_000,
        );
    });

    it("pauses playback when the deadline is reached", async () => {
        setScheduleClose(now + 60_000);
        const timerCalls = (BackgroundTimer.setTimeout as jest.Mock).mock.calls;
        const callback = timerCalls[timerCalls.length - 1][0];

        Date.now = jest.fn(() => now + 60_000);
        callback();
        await Promise.resolve();

        expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
        expect(PersistStatus.set).toHaveBeenLastCalledWith(
            "app.scheduleCloseDeadline",
            undefined,
        );
    });

    it("asks the player to pause at the current track end when requested", () => {
        setCloseAfterPlayEnd(true);
        setScheduleClose(now + 60_000);
        const timerCalls = (BackgroundTimer.setTimeout as jest.Mock).mock.calls;
        const callback = timerCalls[timerCalls.length - 1][0];

        Date.now = jest.fn(() => now + 60_000);
        callback();

        expect(TrackPlayer.once).toHaveBeenCalledWith(
            TrackPlayerEvents.PlayEnd,
            expect.any(Function),
        );
        expect(TrackPlayer.pauseAfterCurrentTrack).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.pause).not.toHaveBeenCalled();
    });

    it("clears the persisted deadline when cancelled", () => {
        setScheduleClose(now + 60_000);
        setScheduleClose(null);

        expect(PersistStatus.set).toHaveBeenLastCalledWith(
            "app.scheduleCloseDeadline",
            undefined,
        );
        expect(BackgroundTimer.clearTimeout).toHaveBeenCalled();
    });

    it("cancels a pending close-after-track request when the schedule changes", () => {
        setCloseAfterPlayEnd(true);
        setScheduleClose(now + 60_000);
        const timerCalls = (BackgroundTimer.setTimeout as jest.Mock).mock.calls;
        const callback = timerCalls[timerCalls.length - 1][0];

        Date.now = jest.fn(() => now + 60_000);
        callback();
        setScheduleClose(now + 30_000);

        expect(TrackPlayer.cancelPauseAfterCurrentTrack).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.off).toHaveBeenCalledWith(
            TrackPlayerEvents.PlayEnd,
            expect.any(Function),
        );
    });
});
