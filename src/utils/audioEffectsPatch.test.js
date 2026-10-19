const fs = require("fs");
const os = require("os");
const path = require("path");
const { patchAudioEffects } = require("../../scripts/patch-track-player-audio-effects");

describe("native audio session hook installation", () => {
    let root;
    let service;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "audiora-audio-effects-test-"));
        service = path.join(root, "node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/service/MusicService.kt");
        fs.mkdirSync(path.dirname(service), { recursive: true });
        fs.writeFileSync(service, [
            "    private lateinit var player: QueuedAudioPlayer",
            "        player = QueuedAudioPlayer(this@MusicService, playerConfig, bufferConfig, cacheConfig)",
            "    override fun onDestroy() {",
        ].join("\r\n"));
    });
    afterEach(() => {
        if (path.dirname(root) === path.resolve(os.tmpdir()) && path.basename(root).startsWith("audiora-audio-effects-test-")) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it("installs once, hooks teardown, and restores a missing adapter on repeated postinstall", () => {
        patchAudioEffects(root);
        const once = fs.readFileSync(service, "utf8");
        expect(once).toContain("audioSessionObserver?.release()");
        const adapter = path.resolve(path.dirname(service), "../../kotlinaudio/players/AudioSessionObserver.java");
        expect(fs.existsSync(adapter)).toBe(true);
        fs.unlinkSync(adapter);
        patchAudioEffects(root);
        expect(fs.readFileSync(service, "utf8")).toBe(once);
        expect(fs.existsSync(adapter)).toBe(true);
        expect(once.match(/audioSessionObserver = com/g)).toHaveLength(1);
    });

    it("rejects changed upstream source without writing a partial service patch", () => {
        const source = fs.readFileSync(service, "utf8").replace("    override fun onDestroy() {", "changed upstream teardown");
        fs.writeFileSync(service, source);
        expect(() => patchAudioEffects(root)).toThrow("Unsupported MusicService");
        expect(fs.readFileSync(service, "utf8")).toBe(source);
    });

    it("rejects a partial hook even when its marker survived", () => {
        patchAudioEffects(root);
        const source = fs.readFileSync(service, "utf8").replace("audioSessionObserver?.release()", "// removed teardown");
        fs.writeFileSync(service, source);
        expect(() => patchAudioEffects(root)).toThrow("Incomplete audio session hook");
    });
});
