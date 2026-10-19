package `fun`.xwj.musicfree.audioEffects

import kotlin.math.ln

data class EqualizerBand(val frequencyHz: Double, val gainDb: Double)

/** Device-independent control points; interpolation uses musical (log) frequency spacing. */
object EqualizerCurve {
    val frequencies = listOf(31.5, 63.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0)
    val flat get() = frequencies.map { EqualizerBand(it, 0.0) }

    fun normalize(bands: List<EqualizerBand>): List<EqualizerBand> = bands
        .filter { it.frequencyHz.isFinite() && it.frequencyHz in 20.0..24000.0 && it.gainDb.isFinite() }
        .map { it.copy(gainDb = it.gainDb.coerceIn(-6.0, 6.0)) }
        .distinctBy { it.frequencyHz }
        .sortedBy { it.frequencyHz }
        .take(32)
        .ifEmpty { flat }

    fun gainAt(bands: List<EqualizerBand>, frequencyHz: Double): Double {
        if (frequencyHz <= bands.first().frequencyHz) return bands.first().gainDb
        if (frequencyHz >= bands.last().frequencyHz) return bands.last().gainDb
        val upper = bands.indexOfFirst { it.frequencyHz >= frequencyHz }
        val left = bands[upper - 1]
        val right = bands[upper]
        val fraction = ln(frequencyHz / left.frequencyHz) / ln(right.frequencyHz / left.frequencyHz)
        return left.gainDb + fraction * (right.gainDb - left.gainDb)
    }

    /** Legacy EQ has no preamp: shift the whole curve down within its actual cut range. */
    fun legacyLevels(gains: List<Double>, minimumDb: Double): List<Double> {
        val headroom = gains.maxOrNull()?.coerceAtLeast(0.0) ?: 0.0
        return gains.map { (it - headroom).coerceIn(minimumDb, 0.0) }
    }
}
