# QMCv2 原始歌曲密钥迁移

默认发行包不再包含 QMCv2 固定解包常量、TC-TEA 或 EKey V1/V2 解包流程。
Android 和 iOS 只保留接受外部原始歌曲密钥的容器解码器。宿主不获取或推导密钥。

## 音源返回协议

优先让服务端提供普通 FLAC / Ogg / M4A 链接。确需兼容加密容器时，插件可返回：

```ts
{ url: "https://your-server/audio.mflac", qmcRawKey: "base64:...", headers: { /* 用户鉴权 */ } }
```

`qmcRawKey` 必须是已经解包的歌曲密钥，支持标准带 padding 的 base64（前缀可省略），
或显式 `hex:` 加偶数位十六进制。裸字符串始终按 base64 解释，避免猜测编码。
密钥为 1–4096 字节，不使用旧的 704 字符截断规则。传给原生桥接的表示统一为 `base64:...`。
不得把旧 `ekey` 重命名为 `qmcRawKey`；编码正确不代表密钥内容正确，提供方负责验证密钥与音频匹配。

- 仅有 `ekey` 或加密后缀且无有效原始密钥：播放明确提示，下载拒绝。
- 同时有 `qmcRawKey` 和旧 `ekey`：仅使用原始密钥。
- CENC 的 `cek` 协议和普通音频链接不变。
- 历史加密本地文件请由权利人使用自己的工具转换后重新导入。宿主不从文件尾提取或解包密钥。
- 旧下载任务不复用其 EKey 进行解包；更新音源后重新下载。

本次不提供外置解包模块，也不建立模块分发仓库；第三方模块注册/发现不属于本次交付。
用户仅应处理自己拥有权利或已获授权的内容。格式兼容不代表与第三方平台合作或获得其授权。

## 验证

```sh
python scripts/check-release-key-material.py
python scripts/check-release-key-material.py path/to/release.apk
```

Android 和 iOS 的发行 CI 在源码阶段以及 APK/IPA 上传前都执行检查。扫描包括已移除接口/解包符号和固定材料的
ASCII/UTF-16/十六进制数组指纹，不存储原始固定密钥。编译器可能改变常量布局，因此源码检查和安装包检查
必须同时执行；此门禁不能证明不存在任何未知或混淆的材料。

iOS 可以对导出的 IPA 使用同一脚本。原生构建仍需分别在 Android SDK 和 macOS/Xcode 环境验证。
