package `fun`.xwj.musicfree.auto

import com.doublesymmetry.trackplayer.service.MusicService
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

class AndroidAutoModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    init { AndroidAutoBridge.initialize(context) }
    override fun getName() = "AndroidAuto"

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun isConnected(): Boolean = MusicService.androidAutoConnected

    @ReactMethod
    fun publishCatalog(raw: String, promise: Promise) {
        try {
            AndroidAutoBridge.publishCatalog(context, raw)
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("auto_catalog_invalid", error)
        }
    }

    @ReactMethod
    fun takeCommands(promise: Promise) { promise.resolve(AndroidAutoBridge.takeCommands()) }

    @ReactMethod
    fun reportError(message: String) { AndroidAutoBridge.reportError(message) }
}

class AndroidAutoPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(AndroidAutoModule(context))
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
