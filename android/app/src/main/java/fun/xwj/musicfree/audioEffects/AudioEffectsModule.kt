package `fun`.xwj.musicfree.audioEffects

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class AudioEffectsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val handler = Handler(Looper.getMainLooper())
    private val observer: () -> Unit = {
        if (context.hasActiveReactInstance()) {
            try {
                context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("audiora-audio-effects-changed", AudioEffectsController.getState())
            } catch (_: IllegalStateException) {
                // React may be invalidated between the active-instance check and the emit.
            }
        }
    }

    override fun getName() = "AudioEffects"

    override fun initialize() {
        super.initialize()
        handler.post {
            AudioEffectsController.initialize(context)
            AudioEffectsController.addObserver(observer)
        }
    }

    override fun invalidate() {
        handler.post { AudioEffectsController.removeObserver(observer) }
        super.invalidate()
    }

    @ReactMethod
    fun getState(promise: Promise) {
        handler.post {
            AudioEffectsController.initialize(context)
            promise.resolve(AudioEffectsController.getState())
        }
    }

    @ReactMethod
    fun setSettings(json: String, persist: Boolean, promise: Promise) {
        handler.post {
            try {
                AudioEffectsController.initialize(context)
                promise.resolve(AudioEffectsController.setSettings(json, persist))
            } catch (error: Exception) {
                promise.reject("audio_effects_settings", error)
            }
        }
    }

    @ReactMethod
    fun addListener(eventName: String) { }

    @ReactMethod
    fun removeListeners(count: Double) { }
}
