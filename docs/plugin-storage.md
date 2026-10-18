# 插件持久化存储

Audiora 在插件中提供 `require("musicfree/storage")`，兼容 `__musicfree_require` 和 CommonJS `default` 导入。接口均返回 Promise：

```javascript
const storage = require("musicfree/storage");

await storage.setItem("settings", JSON.stringify({ enabled: true }));
const raw = await storage.getItem("settings"); // string | null
const settings = raw === null ? null : JSON.parse(raw);
await storage.removeItem("settings");
```

## 数据与兼容边界

- key 必须是字符串，可以为空；未保存的 key 返回 `null`，空字符串值仍返回 `""`。
- 字符串原样保存。为兼容桌面端，其他值调用自身的 `toString()`；`null` / `undefined` 删除已有值。对象、数组应由插件显式执行 JSON 序列化，宿主不自动转换为 JSON。转换异常、容量超限和底层存储失败均拒绝 Promise，插件应捕获错误并提供回退。
- 每个插件按导出的原始 `platform` 隔离。显示名、代码 hash、版本和安装路径变化不会改变存储归属；修改 `platform` 视为另一个插件，不自动迁移。相同 `platform` 共享数据，与现有插件身份规则一致。
- 与桌面端所有插件共享 key 空间的实现有意不同：插件不能通过这个接口读取其他平台的值。命名空间隔离用于防止互扰，现有插件运行环境不构成安全隔离边界。
- 首次挂载时可在 `module.exports` 赋值前调用异步接口。操作延后至当前同步挂载结束，只有成功挂载的插件可访问存储。升级或卸载后，旧实例残留的调用会拒绝。

## 容量与生命周期

- 单条记录最多 **1 MiB**，所有插件合计最多 **10 MiB**。按 UTF-8 编码后的内部 key（含平台命名空间）和值的字节数计算，不含 MMKV 文件开销。覆盖已有值只计算净增量，删除或重置释放逻辑配额。
- 底层复用 MMKV，保存到持久化数据目录。Promise 接口不表示在后台线程执行；避免大量高频写入，不要存放音频、图片或其他大文件。
- 重启应用和更新插件保留数据。卸载最后一个同平台插件时清除该平台数据；卸载全部插件清除整个插件存储。
- 插件管理中的「重置插件数据」只清除此存储，保留用户变量、歌单及下载文件。插件内存中的状态可能继续存在，必要时应重启应用。
- 普通音乐、歌词、图片缓存清理不清除此存储。宿主不自动设置 TTL 或驱逐记录，插件应自行清理过期缓存；不要依赖永不过期的播放地址。
- 现有歌单备份不会包含此存储，不提供跨设备同步。当前存储未配置加密，不应作为安全凭据存储。

该能力只对主动调用接口的插件生效，不自动缓存旧插件的运行数据，也不保证离线播放。
