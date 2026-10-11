import { addListeningInterval, calendarDays, ListeningData } from "@/core/listeningStatsModel";
import { activityWeeks } from "./activityCalendar";

const at = (day: number) => new Date(2026, 9, day, 12).getTime();
const empty = (day = 11): ListeningData => ({ version: 1, startedAt: at(day), days: [] });
const song = { id: "song", platform: "local", title: "Song", artist: "Artist", artwork: "cover" };

describe("activity calendar", () => {
    it("aligns dates to Monday without inventing dates before the range or after today", () => {
        const weeks = activityWeeks(calendarDays(empty(), 91, at(13)), at(11));
        expect(weeks).toHaveLength(14);
        expect(weeks[0][0]).toBeNull();
        expect(weeks[0][1]).toBeNull();
        expect(weeks[0][2]?.date).toBe("2026-07-15");
        expect(weeks[13].map(day => day?.date ?? null)).toEqual(["2026-10-12", "2026-10-13", null, null, null, null, null]);
        expect(weeks.flat().filter(Boolean)).toHaveLength(91);
    });

    it("keeps an exact 13-week range when today is Sunday, including month boundaries", () => {
        const weeks = activityWeeks(calendarDays(empty(), 91, at(11)), at(11));
        expect(weeks).toHaveLength(13);
        expect(weeks[0][0]?.date).toBe("2026-07-13");
        expect(weeks[12][6]?.date).toBe("2026-10-11");
    });

    it("distinguishes before-recording dates, a recorded zero day and a brief active day", () => {
        const data = addListeningInterval(empty(10), song, at(11), at(11) + 41000, true);
        const cells = activityWeeks(calendarDays(data, 7, at(11)), data.startedAt).flat().filter(Boolean);
        expect(cells.find(day => day?.date === "2026-10-09")).toMatchObject({ recorded: false, seconds: 0 });
        expect(cells.find(day => day?.date === "2026-10-10")).toMatchObject({ recorded: true, seconds: 0 });
        expect(cells.find(day => day?.date === "2026-10-11")).toMatchObject({ recorded: true, seconds: 41 });
    });

    it("preserves real records before startedAt when a device clock has changed", () => {
        const data = addListeningInterval(empty(), song, at(9), at(9) + 1000, true);
        expect(activityWeeks(calendarDays(data, 7, at(11)), data.startedAt).flat().find(day => day?.date === "2026-10-09")).toMatchObject({ recorded: true, seconds: 1 });
        expect(activityWeeks([], data.startedAt)).toEqual([]);
    });
});
