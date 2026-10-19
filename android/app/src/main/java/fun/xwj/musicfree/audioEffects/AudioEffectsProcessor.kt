package `fun`.xwj.musicfree.audioEffects

import android.media.audiofx.AudioEffect
import android.media.audiofx.DynamicsProcessing
import android.media.audiofx.Equalizer
import android.os.Build
import androidx.annotation.RequiresApi
import kotlin.math.roundToInt

internal interface AudioEffectsProcessor {
    val frequencies: List<Double>
    val supportsPreamp: Boolean
    val minimumGain: Double get() = -6.0
    val maximumGain: Double get() = 6.0
    val effect: AudioEffect
    fun apply(settings: AudioEffectsSettings, force: Boolean = false)
    fun release() { effect.release() }
}

@RequiresApi(Build.VERSION_CODES.P)
internal class DynamicsEffectsProcessor(sessionId: Int) : AudioEffectsProcessor {
    override val frequencies = EqualizerCurve.frequencies
    override val supportsPreamp = true
    override val effect: DynamicsProcessing = DynamicsProcessing(
        0, sessionId,
        DynamicsProcessing.Config.Builder(
            DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION,
            2, true, frequencies.size, false, 0, false, 0, true,
        ).build(),
    )
    private var lastGains: List<Double>? = null
    private var lastInputGain: Float? = null
    private var limiterConfigured = false

    override fun apply(settings: AudioEffectsSettings, force: Boolean) {
        if (!settings.enabled) {
            check(effect.setEnabled(false) == AudioEffect.SUCCESS)
            return
        }
        val gains = frequencies.map { EqualizerCurve.gainAt(settings.tuning.bands, it) }
        val headroom = gains.maxOrNull()?.coerceAtLeast(0.0) ?: 0.0
        val inputGain = (settings.tuning.preampDb - headroom).toFloat()
        if (force || inputGain != lastInputGain) {
            effect.setInputGainAllChannelsTo(inputGain)
            lastInputGain = inputGain
        }
        gains.forEachIndexed { index, gain ->
            if (force || lastGains?.get(index) != gain) {
                val cutoff = (frequencies[index] * kotlin.math.sqrt(2.0)).coerceAtMost(22000.0)
                effect.setPreEqBandAllChannelsTo(index, DynamicsProcessing.EqBand(true, cutoff.toFloat(), gain.toFloat()))
            }
        }
        lastGains = gains
        if (force || !limiterConfigured) {
            effect.setLimiterAllChannelsTo(DynamicsProcessing.Limiter(true, true, 0, 1f, 60f, 20f, -1f, 0f))
            limiterConfigured = true
        }
        check(effect.setEnabled(true) == AudioEffect.SUCCESS)
    }
}

@Suppress("DEPRECATION")
internal class LegacyEffectsProcessor(sessionId: Int) : AudioEffectsProcessor {
    override val effect = Equalizer(0, sessionId)
    override val supportsPreamp = false
    private val levelRange: ShortArray
    // Enough cut range for a full positive-to-negative curve after headroom compensation.
    override val maximumGain: Double
    override val minimumGain: Double get() = -maximumGain
    override val frequencies: List<Double>
    private var lastLevels: List<Double>? = null

    init {
        try {
            levelRange = effect.bandLevelRange
            maximumGain = minOf(6.0, -levelRange[0] / 200.0, levelRange[1] / 100.0).coerceAtLeast(0.0)
            frequencies = (0 until effect.numberOfBands).map { effect.getCenterFreq(it.toShort()) / 1000.0 }
            check(frequencies.isNotEmpty() && frequencies.size <= 32 && maximumGain > 0)
            check(frequencies.all { it.isFinite() && it in 20.0..24000.0 })
            check(frequencies.zipWithNext().all { (left, right) -> left < right })
        } catch (error: Exception) {
            effect.release()
            throw error
        }
    }

    override fun apply(settings: AudioEffectsSettings, force: Boolean) {
        if (!settings.enabled) {
            check(effect.setEnabled(false) == AudioEffect.SUCCESS)
            return
        }
        val gains = frequencies.map {
            EqualizerCurve.gainAt(settings.tuning.bands, it).coerceIn(minimumGain, maximumGain)
        }
        val levels = EqualizerCurve.legacyLevels(gains, levelRange[0] / 100.0)
        levels.forEachIndexed { index, gain ->
            if (force || lastLevels?.get(index) != gain) {
                effect.setBandLevel(index.toShort(), (gain * 100).roundToInt().toShort())
            }
        }
        lastLevels = levels
        check(effect.setEnabled(true) == AudioEffect.SUCCESS)
    }
}
