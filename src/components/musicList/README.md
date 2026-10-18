# 歌曲批量选择

批量选择直接作用于当前列表。页面、列表实例、滚动位置、搜索来源和分页状态保留；完成或返回退出多选。不要从批量入口跳转到独立编辑页。

## 页面接入

页面在安全区内放置 `MusicSelectionProvider`，列表所属组件调用 `useInlineMusicSelection(scope, musicList, options)`。`scope` 应包含查询词、歌单 ID 或来源等列表身份，身份变化时自动清除旧选择。

```tsx
<MusicSelectionProvider>
    <PageContent />
</MusicSelectionProvider>

function PageContent() {
    const editor = useInlineMusicSelection(scope, musicList, {
        actions: { download: false },
    });
    return (
        <>
            <AppBar
                onBackPress={editor.editing ? editor.finish : undefined}
                actionComponent={editor.editing ? <SelectionDoneAction onPress={editor.finish} /> : undefined}
            />
            <MusicList
                Header={editor.editing
                    ? <InlineSelectionBar editor={editor} count={musicList.length} paginated />
                    : <BatchEditAction onPress={editor.start} />}
                musicList={musicList}
                selection={editor.selection}
                state={state}
                onLoadMore={loadMore}
            />
        </>
    );
}
```

底部工具栏和 Android 返回退出由 Provider 统一处理。导航栏位于其他组件时，使用 `useActiveMusicSelection()` 取得当前多选控制器。切换来源或分类前调用 `finish()`；分页追加保留已有勾选，新歌曲默认不选中。

## 操作开关

`actions` 支持 `addNext`、`addToSheet`、`download`、`remove`。前三项默认开启，设为 `false` 后不显示，剩余按钮均分同一行。移除需要显式提供 `removal.onRemove(items)`；仅设置 `remove: true` 无法让远程或筛选结果获得本地歌单写入能力。

移除确认、重复提交拦截、失败提示和成功后的选择清理由公共操作栏负责。异步操作只清除本次提交的歌曲，保留处理中新增的选择。聚合搜索保留原聚合行，勾选一行包含该行的所有已加载来源；新来源追加时用半选状态表示。

“我喜欢”继续使用现有的 `useMusicSelection()` 和同一套歌曲行、选择栏、操作栏。`useOpenMusicListEditor()` 仅用于单独的手动排序入口；批量操作使用 `useInlineMusicSelection()`。
