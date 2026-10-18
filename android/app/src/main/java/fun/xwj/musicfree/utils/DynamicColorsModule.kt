package `fun`.xwj.musicfree.utils

import android.content.ComponentCallbacks
import android.content.res.Configuration
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.core.graphics.ColorUtils
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger

/** Read public system resources; no wallpaper access or Material UI dependency is needed. */
class DynamicColorsModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context), ComponentCallbacks {
    private val listeners = AtomicInteger(0)

    override fun getName() = "AudioraDynamicColors"

    // Available before the first JS render, including a cold start with dynamic colors enabled.
    override fun getConstants(): Map<String, Any?> = mapOf("initialPalette" to readPalette())

    override fun initialize() {
        super.initialize()
        context.registerComponentCallbacks(this)
    }

    override fun invalidate() {
        context.unregisterComponentCallbacks(this)
        super.invalidate()
    }

    @ReactMethod
    fun getPalette(promise: Promise) {
        promise.resolve(readPalette()?.let { Arguments.makeNativeMap(it) })
    }

    @ReactMethod
    fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {
        listeners.incrementAndGet()
    }

    @ReactMethod
    fun removeListeners(count: Double) {
        listeners.updateAndGet { (it - count.toInt()).coerceAtLeast(0) }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        if (listeners.get() > 0 && context.hasActiveReactInstance()) {
            context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("AudioraDynamicColorsChanged", null)
        }
    }

    override fun onLowMemory() = Unit

    private fun readPalette(): Map<String, Map<String, String>>? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
        // A vendor resource failure must fall back to the Audiora theme, not abort startup.
        return runCatching {
            mapOf("light" to readScheme(false), "dark" to readScheme(true))
        }.getOrNull()
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private fun readScheme(dark: Boolean): Map<String, String> {
        fun color(id: Int) = context.resources.getColor(id, null)
        fun hex(value: Int) = String.format(Locale.ROOT, "#%06X", value and 0xFFFFFF)

        val colors = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Android 14+ exposes semantic roles, including system contrast adjustments.
            if (dark) mapOf(
                "primary" to color(android.R.color.system_primary_dark),
                "onPrimary" to color(android.R.color.system_on_primary_dark),
                "secondaryContainer" to color(android.R.color.system_secondary_container_dark),
                "onSecondaryContainer" to color(android.R.color.system_on_secondary_container_dark),
                "tertiary" to color(android.R.color.system_tertiary_dark),
                "surface" to color(android.R.color.system_surface_dark),
                "surfaceContainerLow" to color(android.R.color.system_surface_container_low_dark),
                "surfaceContainer" to color(android.R.color.system_surface_container_dark),
                "surfaceContainerHigh" to color(android.R.color.system_surface_container_high_dark),
                "onSurface" to color(android.R.color.system_on_surface_dark),
                "onSurfaceVariant" to color(android.R.color.system_on_surface_variant_dark),
                "outlineVariant" to color(android.R.color.system_outline_variant_dark),
            ) else mapOf(
                "primary" to color(android.R.color.system_primary_light),
                "onPrimary" to color(android.R.color.system_on_primary_light),
                "secondaryContainer" to color(android.R.color.system_secondary_container_light),
                "onSecondaryContainer" to color(android.R.color.system_on_secondary_container_light),
                "tertiary" to color(android.R.color.system_tertiary_light),
                "surface" to color(android.R.color.system_surface_light),
                "surfaceContainerLow" to color(android.R.color.system_surface_container_low_light),
                "surfaceContainer" to color(android.R.color.system_surface_container_light),
                "surfaceContainerHigh" to color(android.R.color.system_surface_container_high_light),
                "onSurface" to color(android.R.color.system_on_surface_light),
                "onSurfaceVariant" to color(android.R.color.system_on_surface_variant_light),
                "outlineVariant" to color(android.R.color.system_outline_variant_light),
            )
        } else {
            // API 31-33 has thirteen tones per palette. Interpolate the missing surface
            // tones to preserve page/card/panel hierarchy instead of flattening all three.
            val low = color(if (dark) android.R.color.system_neutral1_900 else android.R.color.system_neutral1_50)
            val high = color(if (dark) android.R.color.system_neutral1_800 else android.R.color.system_neutral1_100)
            mapOf(
                "primary" to color(if (dark) android.R.color.system_accent1_200 else android.R.color.system_accent1_600),
                "onPrimary" to color(if (dark) android.R.color.system_accent1_800 else android.R.color.system_accent1_0),
                "secondaryContainer" to color(if (dark) android.R.color.system_accent2_700 else android.R.color.system_accent2_100),
                "onSecondaryContainer" to color(if (dark) android.R.color.system_accent2_100 else android.R.color.system_accent2_900),
                "tertiary" to color(if (dark) android.R.color.system_accent3_200 else android.R.color.system_accent3_600),
                "surface" to color(if (dark) android.R.color.system_neutral1_900 else android.R.color.system_neutral1_10),
                "surfaceContainerLow" to ColorUtils.blendARGB(low, high, if (dark) 0.2f else 0f),
                "surfaceContainer" to ColorUtils.blendARGB(low, high, if (dark) 0.4f else 0.2f),
                "surfaceContainerHigh" to ColorUtils.blendARGB(low, high, if (dark) 0.7f else 0.6f),
                "onSurface" to color(if (dark) android.R.color.system_neutral1_100 else android.R.color.system_neutral1_900),
                "onSurfaceVariant" to color(if (dark) android.R.color.system_neutral2_200 else android.R.color.system_neutral2_700),
                "outlineVariant" to color(if (dark) android.R.color.system_neutral2_700 else android.R.color.system_neutral2_200),
            )
        }
        return colors.mapValues { hex(it.value) }
    }
}
