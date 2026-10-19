package `fun`.xwj.musicfree.auto

import android.net.Uri
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import org.json.JSONObject

data class AndroidAutoCatalog(val currentMediaId: String?, val items: List<Item>) {
    data class Item(val mediaId: String, val title: String, val artist: String, val album: String, val artwork: String) {
        fun toMediaItem(): MediaBrowserCompat.MediaItem = MediaBrowserCompat.MediaItem(
            MediaDescriptionCompat.Builder()
                .setMediaId(mediaId)
                .setTitle(title)
                .setSubtitle(artist)
                .setDescription(album)
                // Remote HTTP artwork is supported by the host. Private local
                // paths are not exposed as accessible URIs to other apps.
                .setIconUri(artwork.takeIf { it.startsWith("https://") || it.startsWith("http://") }?.let(Uri::parse))
                .build(),
            MediaBrowserCompat.MediaItem.FLAG_PLAYABLE,
        )
    }

    companion object {
        const val ROOT_ID = "audiora:root"
        const val QUEUE_ID = "audiora:queue"
        const val GROUP_PREFIX = "audiora:group:"
        const val GROUP_SIZE = 100
        val EMPTY = AndroidAutoCatalog(null, emptyList())

        fun parse(raw: String): AndroidAutoCatalog {
            val json = JSONObject(raw)
            val array = json.optJSONArray("items")
            val items = (0 until minOf(array?.length() ?: 0, 10000)).mapNotNull { index ->
                val item = array?.optJSONObject(index) ?: return@mapNotNull null
                val id = item.optString("mediaId")
                if (id.isBlank() || id.length > 4096) return@mapNotNull null
                Item(id, item.optString("title", "Audiora").take(500), item.optString("artist").take(500),
                    item.optString("album").take(500), item.optString("artwork").take(4096))
            }.distinctBy { it.mediaId }
            val current = json.optString("currentMediaId").takeIf { id -> items.any { it.mediaId == id } }
            return AndroidAutoCatalog(current, items)
        }
    }
}
