# 音乐源与插件说明

Audiora 是音乐客户端，不提供音乐内容，也不运营在线音乐服务。你可以直接播放设备上的本地文件，或安装兼容插件接入自选音源。

## 插件是什么

插件是为播放器扩展音乐源的程序。在线搜索、播放地址、歌词、歌单、榜单和音质等能力，取决于插件的实现及其连接的服务；应用中的功能入口并不代表每个插件都支持该功能。

插件可通过 [`musicfree/storage`](./plugin-storage.md) 保存自己的配置、状态和小型缓存。数据按插件隔离，更新时保留，卸载时清除；可在插件管理中单独重置。

在 **我的 → 插件管理** 中，可以从本地文件或网络链接安装插件。开发兼容插件可参考 [MusicFree 插件文档](https://musicfree.catcat.work/plugin/introduction.html)。

遇到单个音源搜不到歌曲、链接失效或功能缺失时，请先检查对应插件的说明和更新，必要时联系其作者。客户端问题请通过 [Audiora Issues](https://github.com/yingjiedev/audiora/issues/new/choose) 反馈。

## 内容与使用范围

- Audiora 面向用户自有、已获授权或依法可以访问的内容。默认发行包不内置在线音乐源，不提供或推荐未经授权的音源、商业平台专用密钥或接口凭据，也不提供绕过 DRM 或其他访问控制的实现。
- 插件与音源由用户选择，可能由独立第三方开发和运营。通用插件运行能力不代表项目对其内容、可用性、安全性或合法性作出审核、背书或保证。
- 安装前请核实插件来源和网络访问范围。访问、播放、下载或同步内容时，请确认拥有相应权限，并遵守适用法律、版权规则与服务条款；相关提供者和使用者依法承担各自行为的责任。
- 软件的 AGPL-3.0 许可不授予音乐内容、第三方服务、商标或接口的额外使用权。分发或通过网络提供修改版本时，应按许可证要求提供相应源代码与许可证信息，完整条款见 [LICENSE](../LICENSE)。

若插件、示例或文档可能侵犯权利，请通过 [Issue](https://github.com/yingjiedev/audiora/issues/new/choose) 提供来源、权利依据及相关链接，供维护者核查并采取移除链接、停止推荐等适当措施。

---

## Music sources and plugins

Audiora is a music client, not a content provider or online music service. Local files can be played without additional plugins. Compatible plugins extend the app with sources selected by the user; their search, streams, lyrics, playlists, charts, and quality options depend on the plugin and its provider.

Install plugins through **Mine → Plugin Management**. For development, see the [MusicFree plugin documentation](https://musicfree.catcat.work/plugin/introduction.html). Contact the plugin author for source-specific problems; report client problems through [Audiora Issues](https://github.com/yingjiedev/audiora/issues/new/choose).

- Use content you own, are authorized to use, or may otherwise access lawfully. Official builds do not bundle online sources, provide or recommend unauthorized sources or commercial-platform credentials, or include access-control bypasses.
- Users select plugins and sources, which may be maintained by independent third parties. The plugin runtime does not imply review, endorsement, or guarantees concerning their content, availability, safety, or legality.
- Review a plugin's origin and network access before installation. Ensure you have the right to access, play, download, or sync content and comply with applicable laws, copyright rules, and service terms. Providers and users remain responsible for their respective services and actions.
- The software license grants no additional rights to content, services, trademarks, or interfaces. When distributing or providing modified versions over a network, provide the corresponding source and license information as required by [LICENSE](../LICENSE).

For rights concerns involving a plugin, example, or document, open an [issue](https://github.com/yingjiedev/audiora/issues/new/choose) with the source, the basis of the claim, and relevant links so maintainers can review and take appropriate action.
