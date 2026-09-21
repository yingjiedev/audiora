import { NativeModules } from "react-native";

/**
 * 原生歌词工具模块的 JS 包装。
 *
 * 只保留歌词解密 / 解析相关能力（QQ 音乐 QRC）。
 * 桌面歌词（悬浮窗）相关 API 已随该功能一并移除。
 */

const { LyricUtil: NativeLyricUtil } = NativeModules;

class LyricUtilManager {
    private nativeModule = NativeLyricUtil;

    private canCall(methodName: string): boolean {
        return !!this.nativeModule && typeof this.nativeModule[methodName] === "function";
    }

    async decryptQRCLyric(encryptedHex: string): Promise<string> {
        if (!this.canCall("decryptQRCLyric")) {
            throw new Error("decryptQRCLyric not available in native module");
        }
        return this.nativeModule.decryptQRCLyric(encryptedHex);
    }

    isAvailable(): boolean {
        return !!this.nativeModule;
    }
}

export const LyricUtil = new LyricUtilManager();
export default LyricUtil;
