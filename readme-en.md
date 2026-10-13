# Audiora

<div align="center">

  <img src="./src/assets/imgs/audiora-wordmark.png" alt="Audiora" width="520" />

  **An open-source music player for your local library and the sources you choose.**

  [简体中文](./readme.md) | English

  [![License](https://img.shields.io/badge/license-AGPL%203.0-blue)](./LICENSE)
  [![Release](https://img.shields.io/github/v/release/yingjiedev/audiora)](https://github.com/yingjiedev/audiora/releases)
  [![Android](https://img.shields.io/badge/platform-Android-green)](#download)

  [Download](https://github.com/yingjiedev/audiora/releases) · [Quick start](#quick-start) · [Report an issue](https://github.com/yingjiedev/audiora/issues/new/choose)

</div>

Audiora plays music stored on your phone, manages playlists, and connects to online sources through plugins. It includes lyrics, downloads, listening statistics, and customizable themes. No additional plugin is needed to play local music.

## Features

- **Music library**: Scan local music and browse by song, artist, album, or folder.
- **Playlists and favorites**: Create, import, and save playlists; revisit recent plays and playback history.
- **Plugin support**: Install compatible plugins from a file or URL to access their search, playlist, and chart features.
- **Playback and lyrics**: Playback queues, word-synced and translated lyrics, and notification and lock-screen controls.
- **Downloads**: Manage tasks and history, customize filenames, and save music tags, lyrics, and covers.
- **Personalization**: Light and dark modes, custom wallpapers, playlist backgrounds, launch images, and bundled fonts.
- **Listening history and backups**: View listening duration and activity calendars; back up and restore data with local files or WebDAV.

Online search, audio quality, charts, and downloads depend on the capabilities of the installed plugin and its source.

## Download

Open [GitHub Releases](https://github.com/yingjiedev/audiora/releases), choose a version, and download its APK from **Assets**.

Official Android builds currently target **`arm64-v8a` (64-bit)** devices. To build for another architecture, see [BUILDING.md](./BUILDING.md) (Chinese).

The repository also includes iOS source code and a build workflow. Check the attachments of each release for available packages.

## Quick start

### Play local music

1. Open **Library → Local Music** from the bottom navigation.
2. Tap **Scan music** and select or grant access to your music folder when prompted.
3. Select a song to play, or add songs to your own playlists.

### Connect an online source

1. Open **Mine → Plugin Management**.
2. In the installation menu, choose **Install Plugin from Local** or **Install Plugin from Network**, then select a plugin file or enter its URL.
3. Use the installed plugin from **Library → Online music** or the search page.

Audiora does not bundle online music sources. Use trusted plugins and content you are authorized to access. Plugin authors maintain their plugins' specific features. See [Music sources and plugins](./docs/plugins-and-sources.md#music-sources-and-plugins).

## Documentation

| Goal | Resource |
| --- | --- |
| Read about changes | [Changelog](./changelog.md) · [0.3.0 release notes](./release/0.3.0.md) |
| Build an Android package | [Build and verification guide](./BUILDING.md) |
| Understand plugins and sources | [Music sources and plugins](./docs/plugins-and-sources.md#music-sources-and-plugins) |
| Develop a compatible plugin | [MusicFree plugin documentation](https://musicfree.catcat.work/plugin/introduction.html) |
| Browse upstream help | [Plugin installation](https://musicfree.catcat.work/usage/mobile/install-plugin.html) · [FAQ](https://musicfree.catcat.work/qa/common.html) |

Most linked guides are in Chinese. Upstream documentation explains the plugin system; Audiora's navigation and some features differ, so follow the current app interface.

## Development

Audiora uses React Native and TypeScript. Android development requires **Node.js 22.13.0 or later, JDK 17, and the Android SDK**. See [BUILDING.md](./BUILDING.md) for build prerequisites and signing configuration.

```sh
git clone https://github.com/yingjiedev/audiora.git
cd audiora
npm install
npm start
```

Keep Metro running, connect an Android device, and run this in another terminal:

```sh
npm run android
```

iOS development requires macOS, Xcode, and CocoaPods. After installing dependencies, run `pod install` inside `ios/`, then run `npm run ios` from the repository root.

Application code lives in `src/`, with native projects in `android/` and `ios/`. See [AGENTS.md](./AGENTS.md) for coding and verification guidelines and [COLOR_SYSTEM.md](./COLOR_SYSTEM.md) for UI color changes.

## Contributing

Bug reports, suggestions, and pull requests are welcome. Use [Issues](https://github.com/yingjiedev/audiora/issues/new/choose) and include the app version, device and OS, reproduction steps, and relevant screenshots. Contact the plugin author for source-specific search results, unavailable streams, or plugin-specific features.

Before submitting code, run `npm run lint` and verify your changes with `npm test -- --runInBand` or the relevant tests. Include screenshots or a recording for UI changes, along with a description of their effect.

## Acknowledgments

Audiora is based on [Merilune/MusicFree](https://github.com/Merilune/MusicFree), which descends from [Toskysun/MusicFree](https://github.com/Toskysun/MusicFree) and the original project by [maotoumao](https://github.com/maotoumao/MusicFree). Thanks to the upstream authors, contributors, and users who help improve the app, and to [Claude Code](https://claude.com/claude-code) for development assistance.

## License

Audiora is licensed under [AGPL-3.0](./LICENSE). Follow the license and retained copyright notices when using, modifying, or redistributing it. The software license does not grant rights to music content or third-party services.
