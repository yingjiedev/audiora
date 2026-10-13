import { dateFromKey, ListeningDay, localDateKey } from "@/core/listeningStatsModel";

export type ActivityDay = ListeningDay & { recorded: boolean };

/** Monday-first calendar; padding is outside the requested range, never a zero record. */
export function activityWeeks(days: ListeningDay[], startedAt: number): Array<Array<ActivityDay | null>> {
    if (!days.length) return [];
    const startDate = localDateKey(startedAt);
    const offset = (dateFromKey(days[0].date).getDay() + 6) % 7;
    const cells: Array<ActivityDay | null> = Array(offset).fill(null);
    cells.push(...days.map(day => ({ ...day, recorded: day.date >= startDate || day.seconds > 0 || day.plays > 0 })));
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
}
