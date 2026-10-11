/** Literal, case-insensitive search highlighting without interpreting regex syntax. */
export function splitTitleHighlight(title: string, keyword?: string) {
    const text = String(title ?? "");
    const query = keyword?.trim();
    if (!query) return [{ text, highlight: false }];
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const parts: Array<{ text: string; highlight: boolean }> = [];
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
        if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index), highlight: false });
        parts.push({ text: match[0], highlight: true });
        cursor = match.index + match[0].length;
    }
    if (cursor < text.length || !parts.length) parts.push({ text: text.slice(cursor), highlight: false });
    return parts;
}
