package `fun`.xwj.musicfree.audioEffects

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EqualizerCurveTest {
    @Test fun interpolatesLogarithmicallyAndHoldsEdges() {
        val bands = listOf(EqualizerBand(100.0, -4.0), EqualizerBand(400.0, 4.0))
        assertEquals(0.0, EqualizerCurve.gainAt(bands, 200.0), 0.0001)
        assertEquals(-4.0, EqualizerCurve.gainAt(bands, 20.0), 0.0001)
        assertEquals(4.0, EqualizerCurve.gainAt(bands, 20000.0), 0.0001)
    }

    @Test fun validatesPersistedControlPoints() {
        val bands = EqualizerCurve.normalize(listOf(
            EqualizerBand(400.0, 20.0), EqualizerBand(Double.NaN, 0.0),
            EqualizerBand(100.0, -20.0), EqualizerBand(400.0, 1.0),
        ))
        assertEquals(listOf(EqualizerBand(100.0, -6.0), EqualizerBand(400.0, 6.0)), bands)
        assertEquals(EqualizerCurve.flat, EqualizerCurve.normalize(emptyList()))
    }

    @Test fun legacyProtectionPreservesRelativeTuningWithoutPositiveGain() {
        assertEquals(listOf(0.0, -4.0, -8.0), EqualizerCurve.legacyLevels(listOf(4.0, 0.0, -4.0), -15.0))
        assertEquals(listOf(-2.0, -3.0), EqualizerCurve.legacyLevels(listOf(-2.0, -3.0), -15.0))
        assertEquals(listOf(0.0, 0.0), EqualizerCurve.legacyLevels(listOf(0.0, 0.0), -15.0))
        assertTrue(EqualizerCurve.legacyLevels(listOf(6.0, -6.0), -6.0).all { it in -6.0..0.0 })
    }
}
