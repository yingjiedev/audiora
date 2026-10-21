#include "../ScriptRuntime.h"
#include <jni.h>
#include <memory>
#include <exception>

namespace {
std::string utf8(JNIEnv *env, jstring value) {
    if (!value) return {};
    const jchar *chars = env->GetStringChars(value, nullptr);
    const jsize length = env->GetStringLength(value);
    std::string result;
    for (jsize i = 0; i < length; ++i) {
        uint32_t ch = chars[i];
        if (ch >= 0xd800 && ch <= 0xdbff && i + 1 < length &&
            chars[i + 1] >= 0xdc00 && chars[i + 1] <= 0xdfff) {
            ch = 0x10000 + ((ch - 0xd800) << 10) + (chars[++i] - 0xdc00);
        } else if (ch >= 0xd800 && ch <= 0xdfff) {
            ch = 0xfffd;
        }
        if (ch < 0x80) result += static_cast<char>(ch);
        else if (ch < 0x800) {
            result += static_cast<char>(0xc0 | (ch >> 6));
            result += static_cast<char>(0x80 | (ch & 63));
        } else if (ch < 0x10000) {
            result += static_cast<char>(0xe0 | (ch >> 12));
            result += static_cast<char>(0x80 | ((ch >> 6) & 63));
            result += static_cast<char>(0x80 | (ch & 63));
        } else {
            result += static_cast<char>(0xf0 | (ch >> 18));
            result += static_cast<char>(0x80 | ((ch >> 12) & 63));
            result += static_cast<char>(0x80 | ((ch >> 6) & 63));
            result += static_cast<char>(0x80 | (ch & 63));
        }
    }
    env->ReleaseStringChars(value, chars);
    return result;
}

jstring javaString(JNIEnv *env, const std::string &text) {
    jbyteArray bytes = env->NewByteArray(static_cast<jsize>(text.size()));
    env->SetByteArrayRegion(bytes, 0, static_cast<jsize>(text.size()),
        reinterpret_cast<const jbyte *>(text.data()));
    jclass cls = env->FindClass("java/lang/String");
    jmethodID ctor = env->GetMethodID(cls, "<init>", "([BLjava/lang/String;)V");
    jstring encoding = env->NewStringUTF("UTF-8");
    auto result = static_cast<jstring>(env->NewObject(cls, ctor, bytes, encoding));
    env->DeleteLocalRef(bytes);
    env->DeleteLocalRef(cls);
    env->DeleteLocalRef(encoding);
    return result;
}

struct Bridge {
    JavaVM *vm;
    jobject module;
    std::string id;
    jmethodID emitMethod;
    jmethodID cryptoMethod;
    std::unique_ptr<audiora::ScriptRuntime> runtime;

    JNIEnv *environment(bool &attached) {
        JNIEnv *env = nullptr;
        attached = vm->GetEnv(reinterpret_cast<void **>(&env), JNI_VERSION_1_6) == JNI_EDETACHED;
        if (attached) vm->AttachCurrentThread(&env, nullptr);
        return env;
    }

    void emit(const std::string &message) {
        bool attached;
        auto *env = environment(attached);
        jstring runtimeId = javaString(env, id);
        jstring value = javaString(env, message);
        env->CallVoidMethod(module, emitMethod, runtimeId, value);
        if (env->ExceptionCheck()) env->ExceptionClear();
        env->DeleteLocalRef(runtimeId);
        env->DeleteLocalRef(value);
        if (attached) vm->DetachCurrentThread();
    }

    std::string crypto(const std::string &request) {
        bool attached;
        auto *env = environment(attached);
        jstring value = javaString(env, request);
        auto result = static_cast<jstring>(env->CallObjectMethod(module, cryptoMethod, value));
        std::string response;
        if (env->ExceptionCheck()) {
            env->ExceptionClear();
            response = "{\"error\":\"Native utility failed\"}";
        } else {
            response = utf8(env, result);
        }
        env->DeleteLocalRef(value);
        if (result) env->DeleteLocalRef(result);
        if (attached) vm->DetachCurrentThread();
        return response;
    }

    ~Bridge() {
        runtime.reset();
        bool attached;
        auto *env = environment(attached);
        env->DeleteGlobalRef(module);
        if (attached) vm->DetachCurrentThread();
    }
};
} // namespace

extern "C" JNIEXPORT jlong JNICALL
Java_fun_xwj_musicfree_scriptsource_ScriptSourceModule_nativeCreate(
    JNIEnv *env, jobject module, jstring id, jstring bootstrap, jstring script) {
    try {
        auto bridge = std::make_unique<Bridge>();
        env->GetJavaVM(&bridge->vm);
        bridge->module = env->NewGlobalRef(module);
        bridge->id = utf8(env, id);
        jclass cls = env->GetObjectClass(module);
        bridge->emitMethod = env->GetMethodID(cls, "onEvent", "(Ljava/lang/String;Ljava/lang/String;)V");
        bridge->cryptoMethod = env->GetMethodID(cls, "crypto", "(Ljava/lang/String;)Ljava/lang/String;");
        env->DeleteLocalRef(cls);
        Bridge *host = bridge.get();
        bridge->runtime = std::make_unique<audiora::ScriptRuntime>(utf8(env, bootstrap), utf8(env, script),
            [host](const std::string &message) { host->emit(message); },
            [host](const std::string &request) { return host->crypto(request); });
        return reinterpret_cast<jlong>(bridge.release());
    } catch (const std::exception &error) {
        jclass cls = env->FindClass("java/lang/IllegalStateException");
        env->ThrowNew(cls, error.what());
        env->DeleteLocalRef(cls);
        return 0;
    }
}

extern "C" JNIEXPORT void JNICALL
Java_fun_xwj_musicfree_scriptsource_ScriptSourceModule_nativePost(
    JNIEnv *env, jobject, jlong handle, jstring payload) {
    reinterpret_cast<Bridge *>(handle)->runtime->dispatch(utf8(env, payload));
}

extern "C" JNIEXPORT void JNICALL
Java_fun_xwj_musicfree_scriptsource_ScriptSourceModule_nativeDestroy(JNIEnv *, jobject, jlong handle) {
    delete reinterpret_cast<Bridge *>(handle);
}
