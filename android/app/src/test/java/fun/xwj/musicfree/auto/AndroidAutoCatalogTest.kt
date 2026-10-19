package `fun`.xwj.musicfree.auto

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AndroidAutoCatalogTest {
    @Test fun preservesSongsBeyondTheOld500ItemLimit() {
        val items = JSONArray()
        repeat(1000) { items.put(JSONObject().put("mediaId", "source:$it").put("title", "Song $it")) }
        val catalog = AndroidAutoCatalog.parse(JSONObject().put("items", items).put("currentMediaId", "source:999").toString())
        assertEquals(1000, catalog.items.size)
        assertEquals("source:999", catalog.currentMediaId)
        assertEquals(10, catalog.items.chunked(AndroidAutoCatalog.GROUP_SIZE).size)
    }

    @Test fun rejectsEmptyIdsAndDoesNotPublishAnUnavailableCurrentItem() {
        val catalog = AndroidAutoCatalog.parse("""{"currentMediaId":"gone","items":[{},null,{"mediaId":"one"},{"mediaId":"one"}]}""")
        assertEquals(1, catalog.items.size)
        assertNull(catalog.currentMediaId)
        assertEquals("Audiora", catalog.items.first().title)
    }

    @Test fun capsMetadataAndQueueSizeForBinderTransactions() {
        val items = JSONArray()
        repeat(10001) { items.put(JSONObject().put("mediaId", "source:$it").put("title", "x".repeat(1000))) }
        val catalog = AndroidAutoCatalog.parse(JSONObject().put("items", items).toString())
        assertEquals(10000, catalog.items.size)
        assertEquals(500, catalog.items.first().title.length)
    }
}
