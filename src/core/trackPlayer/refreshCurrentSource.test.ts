import { refreshCurrentSource } from "./refreshCurrentSource";

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(resolvePromise => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

function createOptions() {
    let current = true;
    const options = {
        isTargetCurrent: jest.fn(() => current),
        getProgress: jest.fn(async () => 73),
        getShouldPlay: jest.fn(async () => false),
        getFreshSource: jest.fn(async () => ({ url: "https://fresh.example/song" })),
        adaptSource: jest.fn(async source => ({
            ...source,
            url: "http://127.0.0.1/adapted",
        })),
        applySource: jest.fn(async () => undefined),
        restoreProgress: jest.fn(async () => undefined),
    };

    return {
        options,
        setCurrent(value: boolean) {
            current = value;
        },
    };
}

describe("refreshCurrentSource", () => {
    it("replaces the source while preserving paused state and progress", async () => {
        const { options } = createOptions();

        await expect(refreshCurrentSource(options)).resolves.toBe(true);

        expect(options.applySource).toHaveBeenCalledWith(
            { url: "http://127.0.0.1/adapted" },
            false,
        );
        expect(options.restoreProgress).toHaveBeenCalledWith(73);
    });

    it("resumes playback when the original track was playing", async () => {
        const { options } = createOptions();
        options.getShouldPlay.mockResolvedValueOnce(true);

        await expect(refreshCurrentSource(options)).resolves.toBe(true);

        expect(options.applySource).toHaveBeenCalledWith(
            { url: "http://127.0.0.1/adapted" },
            true,
        );
    });

    it("reports a failure when the current track has no fresh source", async () => {
        const { options } = createOptions();
        options.getFreshSource.mockResolvedValueOnce(null as never);

        await expect(refreshCurrentSource(options)).resolves.toBe(false);

        expect(options.applySource).not.toHaveBeenCalled();
        expect(options.restoreProgress).not.toHaveBeenCalled();
    });

    it("does not rebuild the player for a non-current track", async () => {
        const { options, setCurrent } = createOptions();
        setCurrent(false);

        await expect(refreshCurrentSource(options)).resolves.toBe(true);

        expect(options.getProgress).not.toHaveBeenCalled();
        expect(options.getFreshSource).not.toHaveBeenCalled();
        expect(options.applySource).not.toHaveBeenCalled();
    });

    it("discards a source resolved after the user switches tracks", async () => {
        const source = deferred<{ url: string } | null>();
        const { options, setCurrent } = createOptions();
        options.getFreshSource.mockReturnValueOnce(source.promise);

        const refreshing = refreshCurrentSource(options);
        await Promise.resolve();
        await Promise.resolve();
        setCurrent(false);
        source.resolve({ url: "https://stale.example/song" });

        await expect(refreshing).resolves.toBe(true);
        expect(options.adaptSource).not.toHaveBeenCalled();
        expect(options.applySource).not.toHaveBeenCalled();
        expect(options.restoreProgress).not.toHaveBeenCalled();
    });

    it("does not restore old progress when switching during player rebuild", async () => {
        const applying = deferred<void>();
        const { options, setCurrent } = createOptions();
        options.applySource.mockReturnValueOnce(applying.promise);

        const refreshing = refreshCurrentSource(options);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        setCurrent(false);
        applying.resolve();

        await expect(refreshing).resolves.toBe(true);
        expect(options.restoreProgress).not.toHaveBeenCalled();
    });
});
