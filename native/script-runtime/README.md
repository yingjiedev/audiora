# Custom source runtime

Imported playback resolver scripts run in independent QuickJS-ng heaps and worker threads. The application's Hermes runtime and existing CommonJS music plugins are unchanged. Script loading is lazy after restart; import/update validation waits for both successful top-level evaluation and the script's asynchronous initialization event.

The engine is pinned in [quickjs/UPSTREAM.md](quickjs/UPSTREAM.md), with its MIT notices in [quickjs/LICENSE](quickjs/LICENSE). Only the engine is compiled. The QuickJS OS helpers, filesystem, module loader, process execution and shell are not exposed.

Limits per runtime:

- 32 MiB JS heap, 512 KiB JS stack, two seconds per evaluation/job batch, 10,000 pending jobs per batch.
- Blocking atomics are disabled; disposal also interrupts active JS execution.
- Eight outstanding HTTP requests and eight playback resolutions; 128 timers.
- Twenty seconds for initialization, 25 seconds per playback resolution, up to 20 seconds per HTTP request.
- One MiB UTF-8 script input and four MiB HTTP/decompressed response data.

The host supports the event-based playback URL protocol for five provider IDs, platform-specific quality declarations, callback HTTP requests, timers, byte encoding, AES-128-CBC with PKCS#7 padding, AES-128-ECB without padding, raw RSA public-key encryption, MD5, secure random bytes and asynchronous zlib utilities. Multipart forms currently accept text fields only. Search, catalog data and lyrics continue to come from music plugins. No source files or service endpoints are bundled.

Android uses a registered React Native module and a separate CMake library; its ELF segments support 16 KiB pages. iOS uses a local CocoaPod linked to the same engine and C++ runtime, with CommonCrypto/Security for native utilities. Run `pod install` on macOS after pulling the change; the Windows implementation environment cannot compile or perform native iOS acceptance.

Checks:

```powershell
node node_modules/jest/bin/jest.js --runInBand src/core/scriptSource src/core/pluginManager
npm run typecheck:runtime
npm run lint
```

Runtime/HTTP, field conversion, import/update rollback, persisted capability restoration and cache identity tests use local fixtures. Passing them does not establish the availability of any third-party music service. Android physical-device UI/playback acceptance and iOS native acceptance are separate handoff steps.
