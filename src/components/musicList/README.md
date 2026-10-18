# 歌曲批量选择

各场景共用歌曲行、`SelectionBar`、`SelectionDoneAction` 和 `SelectionActions`，不要在页面中另写全选按钮或底部操作栏。配色由 `useColors()` 提供，样式在公共组件中维护。

## 进入批量选择

所有入口使用 `useOpenMusicListEditor()`。有 `sourceId` 时自动进入只选择模式，继续订阅原页面的分页数据；筛选后的本地列表需要显式传入 `selectionOnly: true`。

```tsx
const openEditor = useOpenMusicListEditor();

openEditor({
    musicList,
    musicSheet: { title },
    sourceId,
    actions: { download: false },
});
```

`actions` 支持 `addNext`、`addToSheet`、`download`、`remove` 四个开关。前三项默认开启，设为 `false` 后不显示，剩余按钮均分同一行。移除需要页面提供实际的移除能力；传入 `remove: true` 不会让在线或筛选结果获得写入本地歌单的权限。

## 原页面内选择

“我喜欢”等页面使用 `useMusicSelection()` 管理选择状态，将其 `selection` 传给公共 `MusicList`，并使用相同的选择栏和操作栏。`openEditor(options, editor.start)` 会在原页面开启选择。

```tsx
<SelectionActions
    actions={{ download: false }}
    selectedItems={editor.selectedItems}
    onClear={editor.clear}
    removal={{ onRemove: items => MusicSheet.removeMusic(sheetId, items) }}
/>
```

移除确认、重复提交拦截、失败提示和成功后的选择清理由公共操作栏负责。异步操作只清除本次提交的歌曲，处理中新增的选择会保留。手动排序仍使用原排序列表，点击“完成”先保存；保存失败时停留在编辑页。
