#include "ScriptRuntime.h"
#include "quickjs/quickjs.h"

#include <chrono>
#include <utility>

namespace audiora {
namespace {
int64_t nowMs() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
}

std::string quote(const std::string &value) {
    std::string result = "\"";
    const char *hex = "0123456789abcdef";
    for (unsigned char ch : value) {
        if (ch == '"' || ch == '\\') {
            result += '\\';
            result += ch;
        } else if (ch < 32) {
            result += "\\u00";
            result += hex[ch >> 4];
            result += hex[ch & 15];
        } else {
            result += ch;
        }
    }
    return result + '"';
}

struct Host {
    ScriptRuntime::Callback emit;
    ScriptRuntime::Crypto crypto;
};

JSValue send(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
    if (argc != 1 || !JS_IsString(argv[0])) return JS_ThrowTypeError(ctx, "Expected message string");
    size_t length = 0;
    const char *value = JS_ToCStringLen(ctx, &length, argv[0]);
    if (!value) return JS_EXCEPTION;
    if (length <= 2 * 1024 * 1024) {
        static_cast<Host *>(JS_GetContextOpaque(ctx))->emit(std::string(value, length));
    }
    JS_FreeCString(ctx, value);
    return JS_UNDEFINED;
}

JSValue crypto(JSContext *ctx, JSValueConst, int argc, JSValueConst *argv) {
    if (argc != 1 || !JS_IsString(argv[0])) return JS_ThrowTypeError(ctx, "Expected utility request");
    size_t length = 0;
    const char *value = JS_ToCStringLen(ctx, &length, argv[0]);
    if (!value) return JS_EXCEPTION;
    if (length > 1024 * 1024) {
        JS_FreeCString(ctx, value);
        return JS_ThrowRangeError(ctx, "Utility input is too large");
    }
    auto result = static_cast<Host *>(JS_GetContextOpaque(ctx))->crypto(std::string(value, length));
    JS_FreeCString(ctx, value);
    return JS_NewStringLen(ctx, result.data(), result.size());
}
} // namespace

ScriptRuntime::ScriptRuntime(std::string bootstrap, std::string script, Callback emit, Crypto crypto)
    : emit_(std::move(emit)), crypto_(std::move(crypto)) {
    tasks_.push_back(std::move(bootstrap));
    tasks_.push_back(std::move(script));
    worker_ = std::thread([this] { run(); });
}

ScriptRuntime::~ScriptRuntime() {
    stop();
}

void ScriptRuntime::stop() {
    stopping_.store(true);
    wake_.notify_all();
    if (worker_.joinable()) worker_.join();
}

void ScriptRuntime::dispatch(const std::string &payload) {
    if (stopping_.load()) return;
    bool overflow = false;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        overflow = tasks_.size() >= 64 || payload.size() > 8 * 1024 * 1024;
        if (!overflow) tasks_.push_back("__audioraDispatch(" + payload + ");");
    }
    if (overflow) {
        fail("Script message queue limit exceeded");
        stopping_.store(true);
    }
    wake_.notify_one();
}

int ScriptRuntime::interrupt(JSRuntime *, void *opaque) {
    auto *self = static_cast<ScriptRuntime *>(opaque);
    return self->stopping_.load() || nowMs() > self->deadline_;
}

void ScriptRuntime::fail(const std::string &message) {
    emit_("{\"type\":\"runtimeError\",\"message\":" + quote(message.substr(0, 2048)) + "}");
}

bool ScriptRuntime::evaluate(const std::string &code) {
    deadline_ = nowMs() + 2000;
    JS_UpdateStackTop(runtime_);
    JSValue result = JS_Eval(context_, code.data(), code.size(), "source.js", JS_EVAL_TYPE_GLOBAL);
    bool failed = JS_IsException(result);
    JS_FreeValue(context_, result);
    int jobs = 0;
    while (!failed && JS_IsJobPending(runtime_)) {
        JSContext *jobContext = nullptr;
        failed = JS_ExecutePendingJob(runtime_, &jobContext) < 0;
        if (++jobs > 10000 || nowMs() > deadline_) {
            fail("Script execution time limit exceeded");
            return false;
        }
    }
    if (failed) {
        JSValue exception = JS_GetException(context_);
        const char *message = JS_ToCString(context_, exception);
        fail(message ? message : "Script execution failed");
        if (message) JS_FreeCString(context_, message);
        JS_FreeValue(context_, exception);
        return false;
    }
    return true;
}

void ScriptRuntime::run() {
    runtime_ = JS_NewRuntime();
    if (!runtime_) {
        fail("Cannot allocate script runtime");
        return;
    }
    JS_SetMemoryLimit(runtime_, 32 * 1024 * 1024);
    JS_SetMaxStackSize(runtime_, 512 * 1024);
    JS_SetCanBlock(runtime_, false);
    JS_SetInterruptHandler(runtime_, interrupt, this);
    deadline_ = nowMs() + 2000;
    context_ = JS_NewContext(runtime_);
    if (!context_) {
        fail("Cannot allocate script context");
        JS_FreeRuntime(runtime_);
        return;
    }
    Host host{emit_, crypto_};
    JS_SetContextOpaque(context_, &host);
    JSValue global = JS_GetGlobalObject(context_);
    JS_SetPropertyStr(context_, global, "__sourceSend", JS_NewCFunction(context_, send, "send", 1));
    JS_SetPropertyStr(context_, global, "__sourceCrypto", JS_NewCFunction(context_, crypto, "crypto", 1));
    JS_FreeValue(context_, global);
    int evaluatedTasks = 0;
    while (!stopping_.load()) {
        std::string code;
        {
            std::unique_lock<std::mutex> lock(mutex_);
            wake_.wait(lock, [this] { return stopping_.load() || !tasks_.empty(); });
            if (stopping_.load()) break;
            code = std::move(tasks_.front());
            tasks_.pop_front();
        }
        if (!evaluate(code)) {
            stopping_.store(true);
            break;
        }
        if (++evaluatedTasks == 2) {
            emit_("{\"type\":\"evaluated\"}");
        }
    }
    JS_FreeContext(context_);
    JS_FreeRuntime(runtime_);
    context_ = nullptr;
    runtime_ = nullptr;
}
} // namespace audiora
