const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { patchAndroidAuto } = require("./patch-android-auto");

test("RNTP adapter is idempotent, starts headless once and scopes background setup to car connections", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "audiora-auto-patch-"));
    const servicePath = path.join(root, "MusicService.kt");
    const modulePath = path.join(root, "MusicModule.kt");
    fs.writeFileSync(servicePath, `    private lateinit var player: QueuedAudioPlayer
        startTask(getTaskConfig(intent))
        setupForegrounding()
        player.notificationManager.createNotification(notificationConfig)
    private fun emit(event: String, data: Bundle? = null) {
    companion object {`);
    fs.writeFileSync(modulePath, `if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && AppForegroundTracker.backgrounded) {
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }`);
    patchAndroidAuto(servicePath, modulePath);
    const first = fs.readFileSync(servicePath, "utf8");
    const moduleSource = fs.readFileSync(modulePath, "utf8");
    patchAndroidAuto(servicePath, modulePath);
    assert.equal(fs.readFileSync(servicePath, "utf8"), first);
    assert.equal(fs.readFileSync(modulePath, "utf8"), moduleSource);
    assert.match(first, /if \(!playbackTaskStarted\)/);
    assert.match(first, /androidAutoCommandHandler\?\.invoke/);
    assert.match(moduleSource, /backgrounded && !MusicService.androidAutoConnected/);
    fs.writeFileSync(servicePath, "changed dependency");
    assert.throws(() => patchAndroidAuto(servicePath, modulePath), /unsupported RNTP source/);
});
