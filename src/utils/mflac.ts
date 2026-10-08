/** Recognize encrypted container paths, including signed URLs and local files. */
export function isMflacUrl(url?: string): boolean {
    if (!url) {
        return false;
    }
    return /\.(?:mflac0?|mgg|mmp4)$/i.test(url.split(/[?#]/)[0]);
}
