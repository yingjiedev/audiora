package `fun`.xwj.musicfree.audioEffects

import org.json.JSONArray
import org.json.JSONObject

data class AudioEffectsTuning(val bands: List<EqualizerBand> = EqualizerCurve.flat, val preampDb: Double = 0.0) {
    fun toJson() = JSONObject().put("bands", JSONArray().apply {
        bands.forEach { put(JSONObject().put("frequencyHz", it.frequencyHz).put("gainDb", it.gainDb)) }
    }).put("preampDb", preampDb)

    companion object {
        fun fromJson(json: JSONObject): AudioEffectsTuning {
            val array = json.optJSONArray("bands") ?: JSONArray()
            val bands = (0 until array.length()).mapNotNull { index ->
                array.optJSONObject(index)?.let {
                    EqualizerBand(it.optDouble("frequencyHz"), it.optDouble("gainDb"))
                }
            }
            val preamp = json.optDouble("preampDb", 0.0).takeIf { it.isFinite() } ?: 0.0
            return AudioEffectsTuning(EqualizerCurve.normalize(bands), preamp.coerceIn(-12.0, 0.0))
        }
    }
}

data class AudioEffectsSettings(
    val enabled: Boolean = false,
    val preset: String = "flat",
    val tuning: AudioEffectsTuning = AudioEffectsTuning(),
    val savedCustom: AudioEffectsTuning? = null,
) {
    fun toJson(): JSONObject = tuning.toJson()
        .put("enabled", enabled)
        .put("preset", preset)
        .put("savedCustom", savedCustom?.toJson() ?: JSONObject.NULL)

    companion object {
        fun fromJson(json: JSONObject) = AudioEffectsSettings(
            enabled = json.optBoolean("enabled", false),
            preset = json.optString("preset", "flat").takeIf {
                it in setOf("flat", "vocal", "bass", "bright", "soft", "custom")
            } ?: "custom",
            tuning = AudioEffectsTuning.fromJson(json),
            savedCustom = json.optJSONObject("savedCustom")?.let { AudioEffectsTuning.fromJson(it) },
        )
    }
}
