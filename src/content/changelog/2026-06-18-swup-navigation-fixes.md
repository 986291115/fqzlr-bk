---
version: "v1.7.1"
date: 2026-06-18
time: "17:30"
type: fix
description: 修复 Swup 导航相关多个问题 + 文章列表按钮失效 + 笔记本预览样式优化
---

## Swup 导航修复

- 修复后台管理页面之间切换时布局样式瞬间丢失、只显示文字的问题
- 原因：后台页面使用 `data-swup-ignore`（Swup v3 属性），而 Swup v4 实际识别的是 `data-no-swup`
- 将 `src/pages/admin/` 下 3 个文件共 9 处 `data-swup-ignore` 替换为 `data-no-swup`

## Gist 数据首次加载失败修复

修复多个页面首次访问时 Gist 数据不显示、需要刷新才能加载的问题。根本原因相同：脚本被放在 `<MainGridLayout>` 组件标签外部，Astro 将其渲染到 `</body></html>` 之后，导致 Swup 导航时脚本无法被正确执行。

- **置顶说说页面** (`/moments/pinned/`)：将脚本移入 `<MainGridLayout>` 内部
- **笔记本索引页面** (`/life/notebooks/[slug]`)：将远程笔记加载脚本移入 `<MainGridLayout>` 内部
- **云端笔记页面** (`/life/notebooks/remote-entry/`)：将笔记内容加载脚本移入 `<MainGridLayout>` 内部

## 说说页面标签不可点击修复

- 修复说说页面外部 Gist 数据的标签点击后无反应的问题
- 原因：`MainGridLayout.astro` 中 `createCard()` 函数创建标签时使用 `<span>` 元素而非 `<a>` 链接
- 改为创建 `<a href="/archive/?tag=...">` 元素，与置顶页面和 MomentCard 组件行为一致

## 说说页面切换闪烁优化

- 优化从置顶页面返回说说页面时的样式闪烁问题
- 原因：两个页面各自有 `<style is:global>` 块定义卡片样式，Swup 的 `updateHead` 在切换时先移除旧样式再添加新样式，导致短暂无样式状态
- 将共享的卡片样式提取到 `src/styles/features/moments.css` 持久 CSS 文件中，通过 `main.css` 加载
- 从 `moments.astro` 和 `pinned.astro` 中移除重复的 `<style is:global>` 块

## 文章列表页面按钮失效修复

- 修复首次进入文章列表页面时封面开关按钮和分类按钮点击无反应的问题
- 原因：`PostPage.astro` 的布局切换脚本使用模块脚本（`<script>`），Swup 替换时浏览器不会重新执行模块；且依赖 `DOMContentLoaded` 事件在 Swup 导航时不会再次触发
- 将模块脚本改为 `<script is:inline>`，确保 Swup ScriptsPlugin 能正确重新执行
- 添加 `swup:content:replace` 事件监听，Swup 导航后重新初始化布局

## 笔记本预览样式优化

- 修复远程 Gist 笔记预览显示标题而非内容的问题，改为与本地笔记一致只显示日期和内容预览
- 为远程笔记预览添加 Markdown 格式渲染（粗体、斜体、行内代码、链接、换行）
- 修复本地笔记预览丢失换行效果的问题，保留 `<br>` 换行标签而非去除所有 HTML
- 本地和远程笔记预览现在都支持 Markdown 格式和换行显示
