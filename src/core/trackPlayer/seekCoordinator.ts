export default class SeekCoordinator {
    private revision = 0;

    async seek(
        position: number,
        performSeek: (position: number) => Promise<void>,
        onApplied: (position: number) => void,
    ): Promise<void> {
        const revision = ++this.revision;

        await performSeek(position);

        if (revision === this.revision) {
            onApplied(position);
        }
    }
}
