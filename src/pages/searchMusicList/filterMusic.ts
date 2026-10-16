export function filterMusic(query: string, musicList: IMusic.IMusicItem[], platformName: (platform: string) => string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return musicList;
    return musicList.filter(item => [item.title, item.artist, item.album, platformName(item.platform)].filter(Boolean).join(" ").toLowerCase().includes(normalized));
}
