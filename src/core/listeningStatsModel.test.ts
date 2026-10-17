import { addListeningInterval, calendarDays, countSongPlays, ListeningData, ListeningProgressTracker, localDateKey, restoreListeningData, songKey, summarizeListening } from "./listeningStatsModel";

const song = { id: "same-id", platform: "source-a", title: "Music", artist: "Artist", artwork: "cover" };
const at = (day: number, hour = 12, minute = 0, second = 0) => new Date(2026, 9, day, hour, minute, second).getTime();
const empty = (): ListeningData => ({ version: 1, startedAt: at(1), days: [] });

describe("listening aggregates", () => {
    it("sums all retained plays by typed platform/id, including songs outside report rankings", () => {
        let data = empty();
        const songs = Array.from({ length: 9 }, (_, index) => ({ ...song, id: String(index) }));
        for (const music of songs) data = addListeningInterval(data, music, at(10), at(10) + 1000, true);
        data = addListeningInterval(data, songs[8], at(11), at(11) + 1000, true);
        const otherPlatform = { ...songs[8], platform: "source-b" };
        const numericId = { ...songs[8], id: 8 } as any;
        data = addListeningInterval(data, otherPlatform, at(11), at(11) + 1000, true);
        data = addListeningInterval(data, numericId, at(11), at(11) + 1000, true);
        data.days[0].songs[8].plays = 123;
        const before = JSON.stringify(data);
        const counts = countSongPlays(data.days);
        expect(counts.size).toBe(11);
        expect(counts.get(songKey(songs[8]))).toBe(124);
        expect(counts.get(songKey(otherPlatform))).toBe(1);
        expect(counts.get(songKey(numericId))).toBe(1);
        expect(counts.get(songKey({ ...song, id: "absent" })) ?? 0).toBe(0);
        expect(countSongPlays([]).size).toBe(0);
        expect(JSON.stringify(data)).toBe(before);
    });

    it("splits playback across local midnight without duplicating the play count", () => {
        const before = empty();
        const result = addListeningInterval(before, song, at(10, 23, 59, 59), at(11, 0, 0, 2), true);
        expect(result.days.map(day => [day.date, day.seconds, day.plays])).toEqual([["2026-10-10", 1, 1], ["2026-10-11", 2, 0]]);
        expect(result.days[0].hours[23]).toBe(1);
        expect(result.days[1].hours[0]).toBe(2);
        expect(before.days).toEqual([]);
    });

    it("keeps IDs from different platforms separate and retains only display metadata", () => {
        let data = addListeningInterval(empty(), { ...song, url: "private-source", headers: { authorization: "secret" } } as any, at(10), at(10) + 3000, true);
        data = addListeningInterval(data, { ...song, platform: "source-b" }, at(10) + 4000, at(10) + 6000, true);
        const summary = summarizeListening(calendarDays(data, 7, at(11)));
        expect(summary.plays).toBe(2);
        expect(summary.seconds).toBe(5);
        expect(summary.topSongs).toHaveLength(2);
        expect(JSON.stringify(data)).not.toMatch(/private-source|secret|authorization/);
        expect(restoreListeningData(JSON.stringify(data))).toEqual(data);
    });

    it("fills missing dates and derives active days, streak, hour and rankings from the selected period", () => {
        let data = empty();
        for (const day of [1, 2, 4, 5, 6]) data = addListeningInterval(data, song, at(day, 22), at(day, 22) + 60000, true);
        const days = calendarDays(data, 7, at(7));
        expect(days.map(day => day.date)).toEqual(Array.from({ length: 7 }, (_, index) => `2026-10-0${index + 1}`));
        expect(summarizeListening(days)).toMatchObject({ seconds: 300, plays: 5, activeDays: 5, longestStreak: 3, favoriteHour: 22 });
        expect(summarizeListening(calendarDays(data, 1, at(7)))).toMatchObject({ seconds: 0, activeDays: 0, favoriteHour: undefined, topSongs: [] });
    });

    it.each([undefined, "not json", "{}", "{\"version\":2}", "null"])("restores invalid or missing statistics as empty: %s", raw => {
        expect(restoreListeningData(raw, at(11))).toEqual({ version: 1, startedAt: at(11), days: [] });
    });

    it("rejects invalid dates, counters and duplicates without accepting unrelated source fields", () => {
        const valid = addListeningInterval(empty(), song, at(10), at(10) + 1000, true).days[0];
        const saved = { ...empty(), days: [null, { ...valid, date: "2026-02-30" }, { ...valid, seconds: -1 }, valid, valid] };
        expect(restoreListeningData(JSON.stringify(saved)).days).toEqual([valid]);
    });

    it("bounds storage to 400 days and 100 ranked songs per day without losing daily totals", () => {
        let data = empty();
        for (let day = 0; day < 410; day++) {
            const start = new Date(2025, 0, 1 + day, 12).getTime();
            data = addListeningInterval(data, song, start, start + 1000, true);
        }
        expect(data.days).toHaveLength(400);
        const start = at(11);
        for (let index = 0; index < 110; index++) data = addListeningInterval(data, { ...song, id: String(index) }, start, start + 1000, true);
        const lastDay = data.days.find(day => day.date === localDateKey(start))!;
        expect(lastDay.songs).toHaveLength(100);
        expect(lastDay.plays).toBe(110);
        expect(lastDay.seconds).toBe(110);
    });
});

describe("measured native playback", () => {
    let record: jest.Mock;
    let tracker: ListeningProgressTracker;
    beforeEach(() => {
        record = jest.fn();
        tracker = new ListeningProgressTracker(record);
        tracker.setPlaying(true);
    });

    it("records real elapsed listening and counts once per song, including variable playback speed", () => {
        tracker.progress(song, 0, 1000);
        tracker.progress(song, 0.5, 2000);
        tracker.progress(song, 2.5, 3000);
        expect(record.mock.calls).toEqual([[song, 1000, 2000, true], [song, 2000, 3000, false]]);
    });

    it("does not count loading, paused gaps, seeking, stalled buffering or delayed events", () => {
        tracker.setPlaying(false);
        tracker.progress(song, 0, 1000);
        tracker.progress(song, 1, 2000);
        tracker.setPlaying(true);
        tracker.progress(song, 2, 3000);
        tracker.progress(song, 200, 4000);
        tracker.progress(song, 10, 5000);
        tracker.progress(song, 10, 6000);
        tracker.progress(song, 20, 20000);
        expect(record).not.toHaveBeenCalled();
        tracker.progress(song, 21, 21000);
        expect(record).toHaveBeenCalledWith(song, 20000, 21000, true);
        tracker.setPlaying(false);
        tracker.setPlaying(true);
        tracker.progress(song, 21, 60000);
        expect(record).toHaveBeenCalledTimes(1);
    });

    it("counts a new song after measured playback but does not recount source refreshes or resumes", () => {
        tracker.progress(song, 0, 1000);
        tracker.progress(song, 1, 2000);
        tracker.changeTrack(song);
        tracker.progress(song, 1, 3000);
        tracker.progress(song, 2, 4000);
        const next = { ...song, platform: "other-source" };
        tracker.progress(next, 0, 5000);
        tracker.progress(next, 1, 6000);
        expect(record.mock.calls.map(call => call[3])).toEqual([true, false, true]);
        tracker.changeTrack(undefined);
        tracker.progress(song, 0, 7000);
        tracker.progress(song, 1, 8000);
        expect(record.mock.calls[3][3]).toBe(true);
    });

    it("requires one second before counting a play and rejects malformed or non-song events", () => {
        tracker.progress(song, 0, 1000);
        tracker.progress(song, 0.1, 1100);
        tracker.progress(song, 0.2, 1200);
        expect(record.mock.calls.map(call => call[3])).toEqual([false, false]);
        tracker.progress(undefined, 1, 1300);
        tracker.progress({ ...song, id: "" }, 1, 1400);
        tracker.progress(song, NaN, 1500);
        expect(record).toHaveBeenCalledTimes(2);
    });
});
