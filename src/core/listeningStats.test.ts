export {};
const mockStore = { getString: jest.fn(), set: jest.fn() };
const mockJotai = jest.requireActual("jotai");
jest.mock("jotai", () => mockJotai);
jest.mock("@/utils/getOrCreateMMKV", () => ({ __esModule: true, default: () => mockStore }));

const song = { id: "one", platform: "source", title: "One", artist: "Artist", artwork: "cover" };
const load = () => require("./listeningStats") as typeof import("./listeningStats");

describe("local listening persistence", () => {
    beforeEach(() => {
        jest.resetModules();
        mockStore.getString.mockReset();
        mockStore.set.mockReset();
    });

    it("batches 100 ms native progress and flushes unsaved time when paused", () => {
        const stats = load();
        stats.listeningTracker.setPlaying(true);
        for (let index = 0; index <= 100; index++) stats.listeningTracker.progress(song, index / 10, 100000 + index * 100);
        expect(mockStore.set).toHaveBeenCalledTimes(2);
        stats.listeningTracker.setPlaying(false);
        stats.flushListeningStats();
        expect(mockStore.set).toHaveBeenCalledTimes(3);
        const saved = JSON.parse(mockStore.set.mock.calls[2][1]);
        expect(saved.days[0].seconds).toBeCloseTo(10);
        expect(saved.days[0].plays).toBe(1);
        stats.flushListeningStats();
        expect(mockStore.set).toHaveBeenCalledTimes(3);
    });

    it("restores measured totals after restart without inventing legacy history", () => {
        let stats = load();
        stats.listeningTracker.setPlaying(true);
        stats.listeningTracker.progress(song, 0, 100000);
        stats.listeningTracker.progress(song, 1, 101000);
        const saved = mockStore.set.mock.calls[0][1];
        jest.resetModules();
        mockStore.getString.mockReturnValue(saved);
        stats = load();
        stats.listeningTracker.setPlaying(true);
        stats.listeningTracker.progress(song, 1, 102000);
        stats.listeningTracker.progress(song, 2, 103000);
        const restored = JSON.parse(mockStore.set.mock.calls[1][1]);
        expect(restored.startedAt).toBe(JSON.parse(saved).startedAt);
        expect(restored.days[0]).toMatchObject({ seconds: 2, plays: 2 });
    });

    it("keeps statistics failure isolated from audio and retries failed persistence", () => {
        mockStore.getString.mockImplementation(() => {
            throw new Error("read failed");
        });
        const stats = load();
        mockStore.set.mockImplementationOnce(() => {
            throw new Error("write failed");
        });
        stats.listeningTracker.setPlaying(true);
        stats.listeningTracker.progress(song, 0, 100000);
        expect(() => stats.listeningTracker.progress(song, 1, 101000)).not.toThrow();
        stats.flushListeningStats();
        expect(mockStore.set).toHaveBeenCalledTimes(2);
        expect(JSON.parse(mockStore.set.mock.calls[1][1]).days[0].seconds).toBe(1);
    });
});
