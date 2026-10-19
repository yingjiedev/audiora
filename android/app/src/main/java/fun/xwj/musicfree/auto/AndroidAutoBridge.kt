package `fun`.xwj.musicfree.auto

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.AtomicFile
import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.util.ArrayDeque
import java.util.concurrent.Executors

/** Process-local ordered commands; disk holds browsing metadata only. */
object AndroidAutoBridge {
    private val main = Handler(Looper.getMainLooper())
    private val disk = Executors.newSingleThreadExecutor()
    private val pending = ArrayDeque<Bundle>()
    private var nextId = 0L
    private var revision = 0L
    private var initialized = false
    @Volatile var catalog = AndroidAutoCatalog.EMPTY
        private set
    var onCatalogChanged: (() -> Unit)? = null
    var onError: ((String) -> Unit)? = null

    @Synchronized fun initialize(context: Context) {
        if (initialized) return
        initialized = true
        val expectedRevision = revision
        disk.execute {
            try {
                val loaded = AndroidAutoCatalog.parse(catalogFile(context).openRead().bufferedReader().use { it.readText() })
                synchronized(this) {
                    if (revision == expectedRevision) catalog = loaded
                }
                main.post { onCatalogChanged?.invoke() }
            } catch (_: java.io.FileNotFoundException) {
                // First launch has no queue yet.
            } catch (error: Exception) {
                Log.w("AudioraAuto", "Cannot restore browsing catalog", error)
            }
        }
    }

    @Synchronized fun publishCatalog(context: Context, raw: String) {
        catalog = AndroidAutoCatalog.parse(raw)
        revision++
        main.post { onCatalogChanged?.invoke() }
        disk.execute {
            val file = catalogFile(context)
            var stream: java.io.FileOutputStream? = null
            try {
                stream = file.startWrite()
                stream.write(raw.toByteArray(Charsets.UTF_8))
                file.finishWrite(stream)
            } catch (error: Exception) {
                file.failWrite(stream)
                Log.w("AudioraAuto", "Cannot persist browsing catalog", error)
            }
        }
    }

    @Synchronized fun enqueue(context: Context, command: String, extras: Bundle? = null) {
        if (pending.size >= 100) {
            reportError("操作过于频繁，请稍后重试")
            return
        }
        pending.add(Bundle(extras ?: Bundle()).apply {
            putDouble("id", (++nextId).toDouble())
            putString("command", command)
            putDouble("createdAt", System.currentTimeMillis().toDouble())
        })
        main.post {
            val reactContext = (context.applicationContext as ReactApplication).reactHost?.currentReactContext
            if (reactContext?.hasActiveReactInstance() == true) {
                runCatching {
                    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("audiora-auto-command", null)
                }.onFailure { Log.w("AudioraAuto", "JS unavailable; command remains queued", it) }
            }
        }
    }

    @Synchronized fun takeCommands(): WritableArray = Arguments.createArray().apply {
        while (pending.isNotEmpty()) pushMap(Arguments.fromBundle(pending.removeFirst()))
    }

    fun reportError(message: String) {
        Log.w("AudioraAuto", message)
        main.post { onError?.invoke(message) }
    }

    private fun catalogFile(context: Context) = AtomicFile(File(context.filesDir, "android_auto_catalog.json"))
}
