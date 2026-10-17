/** Local listening aggregates. No stream URLs, lyrics or location data are retained. */
export type ListeningSong = Pick<IMusic.IMusicItem, "id" | "platform" | "title" | "artist" | "artwork">;
export type ListeningDay = {
    date: string;
    seconds: number;
    plays: number;
    hours: number[];
    songs: Array<{ song: ListeningSong; seconds: number; plays: number }>;
};
export type ListeningData = { version: 1; startedAt: number; days: ListeningDay[] };
const MAX_DAYS = 400;
const MAX_SONGS_PER_DAY = 100;

export function localDateKey(time: number | Date) {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateFromKey(key: string) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function songKey(song: ListeningSong) {
    return JSON.stringify([song.platform, song.id]);
}

function cleanSong(value: any): ListeningSong | undefined {
    if (!value || !["string", "number"].includes(typeof value.id) || String(value.id).length === 0 || typeof value.platform !== "string" || !value.platform) return;
    return {
        id: value.id,
        platform: value.platform,
        title: typeof value.title === "string" ? value.title : undefined,
        artist: typeof value.artist === "string" ? value.artist : undefined,
        artwork: typeof value.artwork === "string" ? value.artwork : undefined,
    };
}

const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function restoreListeningData(raw: string | undefined, now = Date.now()): ListeningData {
    const empty: ListeningData = { version: 1, startedAt: now, days: [] };
    try {
        const saved = JSON.parse(raw ?? "null");
        if (saved?.version !== 1 || !nonnegative(saved.startedAt) || !Array.isArray(saved.days)) return empty;
        const dates = new Set<string>();
        const days: ListeningDay[] = saved.days.filter((day: any) => {
            if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || localDateKey(dateFromKey(day.date)) !== day.date || dates.has(day.date)) return false;
            if (!nonnegative(day.seconds) || !Number.isInteger(day.plays) || day.plays < 0 || !Array.isArray(day.hours) || day.hours.length !== 24 || !day.hours.every(nonnegative) || !Array.isArray(day.songs)) return false;
            dates.add(day.date);
            return true;
        }).map((day: ListeningDay) => {
            const songs = new Set<string>();
            return {
                date: day.date, seconds: day.seconds, plays: day.plays, hours: [...day.hours],
                songs: day.songs.flatMap(entry => {
                    const song = cleanSong(entry?.song);
                    if (!song || !nonnegative(entry.seconds) || !Number.isInteger(entry.plays) || entry.plays < 0 || songs.has(songKey(song))) return [];
                    songs.add(songKey(song));
                    return [{ song, seconds: entry.seconds, plays: entry.plays }];
                }).slice(0, MAX_SONGS_PER_DAY),
            };
        }).sort((a: ListeningDay, b: ListeningDay) => a.date.localeCompare(b.date)).slice(-MAX_DAYS);
        return { version: 1, startedAt: saved.startedAt, days };
    } catch {
        return empty;
    }
}

/** Split measured playback at local hour/day boundaries, including DST transitions. */
export function addListeningInterval(data: ListeningData, song: ListeningSong, from: number, to: number, countPlay: boolean) {
    if (!cleanSong(song) || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) return data;
    const days = [...data.days];
    let cursor = from;
    while (cursor < to) {
        const date = localDateKey(cursor);
        const index = days.findIndex(day => day.date === date);
        const previous = index >= 0 ? days[index] : { date, seconds: 0, plays: 0, hours: Array(24).fill(0), songs: [] };
        const day: ListeningDay = { ...previous, hours: [...previous.hours], songs: previous.songs.map(entry => ({ ...entry })) };
        // Walk at most to the next real minute; avoid skipping a repeated local hour at DST fallback.
        const end = Math.min(to, Math.floor(cursor / 60000) * 60000 + 60000);
        const seconds = (end - cursor) / 1000;
        const play = countPlay ? 1 : 0;
        day.seconds += seconds;
        day.plays += play;
        day.hours[new Date(cursor).getHours()] += seconds;
        const entry = day.songs.find(item => songKey(item.song) === songKey(song));
        if (entry) {
            entry.seconds += seconds;
            entry.plays += play;
            entry.song = cleanSong(song)!;
        } else if (day.songs.length < MAX_SONGS_PER_DAY) {
            day.songs.push({ song: cleanSong(song)!, seconds, plays: play });
        }
        if (index >= 0) days[index] = day;
        else days.push(day);
        countPlay = false;
        cursor = end;
    }
    return { ...data, days: days.sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_DAYS) };
}

export function calendarDays(data: ListeningData, count: number, now = Date.now()) {
    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    const lookup = new Map(data.days.map(day => [day.date, day]));
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(end);
        date.setDate(date.getDate() - count + 1 + index);
        const key = localDateKey(date);
        return lookup.get(key) ?? { date: key, seconds: 0, plays: 0, hours: Array(24).fill(0), songs: [] };
    });
}

export function summarizeListening(days: ListeningDay[]) {
    const songs = new Map<string, ListeningDay["songs"][number]>();
    const hours = Array(24).fill(0) as number[];
    let seconds = 0;
    let plays = 0;
    let activeDays = 0;
    let streak = 0;
    let longestStreak = 0;
    for (const day of days) {
        seconds += day.seconds;
        plays += day.plays;
        if (day.seconds > 0) {
            activeDays++;
            longestStreak = Math.max(longestStreak, ++streak);
        } else streak = 0;
        day.hours.forEach((value, hour) => {
            hours[hour] += value;
        });
        for (const entry of day.songs) {
            const key = songKey(entry.song);
            const previous = songs.get(key);
            songs.set(key, { song: entry.song, seconds: (previous?.seconds ?? 0) + entry.seconds, plays: (previous?.plays ?? 0) + entry.plays });
        }
    }
    return {
        seconds, plays, activeDays, longestStreak,
        favoriteHour: seconds > 0 ? hours.indexOf(Math.max(...hours)) : undefined,
        topSongs: [...songs.values()].sort((a, b) => b.seconds - a.seconds || b.plays - a.plays).slice(0, 5),
    };
}

/** A seek, a pause or a long gap must never turn into listening time. */
export class ListeningProgressTracker {
    private last?: { key: string; position: number; at: number };
    private currentKey?: string;
    private counted = false;
    private pendingSeconds = 0;
    private playing = false;

    constructor(private record: (song: ListeningSong, from: number, to: number, count: boolean) => void) {}

    setPlaying(playing: boolean) {
        if (this.playing !== playing || !playing) this.last = undefined;
        this.playing = playing;
    }

    changeTrack(song?: ListeningSong) {
        const key = song && cleanSong(song) ? songKey(song) : undefined;
        this.last = undefined;
        if (key !== this.currentKey) {
            this.currentKey = key;
            this.counted = false;
            this.pendingSeconds = 0;
        }
    }

    progress(song: ListeningSong | undefined, position: number, now = Date.now()) {
        if (!song || !cleanSong(song) || !this.playing || !Number.isFinite(position) || !Number.isFinite(now) || position < 0) {
            this.last = undefined;
            return;
        }
        const key = songKey(song);
        if (key !== this.currentKey) this.changeTrack(song);
        const previous = this.last;
        this.last = { key, position, at: now };
        if (!previous || previous.key !== key) return;
        const elapsed = (now - previous.at) / 1000;
        const advance = position - previous.position;
        if (elapsed <= 0 || elapsed > 5 || advance <= 0 || advance > elapsed * 4 + 0.5) return;
        // Use elapsed time, rather than track position, so playback speed does not inflate totals.
        const seconds = elapsed;
        this.pendingSeconds += seconds;
        const count = !this.counted && this.pendingSeconds >= 1;
        if (count) this.counted = true;
        this.record(song, now - seconds * 1000, now, count);
    }
}
