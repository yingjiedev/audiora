import { getAndroidAutoMediaId } from "@/utils/androidAutoCatalog";

export interface AndroidAutoCommand {
    id: number;
    command: string;
    createdAt: number;
    mediaId?: string;
    query?: string;
    position?: number;
}

interface CarPlayer {
    readonly playList: IMusic.IMusicItem[];
    readonly currentMusic: IMusic.IMusicItem | null;
    play: (item?: IMusic.IMusicItem | null, forcePlay?: boolean) => Promise<void>;
    pause: () => Promise<void>;
    skipToNext: () => Promise<void>;
    skipToPrevious: () => Promise<void>;
    seekTo: (position: number) => Promise<void>;
}

export async function executeAndroidAutoCommand(
    command: AndroidAutoCommand,
    player: CarPlayer,
    stop: () => Promise<void>,
    now = Date.now(),
) {
    if (!Number.isFinite(command.createdAt) || now - command.createdAt > 30000 || command.createdAt > now + 1000) {
        throw new Error("车机指令已过期，请重试");
    }
    switch (command.command) {
    case "play": {
        const target = player.currentMusic ?? player.playList[0];
        if (!target) {
            throw new Error("请先在手机中添加播放列表");
        }
        // Resume uses the existing position; forcePlay would seek to zero.
        return player.play(target);
    }
    case "playId": {
        const target = player.playList.find(item => getAndroidAutoMediaId(item) === command.mediaId);
        if (!target) {
            throw new Error("歌曲已移出播放列表，请刷新列表");
        }
        return player.play(target, true);
    }
    case "search": {
        const query = command.query?.trim().toLocaleLowerCase();
        if (!query) {
            return executeAndroidAutoCommand({ ...command, command: "play" }, player, stop, now);
        }
        const target = player.playList.find(item =>
            [item.title, item.artist, item.album].some(value => value?.toLocaleLowerCase().includes(query)),
        );
        if (!target) {
            throw new Error("当前列表中没有匹配的歌曲");
        }
        return player.play(target, true);
    }
    case "pause": return player.pause();
    case "stop": return stop();
    case "next": return player.skipToNext();
    case "previous": return player.skipToPrevious();
    case "seek":
        if (typeof command.position !== "number" || !Number.isFinite(command.position) || command.position < 0) {
            throw new Error("无效的播放进度");
        }
        return player.seekTo(command.position);
    default: throw new Error("不支持的车机指令");
    }
}

/** Dispatch once, in arrival order. The player's revisions cancel superseded
 * source requests; pause/next must not wait for a stalled plugin to finish. */
export function createAndroidAutoCommandConsumer(dependencies: {
    ready: () => Promise<void>;
    takeCommands: () => Promise<AndroidAutoCommand[]>;
    execute: (command: AndroidAutoCommand) => Promise<void>;
    reportError: (message: string) => void;
}) {
    let running: Promise<void> | null = null;
    let requested = false;
    return function drain(): Promise<void> {
        requested = true;
        if (running) {
            return running;
        }
        running = Promise.resolve().then(async () => {
            try {
                await dependencies.ready();
                while (requested) {
                    requested = false;
                    let commands = await dependencies.takeCommands();
                    while (commands.length) {
                        for (const command of commands) {
                            try {
                                dependencies.execute(command).catch(error => {
                                    dependencies.reportError(error instanceof Error ? error.message : String(error));
                                });
                            } catch (error) {
                                dependencies.reportError(error instanceof Error ? error.message : String(error));
                            }
                        }
                        commands = await dependencies.takeCommands();
                    }
                }
            } catch (error) {
                dependencies.reportError(error instanceof Error ? error.message : String(error));
            } finally {
                running = null;
            }
        });
        return running;
    };
}
