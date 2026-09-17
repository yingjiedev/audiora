package `fun`.xwj.musicfree.utils; // replace your-apps-package-name with your app's package name
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.util.DisplayMetrics
import android.view.WindowInsets
import android.view.WindowManager
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.ReadableArray
import java.io.File
import java.util.ArrayDeque
import java.util.concurrent.Executors
import kotlin.system.exitProcess
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

class UtilsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

    private val reactContext: ReactApplicationContext = context;
    private val fileExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "Audiora-SAF").apply { isDaemon = true }
    }
    private val supportedAudioExtensions = setOf(
        "mp3", "flac", "wma", "wav", "m4a", "ogg", "acc", "aac", "ape", "opus",
    )
    private val supportedLyricExtensions = setOf("lrc", "txt")
    private val supportedCoverExtensions = setOf("jpg", "jpeg", "png", "webp")

    override fun getName() = "NativeUtils"

    override fun invalidate() {
        fileExecutor.shutdownNow()
        super.invalidate()
    }

    @ReactMethod
    fun exitApp() {
        val activity = reactContext.currentActivity
        activity?.finishAndRemoveTask()
        android.os.Process.killProcess(android.os.Process.myPid())
        exitProcess(0)
    }

    @ReactMethod
    fun saveImageToAppStorage(sourcePath: String, displayName: String, promise: Promise) {
        try {
            val imageDir = File(
                reactContext.getExternalFilesDir(Environment.DIRECTORY_PICTURES),
                "Audiora",
            )
            require(imageDir.exists() || imageDir.mkdirs()) {
                "Unable to create image directory"
            }
            val target = File(imageDir, displayName)
            val sourceUri = Uri.parse(sourcePath)
            val input = if (sourceUri.scheme.equals("content", ignoreCase = true)) {
                reactContext.contentResolver.openInputStream(sourceUri)
            } else {
                val sourceFilePath = if (sourcePath.startsWith("file://")) {
                    sourceUri.path ?: sourcePath
                } else {
                    sourcePath
                }
                File(sourceFilePath).takeIf(File::isFile)?.inputStream()
            }
            require(input != null) { "Image source does not exist" }
            input.use { source ->
                target.outputStream().use { output -> source.copyTo(output) }
            }
            promise.resolve(Uri.fromFile(target).toString())
        } catch (error: Exception) {
            promise.reject("SaveImageToAppStorageFailed", error.message, error)
        }
    }

    @ReactMethod
    fun scanSafDirectoryFiles(directoryUri: String, promise: Promise) {
        fileExecutor.execute {
            try {
                val root = DocumentFile.fromTreeUri(reactContext, Uri.parse(directoryUri))
                require(root != null && root.exists() && root.isDirectory) {
                    "Directory is unavailable"
                }

                val pending = ArrayDeque<DocumentFile>()
                val visited = mutableSetOf<String>()
                val result = Arguments.createArray()
                pending.add(root)
                while (pending.isNotEmpty()) {
                    val directory = pending.removeFirst()
                    val directoryKey = directory.uri.toString()
                    if (!visited.add(directoryKey)) {
                        continue
                    }
                    directory.listFiles().forEach { entry ->
                        if (entry.isDirectory) {
                            pending.add(entry)
                            return@forEach
                        }
                        if (!entry.isFile) {
                            return@forEach
                        }
                        val displayName = entry.name ?: entry.uri.lastPathSegment
                        val kind = companionFileKind(entry, displayName) ?: return@forEach
                        result.pushMap(Arguments.createMap().apply {
                            putString("uri", entry.uri.toString())
                            putString("name", displayName ?: "audio")
                            putString("kind", kind)
                            // 父目录 uri：content:// 无法靠路径拼接找兄弟文件，
                            // 关联歌词 / 封面只能依赖扫描时的父子关系
                            putString("parentUri", directoryKey)
                            putString(
                                "documentId",
                                runCatching {
                                    DocumentsContract.getDocumentId(entry.uri)
                                }.getOrNull(),
                            )
                        })
                    }
                }
                promise.resolve(result)
            } catch (error: Exception) {
                promise.reject("ScanSafDirectoryFailed", error.message, error)
            }
        }
    }

    /**
     * 音频 / 歌词 / 封面之外的文件不返回：扫描结果要能重建附属文件关联，
     * 但没必要把目录里的无关文件全量搬到 JS 侧。
     */
    private fun companionFileKind(file: DocumentFile, displayName: String?): String? {
        val extension = displayName?.substringAfterLast('.', "")?.lowercase()
        if (extension in supportedAudioExtensions) return "audio"
        if (extension in supportedLyricExtensions) return "lyric"
        if (extension in supportedCoverExtensions) return "cover"
        return if (file.type?.startsWith("audio/") == true) "audio" else null
    }

    @ReactMethod
    fun safUriExists(uriString: String, promise: Promise) {
        try {
            val uri = Uri.parse(uriString)
            val exists = DocumentFile.fromSingleUri(reactContext, uri)?.let {
                it.exists() && it.isFile
            } ?: false
            promise.resolve(exists)
        } catch (_: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun copyFileToSafDirectory(
        sourcePath: String,
        directoryUri: String,
        displayName: String,
        mimeType: String,
        promise: Promise,
    ) {
        fileExecutor.execute {
            try {
                val normalizedSourcePath = if (sourcePath.startsWith("file://")) {
                    Uri.parse(sourcePath).path ?: sourcePath
                } else {
                    sourcePath
                }
                val source = File(normalizedSourcePath)
                require(source.isFile) { "Source file does not exist" }

                val directory = DocumentFile.fromTreeUri(
                    reactContext,
                    Uri.parse(directoryUri),
                )
                require(directory != null && directory.exists() && directory.isDirectory) {
                    "Directory is unavailable"
                }
                val target = directory.createFile(mimeType, displayName)
                    ?: error("Unable to create destination file")
                try {
                    reactContext.contentResolver.openOutputStream(target.uri, "w")?.use { output ->
                        source.inputStream().use { input -> input.copyTo(output) }
                    } ?: error("Unable to open destination file")
                } catch (error: Exception) {
                    target.delete()
                    throw error
                }
                promise.resolve(target.uri.toString())
            } catch (error: Exception) {
                promise.reject("CopyFileToSafDirectoryFailed", error.message, error)
            }
        }
    }

    @ReactMethod
    fun deleteSafUri(uriString: String, promise: Promise) {
        try {
            val file = DocumentFile.fromSingleUri(reactContext, Uri.parse(uriString))
            promise.resolve(file == null || !file.exists() || file.delete())
        } catch (error: Exception) {
            promise.reject("DeleteSafUriFailed", error.message, error)
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getWindowDimensions(): WritableMap {
        val windowManager = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val displayMetrics: DisplayMetrics = reactApplicationContext.resources.displayMetrics
        val density = displayMetrics.density

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11 (API 30) 及以上使用新 API
            val windowMetrics = windowManager.currentWindowMetrics
            val insets = windowMetrics.windowInsets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars())
            val bounds = windowMetrics.bounds

            val totalWidthPx = bounds.width()
            val totalHeightPx = bounds.height()

            val leftInsetPx = insets.left
            val rightInsetPx = insets.right
            val topInsetPx = insets.top
            val bottomInsetPx = insets.bottom

            val usableWidthPx = totalWidthPx - leftInsetPx - rightInsetPx
            val usableHeightPx = totalHeightPx - topInsetPx - bottomInsetPx

            val usableWidthDp = usableWidthPx / density
            val usableHeightDp = usableHeightPx / density

            Arguments.createMap().apply {
                putDouble("width", usableWidthDp.toDouble())
                putDouble("height", usableHeightDp.toDouble())
            }
        } else {
            // Android 10 及以下使用旧 API
            val display = windowManager.defaultDisplay
            val realSize = android.graphics.Point()
            display.getRealSize(realSize)

            // 获取状态栏和导航栏高度
            val resources = reactApplicationContext.resources
            var statusBarHeight = 0
            var navigationBarHeight = 0

            // 状态栏高度
            val statusBarResourceId = resources.getIdentifier("status_bar_height", "dimen", "android")
            if (statusBarResourceId > 0) {
                statusBarHeight = resources.getDimensionPixelSize(statusBarResourceId)
            }

            // 导航栏高度
            val navigationBarResourceId = resources.getIdentifier("navigation_bar_height", "dimen", "android")
            if (navigationBarResourceId > 0) {
                navigationBarHeight = resources.getDimensionPixelSize(navigationBarResourceId)
            }

            val usableWidthPx = realSize.x
            val usableHeightPx = realSize.y - statusBarHeight - navigationBarHeight

            val usableWidthDp = usableWidthPx / density
            val usableHeightDp = usableHeightPx / density

            Arguments.createMap().apply {
                putDouble("width", usableWidthDp.toDouble())
                putDouble("height", usableHeightDp.toDouble())
            }
        }
    }

    /**
     * DES decrypt data in ECB mode
     * @param data - Data to decrypt as byte array (ReadableArray of integers 0-255)
     * @param key - DES key string (first 8 bytes used)
     * @param promise - Promise that resolves with decrypted data as ReadableArray
     */
    @ReactMethod
    fun desDecrypt(data: ReadableArray, key: String, promise: Promise) {
        try {
            // Convert ReadableArray to ByteArray
            val dataBytes = ByteArray(data.size()) { i ->
                data.getInt(i).toByte()
            }

            // 验证数据长度必须是8的倍数
            if (dataBytes.size % 8 != 0) {
                promise.reject("DES_DECRYPT_ERROR",
                    "Data length must be multiple of 8, got ${dataBytes.size}", null)
                return
            }

            // Use first 8 bytes of key for DES
            val keyBytes = key.toByteArray(Charsets.UTF_8).copyOf(8)
            val keySpec = SecretKeySpec(keyBytes, "DES")

            // Create DES cipher in ECB mode with no padding
            val cipher = Cipher.getInstance("DES/ECB/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, keySpec)

            // Decrypt data
            val decryptedBytes = cipher.doFinal(dataBytes)

            // 验证输出长度应该等于输入长度
            if (decryptedBytes.size != dataBytes.size) {
                promise.reject("DES_DECRYPT_ERROR",
                    "Output size mismatch: input=${dataBytes.size}, output=${decryptedBytes.size}", null)
                return
            }

            // Convert result to WritableArray
            val result = Arguments.createArray()
            for (byte in decryptedBytes) {
                result.pushInt(byte.toInt() and 0xFF)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("DES_DECRYPT_ERROR", "DES decryption failed: ${e.message}", e)
        }
    }

    /**
     * DES encrypt data in ECB mode
     * @param data - Data to encrypt as byte array (ReadableArray of integers 0-255)
     * @param key - DES key string (first 8 bytes used)
     * @param promise - Promise that resolves with encrypted data as ReadableArray
     */
    @ReactMethod
    fun desEncrypt(data: ReadableArray, key: String, promise: Promise) {
        try {
            // Convert ReadableArray to ByteArray
            val dataBytes = ByteArray(data.size()) { i ->
                data.getInt(i).toByte()
            }

            // 验证数据长度必须是8的倍数
            if (dataBytes.size % 8 != 0) {
                promise.reject("DES_ENCRYPT_ERROR",
                    "Data length must be multiple of 8, got ${dataBytes.size}", null)
                return
            }

            // Use first 8 bytes of key for DES
            val keyBytes = key.toByteArray(Charsets.UTF_8).copyOf(8)
            val keySpec = SecretKeySpec(keyBytes, "DES")

            // Create DES cipher in ECB mode with no padding
            val cipher = Cipher.getInstance("DES/ECB/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, keySpec)

            // Encrypt data
            val encryptedBytes = cipher.doFinal(dataBytes)

            // 验证输出长度应该等于输入长度
            if (encryptedBytes.size != dataBytes.size) {
                promise.reject("DES_ENCRYPT_ERROR",
                    "Output size mismatch: input=${dataBytes.size}, output=${encryptedBytes.size}", null)
                return
            }

            // Convert result to WritableArray
            val result = Arguments.createArray()
            for (byte in encryptedBytes) {
                result.pushInt(byte.toInt() and 0xFF)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("DES_ENCRYPT_ERROR", "DES encryption failed: ${e.message}", e)
        }
    }

    /**
     * DES encrypt zero buffer to generate XOR key block
     * @param key - DES key string (first 8 bytes used)
     * @param promise - Promise that resolves with encrypted 8-byte block as ReadableArray
     */
    @ReactMethod
    fun desEncryptZeroBlock(key: String, promise: Promise) {
        try {
            // Create 8-byte zero buffer
            val zeroBuffer = ByteArray(8) { 0 }

            // Use first 8 bytes of key for DES
            val keyBytes = key.toByteArray(Charsets.UTF_8).copyOf(8)
            val keySpec = SecretKeySpec(keyBytes, "DES")

            // Create DES cipher in ECB mode with no padding
            val cipher = Cipher.getInstance("DES/ECB/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, keySpec)

            // Encrypt zero buffer
            val encryptedBytes = cipher.doFinal(zeroBuffer)

            // Convert result to WritableArray
            val result = Arguments.createArray()
            for (byte in encryptedBytes) {
                result.pushInt(byte.toInt() and 0xFF)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("DES_ENCRYPT_ERROR", "DES encryption failed: ${e.message}", e)
        }
    }
}
