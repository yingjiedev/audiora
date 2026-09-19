/**
 * 下载模块的公共枚举。
 *
 * 单独成文件的原因：`downloader.ts` 依赖原生模块、插件管理器和文件系统，
 * 而 `downloadHistory.ts` / 页面侧的状态映射只需要这几个枚举。
 * 拆出来既能避免 downloader ⇄ downloadHistory 的循环引用，
 * 也让只关心状态语义的测试不必把整条原生依赖链拉起来。
 */
export enum DownloadStatus {
    Pending,
    Preparing,
    Downloading,
    Completed,
    Error,
    /**
     * 用户主动暂停。与原生 PAUSED 对齐，不再混进 Pending：
     * Pending 是「排队等原生调度」，Paused 是「用户让它停在这」，UI 要给继续入口。
     */
    Paused,
}

export enum DownloadFailReason {
    NetworkOffline = "network-offline",
    NotAllowToDownloadInCellular = "not-allow-to-download-in-cellular",
    FailToFetchSource = "no-valid-source",
    NoWritePermission = "no-write-permission",
    Unknown = "unknown",
}

export enum DownloaderEvent {
    DownloadError = "download-error",
    DownloadTaskUpdate = "download-task-update",
    DownloadTaskError = "download-task-error",
    DownloadQueueCompleted = "download-queue-completed",
}
