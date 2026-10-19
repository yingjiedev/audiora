import { createAndroidAutoCommandConsumer, executeAndroidAutoCommand, AndroidAutoCommand } from "./androidAutoCommands";
import { getAndroidAutoMediaId } from "@/utils/androidAutoCatalog";

const song = (id: string, platform = "source") => ({ id, platform, title: id, artist: "Artist", album: "Album" } as IMusic.IMusicItem);
const command = (name: string, rest: Partial<AndroidAutoCommand> = {}): AndroidAutoCommand => ({
    id: 1, command: name, createdAt: Date.now(), ...rest,
});
function player() {
    return {
        playList: [song("1"), song("1", "other"), song("2")],
        currentMusic: song("1"),
        play: jest.fn(async () => undefined), pause: jest.fn(async () => undefined),
        skipToNext: jest.fn(async () => undefined), skipToPrevious: jest.fn(async () => undefined),
        seekTo: jest.fn(async () => undefined),
    };
}

it("resumes without forcing a seek to zero; selecting a song explicitly restarts it", async () => {
    const target = player();
    await executeAndroidAutoCommand(command("play"), target, jest.fn());
    expect(target.play).toHaveBeenLastCalledWith(target.currentMusic);
    await executeAndroidAutoCommand(command("playId", { mediaId: getAndroidAutoMediaId(target.playList[1]) }), target, jest.fn());
    expect(target.play).toHaveBeenLastCalledWith(target.playList[1], true);
});

it("rejects stale identities and unsuccessful searches instead of playing an unrelated song", async () => {
    const target = player();
    await expect(executeAndroidAutoCommand(command("playId", { mediaId: "1" }), target, jest.fn())).rejects.toThrow("移出");
    await expect(executeAndroidAutoCommand(command("search", { query: "missing" }), target, jest.fn())).rejects.toThrow("没有匹配");
    expect(target.play).not.toHaveBeenCalled();
    await executeAndroidAutoCommand(command("search", { query: " aRTist " }), target, jest.fn());
    expect(target.play).toHaveBeenCalledWith(target.playList[0], true);
});

it("preserves subsecond seek positions and leaves playback state to the player", async () => {
    const target = player();
    await executeAndroidAutoCommand(command("seek", { position: 12.345 }), target, jest.fn());
    expect(target.seekTo).toHaveBeenCalledWith(12.345);
    expect(target.play).not.toHaveBeenCalled();
    for (const position of [-1, NaN, Infinity, undefined]) {
        await expect(executeAndroidAutoCommand(command("seek", { position }), target, jest.fn())).rejects.toThrow("无效");
    }
});

it("rejects expired commands, empty queues and unsupported controls", async () => {
    const target = player();
    await expect(executeAndroidAutoCommand(command("play", { createdAt: Date.now() - 30001 }), target, jest.fn())).rejects.toThrow("过期");
    await expect(executeAndroidAutoCommand(command("play", { createdAt: NaN }), target, jest.fn())).rejects.toThrow("过期");
    await expect(executeAndroidAutoCommand(command("unknown"), target, jest.fn())).rejects.toThrow("不支持");
    await expect(executeAndroidAutoCommand(command("play"), { ...target, currentMusic: null, playList: [] }, jest.fn())).rejects.toThrow("添加");
});

it("delegates transport commands and stop to their existing playback paths", async () => {
    const target = player();
    const stop = jest.fn(async () => undefined);
    for (const name of ["next", "previous", "pause", "stop"]) {
        await executeAndroidAutoCommand(command(name), target, stop);
    }
    expect(target.skipToNext).toHaveBeenCalledTimes(1);
    expect(target.skipToPrevious).toHaveBeenCalledTimes(1);
    expect(target.pause).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
});

it("waits for readiness, dispatches in order and lets pause/next supersede a stalled source", async () => {
    let ready!: () => void;
    let finishFirst!: () => void;
    const readyPromise = new Promise<void>(resolve => {
        ready = resolve; 
    });
    const firstPromise = new Promise<void>(resolve => {
        finishFirst = resolve; 
    });
    const pending = [command("next"), command("pause")];
    const calls: string[] = [];
    const takeCommands = jest.fn(async () => pending.splice(0));
    const drain = createAndroidAutoCommandConsumer({
        ready: () => readyPromise, takeCommands,
        async execute(value) {
            calls.push(value.command);
            if (value.command === "next") {
                await firstPromise; 
            }
        },
        reportError: jest.fn(),
    });
    const running = drain();
    expect(drain()).toBe(running);
    expect(takeCommands).not.toHaveBeenCalled();
    ready();
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(calls).toEqual(["next", "pause"]);
    pending.push(command("previous"));
    await drain();
    expect(calls).toEqual(["next", "pause", "previous"]);
    finishFirst();
    await running;
    expect(calls).toEqual(["next", "pause", "previous"]);
});

it("reports readiness or command errors and can consume subsequent requests", async () => {
    const reportError = jest.fn();
    const ready = jest.fn().mockRejectedValueOnce(new Error("not ready")).mockResolvedValue(undefined);
    const takeCommands = jest.fn().mockResolvedValueOnce([command("play"), command("pause")]).mockResolvedValue([]);
    const execute = jest.fn().mockRejectedValueOnce(new Error("missing source")).mockResolvedValue(undefined);
    const drain = createAndroidAutoCommandConsumer({ ready, takeCommands, execute, reportError });
    await drain();
    expect(takeCommands).not.toHaveBeenCalled();
    await drain();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(reportError.mock.calls).toEqual([["not ready"], ["missing source"]]);
});
