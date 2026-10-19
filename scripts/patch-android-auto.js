const fs = require("fs");

// Keep the RNTP/KotlinAudio integration at this boundary. A failed match must
// fail installation rather than ship an APK with a disconnected car service.
function replaceRequired(source, from, to) {
    if (!source.includes(from)) {
        throw new Error("[android-auto] unsupported RNTP source: " + from.slice(0, 90));
    }
    return source.replace(from, to);
}

function patchAndroidAuto(servicePath, modulePath) {
    const marker = "// audiora-android-auto-session";
    let service = fs.readFileSync(servicePath, "utf8").replace(/\r\n/g, "\n");
    let moduleSource = fs.readFileSync(modulePath, "utf8").replace(/\r\n/g, "\n");
    if (!service.includes(marker)) {
        service = replaceRequired(service,
            "    private lateinit var player: QueuedAudioPlayer",
            `    ${marker}
    private var playbackTaskStarted = false
    var androidAutoOnPlayerReady: (() -> Unit)? = null
    var androidAutoCommandHandler: ((String, Bundle?) -> Boolean)? = null

    // KotlinAudio 2.1.0 keeps these fields private. Resolve them once when the
    // browser attaches; never replace its callback or create another session.
    fun androidAutoPlayerField(name: String): Any? {
        if (!this::player.isInitialized) return null
        var type: Class<*>? = player.javaClass
        while (type != null) {
            try {
                return type.getDeclaredField(name).apply { isAccessible = true }.get(player)
            } catch (_: NoSuchFieldException) {
                type = type.superclass
            }
        }
        throw IllegalStateException("KotlinAudio field unavailable: $name")
    }

    private lateinit var player: QueuedAudioPlayer`);
        service = replaceRequired(service,
            "        startTask(getTaskConfig(intent))",
            `        if (!playbackTaskStarted) {
            playbackTaskStarted = true
            startTask(getTaskConfig(intent))
        }`);
        service = replaceRequired(service,
            "        setupForegrounding()",
            "        setupForegrounding()\n        androidAutoOnPlayerReady?.invoke()");
        service = replaceRequired(service,
            "    private fun emit(event: String, data: Bundle? = null) {",
            "    private fun emit(event: String, data: Bundle? = null) {\n        if (androidAutoCommandHandler?.invoke(event, data) == true) return");
        service = replaceRequired(service,
            "    companion object {",
            "    companion object {\n        @Volatile var androidAutoConnected = false");
        fs.writeFileSync(servicePath, service);
    }
    if (!service.includes("// audiora-android-auto-options")) {
        service = replaceRequired(service,
            "        player.notificationManager.createNotification(notificationConfig)",
            "        player.notificationManager.createNotification(notificationConfig)\n        // audiora-android-auto-options\n        androidAutoOnPlayerReady?.invoke()");
        fs.writeFileSync(servicePath, service);
    }
    if (!moduleSource.includes(marker)) {
        moduleSource = replaceRequired(moduleSource,
            "if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && AppForegroundTracker.backgrounded) {",
            `// audiora-android-auto-session: only a validated, bound car host may
        // initialize in the background. Its browser already started the FGS.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && AppForegroundTracker.backgrounded && !MusicService.androidAutoConnected) {`);
        moduleSource = replaceRequired(moduleSource,
            "if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {\n                context.startForegroundService(intent)\n            } else {\n                context.startService(intent)\n            }",
            `if (!MusicService.androidAutoConnected) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            }`);
        fs.writeFileSync(modulePath, moduleSource);
    }
    console.log("[android-auto] RNTP session, background binding and command hooks ready");
}

module.exports = { patchAndroidAuto };
