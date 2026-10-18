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

data class AudioEffectsUserPreset(val id: String, val name: String, val tuning: AudioEffectsTuning) {
    fun toJson(): JSONObject = tuning.toJson().put("id", id).put("name", name)
}

data class AudioEffectsSettings(
    val enabled: Boolean = false,
    val preset: String = "flat",
    val tuning: AudioEffectsTuning = AudioEffectsTuning(),
    val customPresets: List<AudioEffectsUserPreset> = emptyList(),
    val activeCustomId: String? = null,
) {
    fun toJson(): JSONObject = tuning.toJson()
        .put("enabled", enabled)
        .put("preset", preset)
        .put("customPresets", JSONArray().apply { customPresets.forEach { put(it.toJson()) } })
        .put("activeCustomId", activeCustomId ?: JSONObject.NULL)

    companion object {
        fun fromJson(json: JSONObject): AudioEffectsSettings {
            val tuning = AudioEffectsTuning.fromJson(json)
            val preset = json.optString("preset", "flat").takeIf {
                it in setOf("flat", "vocal", "bass", "bright", "soft", "pop", "rock", "jazz", "classical", "electronic", "custom")
            } ?: "custom"
            val legacy = json.optJSONObject("savedCustom")?.let { AudioEffectsTuning.fromJson(it) }
            val presets = if (!json.has("customPresets")) {
                legacy?.let { listOf(AudioEffectsUserPreset("legacy-custom", "My preset", it)) } ?: emptyList()
            } else {
                val array = json.optJSONArray("customPresets") ?: JSONArray()
                val ids = mutableSetOf<String>()
                val names = mutableSetOf<String>()
                (0 until minOf(array.length(), 32)).mapNotNull { index ->
                    val item = array.optJSONObject(index) ?: return@mapNotNull null
                    val id = item.optString("id", "")
                    val name = item.optString("name", "").trim().replace(Regex("\\s+"), " ")
                    if (!id.matches(Regex("[a-zA-Z0-9_-]{1,80}")) || name.isEmpty() || name.length > 40 ||
                        id in ids || name.lowercase(java.util.Locale.ROOT) in names) return@mapNotNull null
                    ids.add(id)
                    names.add(name.lowercase(java.util.Locale.ROOT))
                    AudioEffectsUserPreset(id, name, AudioEffectsTuning.fromJson(item))
                }
            }
            val activeId = if (!json.has("customPresets") && preset == "custom" && tuning == legacy) {
                "legacy-custom"
            } else {
                json.optString("activeCustomId", "")
            }
            return AudioEffectsSettings(
                enabled = json.optBoolean("enabled", false),
                preset = preset,
                tuning = tuning,
                customPresets = presets,
                activeCustomId = activeId.takeIf { preset == "custom" && presets.any { entry -> entry.id == it } },
            )
        }
    }
}
