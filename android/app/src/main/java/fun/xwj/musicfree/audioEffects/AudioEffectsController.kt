package `fun`.xwj.musicfree.audioEffects

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

/** Main-thread owner, independent of React's lifetime so locked-screen/headless playback restores effects. */
object AudioEffectsController {
    private lateinit var context: Context
    private var settings = AudioEffectsSettings()
    private var sessionId = 0
    private var processor: AudioEffectsProcessor? = null
    private var status = "waiting"
    private var version = 0L
    private val observers = mutableSetOf<() -> Unit>()

    fun initialize(application: Context) {
        if (::context.isInitialized) return
        context = application.applicationContext
        val stored = context.getSharedPreferences("audiora.audio-effects", Context.MODE_PRIVATE).getString("settings", null)
        settings = try {
            stored?.let { AudioEffectsSettings.fromJson(JSONObject(it)) } ?: AudioEffectsSettings()
        } catch (_: Exception) { AudioEffectsSettings() }
        ContextCompat.registerReceiver(context, object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val incoming = intent.getIntExtra("sessionId", 0)
                if (intent.getBooleanExtra("closing", false)) {
                    if (incoming == sessionId) attachSession(0)
                } else {
                    attachSession(incoming)
                }
            }
        }, IntentFilter(context.packageName + ".audio-effects.SESSION"), ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    private fun attachSession(id: Int) {
        if (id == sessionId && processor != null) return
        releaseProcessor()
        // Session 0 is the global output: never attach an app effect to it.
        sessionId = id.coerceAtLeast(0)
        status = "waiting"
        if (sessionId > 0) bindProcessor()
        notifyObservers()
    }

    private fun bindProcessor() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                processor = DynamicsEffectsProcessor(sessionId)
                applySettings()
                if (processor != null) {
                    observeControl()
                    return
                }
            } catch (error: Exception) {
                Log.w("AudioraAudioEffects", "Dynamics processing unavailable", error)
                releaseProcessor()
            }
        }
        try {
            processor = LegacyEffectsProcessor(sessionId)
            applySettings()
        } catch (error: Exception) {
            Log.w("AudioraAudioEffects", "Equalizer unavailable", error)
            releaseProcessor()
            status = "unsupported"
        }
        observeControl()
    }

    private fun observeControl() {
        processor?.effect?.setControlStatusListener { _, granted ->
            if (granted) applySettings(force = true)
            notifyObservers()
        }
    }

    private fun applySettings(force: Boolean = false) {
        try {
            processor?.apply(settings, force)
            status = "ready"
        } catch (error: Exception) {
            Log.w("AudioraAudioEffects", "Unable to apply audio effects", error)
            releaseProcessor()
            status = "error"
        }
    }

    private fun releaseProcessor() {
        try { processor?.release() } catch (_: Exception) { }
        processor = null
    }

    fun setSettings(json: String, persist: Boolean): String {
        settings = AudioEffectsSettings.fromJson(JSONObject(json))
        if (persist) {
            context.getSharedPreferences("audiora.audio-effects", Context.MODE_PRIVATE)
                .edit().putString("settings", settings.toJson().toString()).apply()
        }
        if (sessionId > 0) {
            if (processor == null) bindProcessor() else applySettings()
        }
        notifyObservers()
        return getState()
    }

    fun getState(): String {
        val current = processor
        val hasControl = try { current?.effect?.hasControl() == true } catch (_: Exception) { false }
        val currentStatus = if (current != null && !hasControl) "error" else status
        return JSONObject()
            .put("version", version)
            .put("settings", settings.toJson())
            .put("status", currentStatus)
            .put("active", settings.enabled && current != null && hasControl && status == "ready")
            .put("frequencies", JSONArray(current?.frequencies ?: emptyList<Double>()))
            .put("minimumGain", current?.minimumGain ?: -6.0)
            .put("maximumGain", current?.maximumGain ?: 6.0)
            .put("supportsPreamp", current?.supportsPreamp ?: false)
            .put("supportsLimiter", current?.supportsPreamp ?: false)
            .toString()
    }

    fun addObserver(observer: () -> Unit) { observers.add(observer) }
    fun removeObserver(observer: () -> Unit) { observers.remove(observer) }
    private fun notifyObservers() {
        version += 1
        observers.toList().forEach { it() }
    }
}
