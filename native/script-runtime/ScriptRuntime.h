#pragma once

#include <atomic>
#include <condition_variable>
#include <deque>
#include <functional>
#include <mutex>
#include <string>
#include <thread>

struct JSContext;
struct JSRuntime;

namespace audiora {

// Each instance owns a heap and worker. No application objects enter the VM.
class ScriptRuntime {
public:
    using Callback = std::function<void(const std::string &)>;
    using Crypto = std::function<std::string(const std::string &)>;

    ScriptRuntime(std::string bootstrap, std::string script, Callback emit, Crypto crypto);
    ~ScriptRuntime();
    void dispatch(const std::string &payload);
    void stop();

private:
    void run();
    bool evaluate(const std::string &code);
    void fail(const std::string &message);
    static int interrupt(JSRuntime *, void *opaque);

    Callback emit_;
    Crypto crypto_;
    std::deque<std::string> tasks_;
    std::mutex mutex_;
    std::condition_variable wake_;
    std::atomic<bool> stopping_{false};
    int64_t deadline_ = 0;
    JSRuntime *runtime_ = nullptr;
    JSContext *context_ = nullptr;
    std::thread worker_;
};

} // namespace audiora
