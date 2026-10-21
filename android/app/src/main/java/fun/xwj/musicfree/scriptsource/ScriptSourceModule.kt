package `fun`.xwj.musicfree.scriptsource

import android.util.Base64
import androidx.annotation.Keep
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.spec.X509EncodedKeySpec
import java.security.interfaces.RSAPublicKey
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

@Keep
class ScriptSourceModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val executor = Executors.newSingleThreadExecutor()
    private val runtimes = mutableMapOf<String, Long>()
    @Volatile private var invalidated = false

    override fun getName() = "ScriptSourceRuntime"

    private external fun nativeCreate(id: String, bootstrap: String, script: String): Long
    private external fun nativePost(handle: Long, payload: String)
    private external fun nativeDestroy(handle: Long)

    @ReactMethod
    fun create(id: String, bootstrap: String, script: String, promise: Promise) {
        if (invalidated) {
            promise.reject("SourceRuntimeUnavailable", "Runtime has stopped")
            return
        }
        executor.execute {
            try {
                check(!invalidated && !runtimes.containsKey(id)) { "Runtime is unavailable" }
                check(runtimes.size < 8) { "Too many active scripts" }
                check(script.toByteArray(Charsets.UTF_8).size <= 1024 * 1024) { "Script is too large" }
                loadLibrary
                runtimes[id] = nativeCreate(id, bootstrap, script)
                promise.resolve(null)
            } catch (error: Throwable) {
                promise.reject("SourceRuntimeCreationFailed", error)
            }
        }
    }

    @ReactMethod
    fun post(id: String, payload: String) {
        if (invalidated) return
        executor.execute { runtimes[id]?.let { nativePost(it, payload) } }
    }

    @ReactMethod
    fun destroy(id: String, promise: Promise) {
        if (invalidated) {
            promise.resolve(null)
            return
        }
        executor.execute {
            runtimes.remove(id)?.let { nativeDestroy(it) }
            promise.resolve(null)
        }
    }

    @ReactMethod fun addListener(event: String) {}
    @ReactMethod fun removeListeners(count: Double) {}

    @Keep
    fun onEvent(id: String, payload: String) {
        if (invalidated || !reactApplicationContext.hasActiveReactInstance()) return
        val event = Arguments.createMap().apply {
            putString("id", id)
            putString("payload", payload)
        }
        reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("ScriptSourceRuntimeEvent", event)
    }

    @Keep
    fun crypto(raw: String): String = try {
        val request = JSONObject(raw)
        fun bytes(key: String) = Base64.decode(request.getString(key), Base64.DEFAULT)
        val result = when (request.getString("operation")) {
            "md5" -> MessageDigest.getInstance("MD5")
                .digest(request.getString("text").toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it.toInt() and 255) }
            "randomBytes" -> {
                val size = request.getInt("size")
                require(size in 0..262144)
                Base64.encodeToString(ByteArray(size).also { SecureRandom().nextBytes(it) }, Base64.NO_WRAP)
            }
            "aesEncrypt" -> {
                val mode = request.getString("mode")
                require(mode == "aes-128-cbc" || mode == "aes-128-ecb") { "Unsupported AES mode" }
                val key = bytes("key")
                require(key.size == 16) { "Invalid AES key" }
                val cipher = Cipher.getInstance(if (mode.endsWith("cbc")) "AES/CBC/PKCS5Padding" else "AES/ECB/NoPadding")
                val secret = SecretKeySpec(key, "AES")
                if (mode.endsWith("cbc")) cipher.init(Cipher.ENCRYPT_MODE, secret, IvParameterSpec(bytes("iv")))
                else cipher.init(Cipher.ENCRYPT_MODE, secret)
                Base64.encodeToString(cipher.doFinal(bytes("data")), Base64.NO_WRAP)
            }
            "rsaEncrypt" -> {
                require(request.getString("key").length <= 8192) { "RSA public key is too large" }
                val pem = request.getString("key")
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replace("-----BEGIN RSA PUBLIC KEY-----", "")
                    .replace("-----END RSA PUBLIC KEY-----", "").replace(Regex("\\s"), "")
                var encoded = Base64.decode(pem, Base64.DEFAULT)
                if (request.getString("key").contains("BEGIN RSA PUBLIC KEY")) {
                    fun der(tag: Int, data: ByteArray): ByteArray {
                        val length = if (data.size < 128) byteArrayOf(data.size.toByte())
                        else if (data.size < 256) byteArrayOf(0x81.toByte(), data.size.toByte())
                        else byteArrayOf(0x82.toByte(), (data.size shr 8).toByte(), data.size.toByte())
                        return byteArrayOf(tag.toByte()) + length + data
                    }
                    val algorithm = "300d06092a864886f70d0101010500".chunked(2).map { it.toInt(16).toByte() }.toByteArray()
                    encoded = der(0x30, algorithm + der(0x03, byteArrayOf(0) + encoded))
                }
                val key = KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(encoded))
                require((key as RSAPublicKey).modulus.bitLength() <= 4096) { "RSA public key is too large" }
                val cipher = Cipher.getInstance("RSA/ECB/NoPadding")
                cipher.init(Cipher.ENCRYPT_MODE, key)
                Base64.encodeToString(cipher.doFinal(bytes("data")), Base64.NO_WRAP)
            }
            else -> error("Unsupported utility")
        }
        JSONObject().put("data", result).toString()
    } catch (error: Throwable) {
        JSONObject().put("error", error.message ?: "Utility failed").toString()
    }

    override fun invalidate() {
        invalidated = true
        executor.execute {
            runtimes.values.forEach { nativeDestroy(it) }
            runtimes.clear()
        }
        executor.shutdown()
        super.invalidate()
    }

    companion object {
        private val loadLibrary by lazy { System.loadLibrary("audiora-script-runtime") }
    }
}
