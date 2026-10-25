/** Window breakpoints describe the app's current space, including split screen. */
export function adaptiveLayout(width: number, height: number, hasPane = false) {
    const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
    const wide = safeWidth >= 600;
    const navigationWidth = !wide ? 0 : safeWidth >= 1200 ? 224 : 80;
    const paneWidth = safeWidth >= 1200 ? 360 : 320;
    // Leave 480dp for the main content and 48dp for its horizontal gutters.
    const canShowPane = wide && safeWidth - navigationWidth - paneWidth - 16 >= 528;
    const showPane = hasPane && canShowPane;
    return {
        wide,
        navigationWidth,
        canShowPane,
        showPane,
        paneWidth,
        contentWidth: Math.max(0, safeWidth - navigationWidth - (showPane ? paneWidth + 16 : 0)),
        splitPlayer: safeWidth >= 840 && height >= 480,
    };
}

export function panelLayout(width: number, height: number, topInset = 0, bottomInset = 0) {
    const side = width >= 600 && width > height;
    return {
        side,
        width: side ? Math.min(480, width) : width,
        maxHeight: Math.max(0, height - topInset - bottomInset),
    };
}
