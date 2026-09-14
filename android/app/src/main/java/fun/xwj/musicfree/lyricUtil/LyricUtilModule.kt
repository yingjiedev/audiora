package `fun`.xwj.musicfree.lyricUtil

import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class LyricUtilModule(private val reactContext: ReactApplicationContext): ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "LyricUtil"
    private var lyricView: LyricView? = null
    private val positionPrefsName = "MusicFreeDesktopLyricPosition"
    private val positionLeftKey = "leftPercent"
    private val positionTopKey = "topPercent"
    private val positionPrefs by lazy {
        reactContext.getSharedPreferences(positionPrefsName, Context.MODE_PRIVATE)
    }

    private fun savePositionToNative(leftPercent: Double, topPercent: Double) {
        positionPrefs.edit()
            .putFloat(positionLeftKey, leftPercent.coerceIn(0.0, 1.0).toFloat())
            .putFloat(positionTopKey, topPercent.coerceIn(0.0, 1.0).toFloat())
            .apply()
    }

    private fun readPositionFromNative(): Pair<Double, Double>? {
        val left = positionPrefs.getFloat(positionLeftKey, Float.NaN)
        val top = positionPrefs.getFloat(positionTopKey, Float.NaN)
        if (left.isNaN() || top.isNaN()) return null
        return Pair(
            left.toDouble().coerceIn(0.0, 1.0),
            top.toDouble().coerceIn(0.0, 1.0),
        )
    }

    @ReactMethod
    fun showStatusBarLyric(initLyric: String?, options: ReadableMap?, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                if (lyricView == null) {
                    lyricView = LyricView(reactContext).also { lv ->
                        lv.onLockStateChanged = { locked ->
                            val payload = Arguments.createMap().apply { putBoolean("locked", locked) }
                            emitEvent("LyricUtil:onLockStateChanged", payload)
                        }
                        lv.onPresetChanged = { index ->
                            val payload = Arguments.createMap().apply { putInt("index", index) }
                            emitEvent("LyricUtil:onPresetChanged", payload)
                        }
                        lv.onPresetLongPressed = { index ->
                            val payload = Arguments.createMap().apply { putInt("index", index) }
                            emitEvent("LyricUtil:onPresetLongPress", payload)
                        }
                        lv.onFontSizeChanged = { fontSize ->
                            val payload = Arguments.createMap().apply { putDouble("fontSize", fontSize.toDouble()) }
                            emitEvent("LyricUtil:onFontSizeChanged", payload)
                        }
                        lv.onPositionChanged = { leftPercent, topPercent ->
                            savePositionToNative(leftPercent, topPercent)
                            val payload = Arguments.createMap().apply {
                                putDouble("leftPercent", leftPercent)
                                putDouble("topPercent", topPercent)
                            }
                            emitEvent("LyricUtil:onPositionChanged", payload)
                        }
                        lv.onClose = {
                            val payload = Arguments.createMap()
                            emitEvent("LyricUtil:onClose", payload)
                        }
                    }
                }
                var hasTopPercent = false
                var hasLeftPercent = false
                val mapOptions = mutableMapOf<String, Any>().apply {
                    options?.let { opts ->
                        if (opts.hasKey("topPercent") && !opts.isNull("topPercent")) {
                            put("topPercent", opts.getDouble("topPercent"))
                            hasTopPercent = true
                        }
                        if (opts.hasKey("leftPercent") && !opts.isNull("leftPercent")) {
                            put("leftPercent", opts.getDouble("leftPercent"))
                            hasLeftPercent = true
                        }
                        if (opts.hasKey("align")) put("align", opts.getInt("align"))
                        opts.getString("color")?.let { put("color", it) }
                        opts.getString("backgroundColor")?.let { put("backgroundColor", it) }
                        if (opts.hasKey("widthPercent")) put("widthPercent", opts.getDouble("widthPercent"))
                        if (opts.hasKey("fontSize")) put("fontSize", opts.getDouble("fontSize"))
                        if (opts.hasKey("secondaryFontRatio")) put("secondaryFontRatio", opts.getDouble("secondaryFontRatio"))
                        if (opts.hasKey("secondaryAlphaRatio")) put("secondaryAlphaRatio", opts.getDouble("secondaryAlphaRatio"))
                        opts.getString("sungColor")?.let { put("sungColor", it) }
                        if (opts.hasKey("presetIndex")) put("presetIndex", opts.getInt("presetIndex"))
                        // Parse presets array
                        if (opts.hasKey("presets") && !opts.isNull("presets")) {
                            val presetsArr = opts.getArray("presets")
                            if (presetsArr != null) {
                                val presetList = (0 until presetsArr.size()).mapNotNull { i ->
                                    presetsArr.getMap(i)?.let { m ->
                                        mapOf(
                                            "unsungColor" to (m.getString("unsungColor") ?: "#FFE9D2FF"),
                                            "sungColor" to (m.getString("sungColor") ?: "#FFFFFFFF"),
                                            "backgroundColor" to (m.getString("backgroundColor") ?: "#84888153"),
                                        )
                                    }
                                }
                                put("presets", presetList)
                            }
                        }
                    }

                    // Native 持久化兜底：当 JS 未传入位置时恢复上次拖动位置
                    readPositionFromNative()?.let { (savedLeft, savedTop) ->
                        if (!hasLeftPercent) {
                            put("leftPercent", savedLeft)
                        }
                        if (!hasTopPercent) {
                            put("topPercent", savedTop)
                        }
                    }
                }

                try {
                    lyricView?.showLyricWindow(initLyric, mapOptions)
                    promise.resolve(true)
                } catch (e: Exception) {
                    promise.reject("Exception", e.message)
                }
            }
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun hideStatusBarLyric(promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.hideLyricWindow()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricText(lyric: String, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setText(lyric)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricAlign(alignment: Int, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setAlign(alignment)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricTop(pct: Double, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setTopPercent(pct)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricLeft(pct: Double, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setLeftPercent(pct)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricWidth(pct: Double, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setWidth(pct)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricFontSize(fontSize: Float, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setFontSize(fontSize)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarColors(textColor: String?, backgroundColor: String?, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setColors(textColor, backgroundColor)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    // ==================== Desktop Word-by-Word Lyric ====================

    @ReactMethod
    fun setDesktopLyricLine(data: ReadableMap, promise: Promise) {
        try {
            val lineId = data.getString("lineId") ?: ""
            val primaryText = data.getString("primaryText") ?: ""
            val lineStartMs = if (data.hasKey("lineStartMs") && !data.isNull("lineStartMs")) data.getDouble("lineStartMs").toLong() else 0L
            val lineDurationMs = if (data.hasKey("lineDurationMs") && !data.isNull("lineDurationMs")) data.getDouble("lineDurationMs").toLong() else null

            // Parse primaryWords
            val primaryWords: List<DesktopLyricView.WordData>? = if (data.hasKey("primaryWords") && !data.isNull("primaryWords")) {
                val arr = data.getArray("primaryWords")
                if (arr != null && arr.size() > 0) {
                    (0 until arr.size()).mapNotNull { i ->
                        val wordMap = arr.getMap(i) ?: return@mapNotNull null
                        DesktopLyricView.WordData(
                            text = wordMap.getString("text") ?: "",
                            startTime = if (wordMap.hasKey("startTime")) wordMap.getDouble("startTime").toLong() else 0L,
                            duration = if (wordMap.hasKey("duration")) wordMap.getDouble("duration").toLong().coerceAtLeast(0) else 0L,
                            space = if (wordMap.hasKey("space")) wordMap.getBoolean("space") else false,
                        )
                    }
                } else null
            } else null

            // Parse secondaryLines
            val secondaryLines: List<DesktopLyricView.SecondaryLine> = if (data.hasKey("secondaryLines") && !data.isNull("secondaryLines")) {
                val arr = data.getArray("secondaryLines")
                if (arr != null) {
                    (0 until arr.size()).mapNotNull { i ->
                        val lineMap = arr.getMap(i) ?: return@mapNotNull null
                        DesktopLyricView.SecondaryLine(
                            type = lineMap.getString("type") ?: "translation",
                            text = lineMap.getString("text") ?: "",
                        )
                    }
                } else emptyList()
            } else emptyList()

            val line = DesktopLyricView.LyricLine(
                lineId = lineId,
                primaryText = primaryText,
                primaryWords = primaryWords,
                secondaryLines = secondaryLines,
                lineStartMs = lineStartMs,
                lineDurationMs = lineDurationMs,
            )

            UiThreadUtil.runOnUiThread {
                lyricView?.setDesktopLyricLine(line)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun syncPlaybackState(state: ReadableMap, promise: Promise) {
        try {
            val statusStr = state.getString("status") ?: "stopped"
            val positionMs = if (state.hasKey("positionMs")) state.getDouble("positionMs").toLong() else 0L
            val speed = if (state.hasKey("speed")) state.getDouble("speed").toFloat() else 1f
            val isSeek = if (state.hasKey("isSeek")) state.getBoolean("isSeek") else false

            val status = when (statusStr) {
                "playing" -> DesktopLyricView.PlaybackStatus.PLAYING
                "paused" -> DesktopLyricView.PlaybackStatus.PAUSED
                else -> DesktopLyricView.PlaybackStatus.STOPPED
            }

            val snapshot = DesktopLyricView.PlaybackSnapshot(
                status = status,
                positionMs = positionMs,
                speed = speed,
                updatedAtElapsed = SystemClock.elapsedRealtime(),
                isSeek = isSeek,
            )

            UiThreadUtil.runOnUiThread {
                lyricView?.syncPlaybackState(snapshot)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setSungColor(color: String?, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setSungColor(color)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun lockDesktopLyric(promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.lockDesktopLyric()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun unlockDesktopLyric(promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.unlockDesktopLyric()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setColorPreset(index: Int, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setColorPreset(index)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setSecondaryFontRatio(ratio: Float, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setSecondaryFontRatio(ratio)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setSecondaryAlphaRatio(ratio: Float, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setSecondaryAlphaRatio(ratio)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

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

    private fun emitEvent(eventName: String, payload: WritableMap) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, payload)
        } catch (_: Exception) {}
    }

    // Required by NativeEventEmitter on JS side
    @ReactMethod
    fun addListener(eventName: String) { /* no-op, listener count tracked by JS */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }

}
