const fs = require("fs");
const path = require("path");

/** Fail closed when upstream changes: a visible UI must never ship without its session hook. */
function patchAudioEffects(root = path.join(__dirname, "..")) {
    const library = path.join(root, "node_modules/react-native-track-player/android/src/main/java");
    const servicePath = path.join(library, "com/doublesymmetry/trackplayer/service/MusicService.kt");
    if (!fs.existsSync(servicePath)) {
        throw new Error("[audio-effects] RNTrackPlayer MusicService.kt is missing; install dependencies first");
    }
    let source = fs.readFileSync(servicePath, "utf8").replace(/\r\n/g, "\n");
    if (!source.includes("// audiora-audio-effects-session")) {
        const replacements = [
            [
                "    private lateinit var player: QueuedAudioPlayer",
                "    // audiora-audio-effects-session\n    private var audioSessionObserver: com.doublesymmetry.kotlinaudio.players.AudioSessionObserver? = null\n    private lateinit var player: QueuedAudioPlayer",
            ],
            [
                "        player = QueuedAudioPlayer(this@MusicService, playerConfig, bufferConfig, cacheConfig)",
                "        player = QueuedAudioPlayer(this@MusicService, playerConfig, bufferConfig, cacheConfig)\n        audioSessionObserver = com.doublesymmetry.kotlinaudio.players.AudioSessionObserver(this, player)",
            ],
            [
                "    override fun onDestroy() {",
                "    override fun onDestroy() {\n        audioSessionObserver?.release()\n        audioSessionObserver = null",
            ],
        ];
        for (const [before, after] of replacements) {
            if (source.split(before).length !== 2) {
                throw new Error(`[audio-effects] Unsupported MusicService; expected one occurrence of ${before.trim()}`);
            }
            source = source.replace(before, after);
        }
    }
    for (const required of [
        "audioSessionObserver = com.doublesymmetry.kotlinaudio.players.AudioSessionObserver(this, player)",
        "audioSessionObserver?.release()",
    ]) {
        if (!source.includes(required)) {
            throw new Error("[audio-effects] Incomplete audio session hook; reinstall the locked player version");
        }
    }
    fs.writeFileSync(servicePath, source);
    const adapterPath = path.join(library, "com/doublesymmetry/kotlinaudio/players/AudioSessionObserver.java");
    fs.mkdirSync(path.dirname(adapterPath), { recursive: true });
    fs.copyFileSync(path.join(__dirname, "native/AudioSessionObserver.java"), adapterPath);
}

module.exports = { patchAudioEffects };

if (require.main === module) {
    patchAudioEffects();
    console.log("[audio-effects] installed native audio session observer");
}
