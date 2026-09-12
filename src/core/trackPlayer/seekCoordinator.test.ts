import SeekCoordinator from "./seekCoordinator";

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

describe("SeekCoordinator", () => {
    it("notifies after a seek is applied", async () => {
        const coordinator = new SeekCoordinator();
        const performSeek = jest.fn(async () => undefined);
        const onApplied = jest.fn();

        await coordinator.seek(42, performSeek, onApplied);

        expect(performSeek).toHaveBeenCalledWith(42);
        expect(onApplied).toHaveBeenCalledWith(42);
    });

    it("does not notify when the native seek fails", async () => {
        const coordinator = new SeekCoordinator();
        const error = new Error("seek failed");
        const onApplied = jest.fn();

        await expect(coordinator.seek(
            42,
            async () => Promise.reject(error),
            onApplied,
        )).rejects.toBe(error);

        expect(onApplied).not.toHaveBeenCalled();
    });

    it("only notifies the latest overlapping seek", async () => {
        const coordinator = new SeekCoordinator();
        const first = deferred<void>();
        const second = deferred<void>();
        const onApplied = jest.fn();
        const performSeek = jest.fn((position: number) =>
            position === 10 ? first.promise : second.promise,
        );

        const firstSeek = coordinator.seek(10, performSeek, onApplied);
        const secondSeek = coordinator.seek(80, performSeek, onApplied);

        second.resolve();
        await secondSeek;
        first.resolve();
        await firstSeek;

        expect(onApplied).toHaveBeenCalledTimes(1);
        expect(onApplied).toHaveBeenCalledWith(80);
    });
});
