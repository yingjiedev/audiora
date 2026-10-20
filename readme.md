# Audiora

<div align="center">

  <img src="./src/assets/imgs/audiora-wordmark.png" alt="Audiora" width="520" />

  **支持本地音乐、插件音源与主题定制的开源音乐播放器。**

  简体中文 | [English](./readme-en.md)

  [![License](https://img.shields.io/badge/license-AGPL%203.0-blue)](./LICENSE)
  [![Release](https://img.shields.io/github/v/release/yingjiedev/audiora)](https://github.com/yingjiedev/audiora/releases)
  [![Android](https://img.shields.io/badge/platform-Android-green)](#下载安装)

  [下载](https://github.com/yingjiedev/audiora/releases) · [快速开始](#快速开始) · [反馈问题](https://github.com/yingjiedev/audiora/issues/new/choose)

</div>

Audiora 可以播放手机里的音乐、管理歌单，也可以通过插件接入你选择的在线音乐源。应用提供歌词、下载、听歌统计和主题定制；只听本地音乐时，无需安装额外插件。

## 功能

- **音乐库**：扫描本地音乐，按歌曲、艺术家、专辑和文件夹浏览。
- **歌单与收藏**：创建、导入和收藏歌单，查看最近播放与播放历史。
- **插件扩展**：从文件或链接安装兼容插件，使用其搜索、歌单、榜单等能力。
- **播放与歌词**：播放队列、逐字歌词、翻译歌词，以及通知栏与锁屏播放控制。
- **下载管理**：查看任务和历史，设置文件命名，保存歌曲标签、歌词与封面。
- **主题定制**：浅色与深色模式、自定义壁纸、歌单背景、启动图和内置字体。
- **听歌记录与备份**：查看收听时长和活跃日历，通过本地文件或 WebDAV 备份与恢复数据。

在线搜索、音质、榜单和下载是否可用，取决于所安装插件和音源提供的能力。

## 下载安装

前往 [GitHub Releases](https://github.com/yingjiedev/audiora/releases)，选择需要的版本，在 **Assets** 中下载 APK 并安装。

目前正式 Android 安装包为 **`arm64-v8a`（64 位）**，适用于支持该架构的设备。其他架构可以自行构建，步骤见 [BUILDING.md](./BUILDING.md)。

仓库也包含 iOS 源码和构建流程；可用安装包以对应 Release 的附件为准。

## 快速开始

### 播放本地音乐

1. 打开底部的 **音乐库 → 本地音乐**。
2. 点击 **扫描音乐**，按系统提示选择或授权音乐所在目录。
3. 选择歌曲播放，也可以将歌曲加入自己的歌单。

### 使用在线音源

1. 打开 **我的 → 插件管理**。
2. 通过安装菜单选择 **从本地安装插件** 或 **从网络安装插件**，导入插件文件或输入插件链接。
3. 安装完成后，在 **音乐库 → 在线音乐** 或搜索页使用对应插件。

Audiora 不内置在线音乐源。请使用可信且有权访问的插件与内容；插件的具体功能由其作者维护。更多说明见 [音乐源与插件说明](./docs/plugins-and-sources.md)。

## 文档

| 你想做什么 | 入口 |
| --- | --- |
| 查看版本改动 | [更新日志](./changelog.md) · [0.3.3 发布说明](./release/0.3.3.md) |
| 构建 Android 安装包 | [构建与验证指南](./BUILDING.md) |
| 了解插件与音乐源 | [音乐源与插件说明](./docs/plugins-and-sources.md) |
| 开发兼容插件 | [MusicFree 插件开发文档](https://musicfree.catcat.work/plugin/introduction.html) |
| 查阅上游使用资料 | [插件安装教程](https://musicfree.catcat.work/usage/mobile/install-plugin.html) · [常见问题](https://musicfree.catcat.work/qa/common.html) |

上游资料可用于理解插件机制；Audiora 的页面入口和部分功能与上游不同，请以应用内界面为准。

## 本地开发

项目使用 React Native 和 TypeScript。Android 开发需要 **Node.js 22.13.0 或更新版本、JDK 17 和 Android SDK**；构建环境与签名配置见 [BUILDING.md](./BUILDING.md)。

```sh
git clone https://github.com/yingjiedev/audiora.git
cd audiora
npm install
npm start
```

保持 Metro 运行，在另一个终端连接 Android 设备并执行：

```sh
npm run android
```

iOS 开发需要 macOS、Xcode 和 CocoaPods。安装依赖后，在 `ios/` 中执行 `pod install`，再回到仓库根目录运行 `npm run ios`。

应用代码位于 `src/`，原生工程位于 `android/` 和 `ios/`。代码规范和验证要求见 [AGENTS.md](./AGENTS.md)；修改界面颜色时请遵循 [颜色系统](./COLOR_SYSTEM.md)。

## 反馈与贡献

欢迎通过 [Issues](https://github.com/yingjiedev/audiora/issues/new/choose) 反馈问题或提出建议，也欢迎提交 Pull Request。

反馈问题时，请附上应用版本、设备与系统版本、复现步骤及必要的截图。某个插件的搜索结果、音源失效或专有功能问题，请联系对应插件作者。

提交代码前运行 `npm run lint`，并使用 `npm test -- --runInBand` 或相关测试验证改动。界面变更请附截图或录屏，说明用户可见的变化。

## 致谢

Audiora 基于 [Merilune/MusicFree](https://github.com/Merilune/MusicFree) 持续开发，其上游为 [Toskysun/MusicFree](https://github.com/Toskysun/MusicFree)，原始项目由 [猫头猫（maotoumao）](https://github.com/maotoumao/MusicFree) 创建。感谢上游作者、贡献者，以及参与改进的用户。

## 许可证

本项目采用 [AGPL-3.0](./LICENSE) 许可证。使用、修改和再分发时，请遵守许可证及保留的版权声明；音乐内容和第三方服务的使用权不包含在软件许可证中。
