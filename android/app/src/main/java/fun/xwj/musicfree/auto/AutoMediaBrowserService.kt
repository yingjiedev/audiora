package `fun`.xwj.musicfree.auto

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.IBinder
import android.os.Process
import android.os.ResultReceiver
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.media.MediaBrowserServiceCompat
import com.doublesymmetry.trackplayer.service.MusicService
import com.google.android.exoplayer2.Player
import com.google.android.exoplayer2.ext.mediasession.MediaSessionConnector
import `fun`.xwj.musicfree.R

/** Browsing facade over RNTP's existing session: no second player or audio focus. */
class AutoMediaBrowserService : MediaBrowserServiceCompat() {
    private var connecting = false
    private var bound = false
    private var musicService: MusicService? = null
    private var sharedSession: MediaSessionCompat? = null
    private var connector: MediaSessionConnector? = null
    private var phoneQueueNavigator: MediaSessionConnector.QueueNavigator? = null
    private var phonePlaybackActions = 0L
    private val readyCallback: () -> Unit = { attachSession() }
    private val commandHandler: (String, Bundle?) -> Boolean = { event, extras ->
        val command = when (event) {
            "remote-play" -> "play"
            "remote-pause" -> "pause"
            "remote-stop" -> "stop"
            "remote-next" -> "next"
            "remote-previous" -> "previous"
            "remote-seek" -> "seek"
            else -> null
        }
        if (command != null) enqueue(command, extras)
        command != null
    }
    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            try {
                musicService = (binder as MusicService.MusicBinder).service.apply {
                    androidAutoCommandHandler = commandHandler
                    androidAutoOnPlayerReady = readyCallback
                }
                // Rebinding a running player must not post RNTP's temporary
                // startup notification or remove its ongoing foreground state.
                if (musicService?.androidAutoPlayerField("mediaSession") == null) {
                    ContextCompat.startForegroundService(this@AutoMediaBrowserService,
                        Intent(this@AutoMediaBrowserService, MusicService::class.java))
                }
                attachSession()
            } catch (error: Exception) {
                Log.e("AudioraAuto", "Cannot connect playback service", error)
                stopSelf()
            }
        }
        override fun onServiceDisconnected(name: ComponentName) {
            musicService = null
            stopSelf()
        }
    }

    override fun onCreate() {
        super.onCreate()
        AndroidAutoBridge.initialize(this)
        AndroidAutoBridge.onCatalogChanged = {
            connector?.invalidateMediaSessionPlaybackState()
            notifyChildrenChanged(AndroidAutoCatalog.ROOT_ID)
            notifyChildrenChanged(AndroidAutoCatalog.QUEUE_ID)
            // Notify groups too when songs are reordered or replaced.
            repeat(100) { notifyChildrenChanged("${AndroidAutoCatalog.GROUP_PREFIX}$it") }
        }
        AndroidAutoBridge.onError = { message -> connector?.setCustomErrorMessage(message) }
    }

    override fun onGetRoot(clientPackageName: String, clientUid: Int, rootHints: Bundle?): BrowserRoot? {
        if (!isTrustedCaller(clientPackageName, clientUid)) return null
        if (!startPlayerConnection()) return null
        return BrowserRoot(AndroidAutoCatalog.ROOT_ID, null)
    }

    private fun isTrustedCaller(clientPackageName: String, clientUid: Int): Boolean {
        if (packageManager.getPackagesForUid(clientUid)?.contains(clientPackageName) != true) return false
        if (clientUid == applicationInfo.uid || clientUid == Process.SYSTEM_UID) return true
        // Both the Android Auto host and Assistant must be Google-signed.
        if (clientPackageName !in setOf("com.google.android.projection.gearhead", "com.google.android.googlequicksearchbox")) return false
        return packageManager.checkSignatures(clientPackageName, "com.google.android.gms") == PackageManager.SIGNATURE_MATCH
    }

    private fun startPlayerConnection(): Boolean {
        if (connecting) return true
        connecting = true
        MusicService.androidAutoConnected = true
        return try {
            val intent = Intent(this, MusicService::class.java)
            bound = bindService(intent, connection, Context.BIND_AUTO_CREATE)
            check(bound) { "Cannot bind playback service" }
            true
        } catch (error: Exception) {
            Log.e("AudioraAuto", "Cannot start playback service", error)
            connecting = false
            MusicService.androidAutoConnected = false
            false
        }
    }

    private fun attachSession() {
        try {
            if (sharedSession != null) {
                configurePlaybackActions()
                return
            }
            val session = musicService?.androidAutoPlayerField("mediaSession") as? MediaSessionCompat ?: return
            val sessionConnector = musicService?.androidAutoPlayerField("mediaSessionConnector") as? MediaSessionConnector
                ?: error("RNTP MediaSessionConnector unavailable")
            sessionConnector.setPlaybackPreparer(object : MediaSessionConnector.PlaybackPreparer {
                override fun getSupportedPrepareActions(): Long =
                    PlaybackStateCompat.ACTION_PREPARE or PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID or
                        PlaybackStateCompat.ACTION_PREPARE_FROM_MEDIA_ID or PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH or
                        PlaybackStateCompat.ACTION_PREPARE_FROM_SEARCH
                // Connector.onPlay also invokes ForwardingPlayer.play(), which
                // produces remote-play. Enqueueing here would execute it twice.
                override fun onPrepare(playWhenReady: Boolean) = Unit
                override fun onPrepareFromMediaId(mediaId: String, playWhenReady: Boolean, extras: Bundle?) {
                    if (playWhenReady) enqueue("playId", Bundle().apply { putString("mediaId", mediaId) })
                }
                override fun onPrepareFromSearch(query: String, playWhenReady: Boolean, extras: Bundle?) {
                    if (playWhenReady) enqueue("search", Bundle().apply { putString("query", query) })
                }
                override fun onPrepareFromUri(uri: Uri, playWhenReady: Boolean, extras: Bundle?) = Unit
                override fun onCommand(player: Player, command: String, extras: Bundle?, cb: ResultReceiver?): Boolean = false
            })
            connector = sessionConnector
            sharedSession = session
            phoneQueueNavigator = connectorField("queueNavigator") as? MediaSessionConnector.QueueNavigator
            // RNTP's native queue contains padding tracks used by Audiora's
            // transition logic. Browse the business queue through the catalog
            // instead of publishing those padding tracks to the car.
            sessionConnector.setQueueNavigator(object : MediaSessionConnector.QueueNavigator {
                override fun getSupportedQueueNavigatorActions(player: Player): Long =
                    if (AndroidAutoBridge.catalog.items.isEmpty()) 0L else
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                override fun onTimelineChanged(player: Player) { session.setQueue(null) }
                override fun getActiveQueueItemId(player: Player?): Long = MediaSessionCompat.QueueItem.UNKNOWN_ID.toLong()
                override fun onSkipToPrevious(player: Player) { enqueue("previous") }
                override fun onSkipToNext(player: Player) { enqueue("next") }
                override fun onSkipToQueueItem(player: Player, id: Long) = Unit
                override fun onCommand(player: Player, command: String, extras: Bundle?, cb: ResultReceiver?): Boolean = false
            })
            sessionConnector.invalidateMediaSessionQueue()
            configurePlaybackActions()
            sessionToken = session.sessionToken
        } catch (error: Exception) {
            Log.e("AudioraAuto", "Cannot attach RNTP media session", error)
            stopSelf()
        }
    }

    private fun connectorField(name: String): Any? = MediaSessionConnector::class.java
        .getDeclaredField(name).apply { isAccessible = true }.get(connector)

    private fun configurePlaybackActions() {
        phonePlaybackActions = connectorField("enabledPlaybackActions") as Long
        // KotlinAudio derives these from notification buttons. Car seeking and
        // stop must remain available even with Audiora's compact notification.
        connector?.setEnabledPlaybackActions(PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE or
            PlaybackStateCompat.ACTION_STOP or PlaybackStateCompat.ACTION_SEEK_TO)
        connector?.invalidateMediaSessionPlaybackState()
    }

    private fun enqueue(command: String, extras: Bundle? = null) {
        connector?.setCustomErrorMessage(null)
        AndroidAutoBridge.enqueue(this, command, extras)
    }

    override fun onLoadChildren(parentId: String, result: Result<MutableList<MediaBrowserCompat.MediaItem>>) {
        val catalog = AndroidAutoBridge.catalog
        val children = when {
            parentId == AndroidAutoCatalog.ROOT_ID -> listOf(folder(AndroidAutoCatalog.QUEUE_ID,
                getString(R.string.auto_queue), getString(R.string.auto_song_count, catalog.items.size)))
            parentId == AndroidAutoCatalog.QUEUE_ID && catalog.items.size <= AndroidAutoCatalog.GROUP_SIZE -> catalog.items.map { it.toMediaItem() }
            parentId == AndroidAutoCatalog.QUEUE_ID -> catalog.items.chunked(AndroidAutoCatalog.GROUP_SIZE).mapIndexed { index, group ->
                folder("${AndroidAutoCatalog.GROUP_PREFIX}$index", "${index * AndroidAutoCatalog.GROUP_SIZE + 1}–${index * AndroidAutoCatalog.GROUP_SIZE + group.size}", group.first().title)
            }
            parentId.startsWith(AndroidAutoCatalog.GROUP_PREFIX) -> {
                val index = parentId.removePrefix(AndroidAutoCatalog.GROUP_PREFIX).toIntOrNull()
                if (index == null || index !in 0..99) emptyList() else catalog.items
                    .drop(index * AndroidAutoCatalog.GROUP_SIZE).take(AndroidAutoCatalog.GROUP_SIZE).map { it.toMediaItem() }
            }
            else -> emptyList()
        }
        result.sendResult(children.toMutableList())
    }

    private fun folder(id: String, title: String, subtitle: String) = MediaBrowserCompat.MediaItem(
        MediaDescriptionCompat.Builder().setMediaId(id).setTitle(title).setSubtitle(subtitle).build(),
        MediaBrowserCompat.MediaItem.FLAG_BROWSABLE,
    )

    override fun onDestroy() {
        AndroidAutoBridge.onCatalogChanged = null
        AndroidAutoBridge.onError = null
        connector?.setPlaybackPreparer(null)
        connector?.setCustomErrorMessage(null)
        connector?.setQueueNavigator(phoneQueueNavigator)
        connector?.setEnabledPlaybackActions(phonePlaybackActions)
        connector?.invalidateMediaSessionQueue()
        connector?.invalidateMediaSessionPlaybackState()
        musicService?.androidAutoCommandHandler = null
        musicService?.androidAutoOnPlayerReady = null
        MusicService.androidAutoConnected = false
        if (bound) unbindService(connection)
        // RNTP owns and releases the session, including when phone playback continues.
        super.onDestroy()
    }
}
