package `fun`.xwj.musicfree.lyricUtil

import android.content.Intent
import com.facebook.react.bridge.*

class LyricUtilModule(private val reactContext: ReactApplicationContext): ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "LyricUtil"

    @ReactMethod
    fun setCompactNotificationFavorite(favorite: Boolean, promise: Promise) {
        try {
            // 用 action intent 转发给 MusicService（补丁里处理），
            // 避免编译期依赖 node_modules 里的类
            val intent = Intent("mf.compact.favstate").apply {
                setClassName(
                    reactContext.packageName,
                    "com.doublesymmetry.trackplayer.service.MusicService",
                )
                putExtra("favorite", favorite)
            }
            try {
                reactContext.startService(intent)
            } catch (_: IllegalStateException) {
                // 服务不在前台（通知也不存在），状态无需更新；
                // 不能走 startForegroundService：补丁对 mf.compact.* 提前
                // return，不会调 startForeground，5 秒超时会崩
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    // Required by NativeEventEmitter on JS side
    @ReactMethod
    fun addListener(eventName: String) { /* no-op, listener count tracked by JS */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }

}
