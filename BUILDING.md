# Android 本地测试包构建

本页用于构建可安装的 Android Release 测试 APK。推荐使用仓库自带的 PowerShell 脚本自动完成版本号、构建、校验和清理。

## 构建前准备

- 使用 JDK 17、Android SDK（项目当前使用 Build Tools 36.0.0、NDK 27.1.12297006）和 Node.js。
- 在**独立的构建工作树**中操作，不能在含有未提交改动的主工作树中生成构建信息。
- Windows 下将工作树放在短路径、未启用 EFS 加密的目录，例如 `C:\a`。React Native 原生依赖的 CMake 构建路径很深；过长路径或加密目录可能导致构建失败。
- 每个可安装测试包都必须使用新的 `versionName` 和递增的 Android `versionCode`。脚本会自动生成并通过 Gradle 参数传入，不会改写需要提交的版本文件。

示例：从要测试的提交创建一个短路径工作树。

```powershell
git worktree add --detach C:\a <commit>
Set-Location C:\a
```

## 自动构建（推荐）

在仓库根目录执行：

```powershell
npm run build-preview
```

默认生成 `arm64-v8a` APK。脚本会自动：

- 按当前 `package.json` 版本生成唯一的预览 `versionName` 和 Android `versionCode`。
- 在依赖缺失时执行 `npm ci`（也可以显式传入 `-InstallDependencies`）。
- 生成构建信息并调用 Gradle Release 构建。
- 在 Windows 上临时处理 NDK 文件属性问题。
- 使用 `aapt2`、`apksigner` 和 SHA-256 校验实际 APK。
- 结束时恢复构建信息并删除临时 SDK/Gradle 配置。

构建所有 ABI：

```powershell
npm run build-preview -- -Abi all
```

强制重新安装依赖：

```powershell
npm run build-preview -- -InstallDependencies
```

如自动发现失败，可以先设置 SDK 路径：

```powershell
$env:ANDROID_SDK_ROOT = 'C:\Users\<username>\AppData\Local\Android\Sdk'
npm run build-preview
```

## 手动 Gradle 构建（备用）

仅在调试脚本本身时使用手动流程。不要直接编辑版本文件来区分测试包；请通过 Gradle 参数传入版本：

```powershell
Set-Location .\android
.\gradlew.bat :app:assembleRelease `
  -PappVersion=0.1.4-preview.example `
  -PappVersionCode=400038 `
  -PbuildAbi=arm64-v8a `
  -PreactNativeArchitectures=arm64-v8a `
  --max-workers=1 `
  --no-configuration-cache `
  --no-daemon `
  --console=plain
```

APK 位于：

```text
android/app/build/outputs/apk/release/Audiora-v<version>-arm64-v8a-release.apk
```

手动流程完成后不要提交版本号、构建时间或任何 Gradle 产物。

## APK 验证

构建成功后，验证实际 APK，而不是只检查 Gradle 的成功日志。将 `$apk` 替换为生成的 APK 路径。

```powershell
$apk = 'C:\a\android\app\build\outputs\apk\release\Audiora-v<version>-arm64-v8a-release.apk'
$aapt = "$env:ANDROID_SDK_ROOT\build-tools\36.0.0\aapt2.exe"
$apksigner = "$env:ANDROID_SDK_ROOT\build-tools\36.0.0\apksigner.bat"

& $aapt dump badging $apk
& $aapt list $apk | Select-String '^lib/'
& $aapt dump resources $apk | Select-String 'network_security_config'
& $aapt dump xmltree $apk AndroidManifest.xml | Select-String 'networkSecurityConfig'
& $apksigner verify --verbose --print-certs $apk
Get-FileHash -LiteralPath $apk -Algorithm SHA256
```

至少记录并报告：APK 绝对路径、`applicationId`、`versionName`、`versionCode`、ABI、SHA-256、签名类型，以及是否有真机/模拟器验证。使用默认 `debug.keystore` 时，Release APK 是测试签名；若设备已有不同签名的同包名应用，应先卸载旧应用再安装。

## 常见问题

### `ninja: error: manifest 'build.ninja' still dirty after 100 tries`

不要在原工作树反复执行 `clean`；该操作也可能触发损坏的原生缓存。改用全新的短路径工作树，重新执行 `npm ci`，并使用上面的单 ABI、单 worker 命令。若工作目录或磁盘启用了 EFS 加密，请换到未加密的目录后重建。

### Android SDK 包目录不一致

若构建前出现 Android SDK package location 不一致的提示，先在 Android Studio SDK Manager 或 `sdkmanager` 中修复/重新安装对应的平台与 Build Tools，再构建。不要将 SDK 目录的临时重命名结果提交到仓库。
