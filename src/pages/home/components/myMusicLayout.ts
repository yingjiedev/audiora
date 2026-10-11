/** Fill one page with complete covers, without exposing the next page's text. */
export function getRecentPageLayout(viewportWidth: number, gap: number, minimumWidth: number) {
    const width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : minimumWidth;
    const safeGap = Math.min(Math.max(0, gap), width / 4);
    const columns = Math.max(1, Math.min(3, Math.floor((width + safeGap) / (minimumWidth + safeGap))));
    return { width, columns, gap: safeGap, coverWidth: (width - (columns - 1) * safeGap) / columns };
}
