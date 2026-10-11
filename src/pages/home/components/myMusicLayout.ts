/** Fit complete covers and a small next-cover preview inside the measured strip. */
export function getRecentCoverWidth(viewportWidth: number, gap: number, minimumWidth: number) {
    if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return minimumWidth;
    const safeGap = Math.min(Math.max(0, gap), viewportWidth / 4);
    const columns = Math.max(1, Math.min(4, Math.floor((viewportWidth - safeGap) / (minimumWidth + safeGap))));
    return (viewportWidth - (columns + 1) * safeGap) / columns;
}
