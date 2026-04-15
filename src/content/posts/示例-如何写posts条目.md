---
title: 示例：如何写posts条目
published: 2026-04-14
description: 这是一个示例条目，用来说明如何在posts目录下创建文章。
tags:
  - 示例
  - 模板
  - 指南
category: 博客指南
---

这个文件是“文章（posts）”内容集合的示例条目，你可以照着复制一份来新增自己的文章；也可以在确认学会后直接删除本文件。

## 字段说明（Frontmatter）

### title（必填）
文章标题。

示例：
- `title: "示例：如何写posts条目"`

### published（必填）
文章发布日期。

示例：
- `published: 2026-04-14`

### updated（可选）
文章更新日期。如果未设置，将默认使用发布日期。

示例：
- `updated: 2026-04-15`

### pinned（可选）
是否将此文章置顶在文章列表顶部。

示例：
- `pinned: true`

### description（可选）
文章的简短描述。显示在首页上。

示例：
- `description: "这是一个示例条目，用来说明如何在posts目录下创建文章。"`

### image（可选）
文章封面图片路径。
- 以 `http://` 或 `https://` 开头：使用网络图片
- 以 `/` 开头：`public` 目录中的图片
- 不带任何前缀：相对于 markdown 文件的路径

示例：
- `image: "https://re.tsh520.cn/zl/zbd.webp"`
- `image: "/images/cover.webp"`
- `image: "./cover.jpg"`

### tags（可选）
文章标签数组。

示例：
- `tags: ["示例", "模板", "指南"]`

### category（可选）
文章分类。

示例：
- `category: "博客指南"`

### lang（可选）
文章语言代码（如 `zh-CN`）。仅当文章语言与站点默认语言不同时设置。

示例：
- `lang: "zh-CN"`

### licenseName（可选）
文章内容的许可证名称。

示例：
- `licenseName: "CC BY-NC-SA 4.0"`

### licenseUrl（可选）
文章内容的许可证链接。

示例：
- `licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/"`

### author（可选）
文章作者。

示例：
- `author: "团子和蛋糕"`

### sourceLink（可选）
文章内容的来源链接或参考。

示例：
- `sourceLink: "https://example.com/reference"`

### draft（可选）
如果这篇文章仍是草稿，则不会显示。

示例：
- `draft: false`

### comment（可选）
是否启用此文章的评论功能。默认为 `true`。

示例：
- `comment: true`

### slug（可选）
自定义文章 URL 路径。如果不设置，将使用文件名作为 URL。

示例：
- `slug: "how-to-write-posts"`

## 文章文件的放置位置

您的文章文件应放置在 `src/content/posts/` 目录中。您也可以创建子目录来更好地组织您的文章和资源。

```
src/content/posts/
├── post-1.md
└── post-2/
    ├── cover.png
    └── index.md
```

## 自定义文章 URL (Slug)

### 什么是 Slug？

Slug 是文章 URL 路径的自定义部分。如果不设置 slug，系统将使用文件名作为 URL。

### Slug 使用示例

#### 示例 1：使用文件名作为 URL
```yaml
---
title: 我的第一篇博客文章
published: 2023-09-09
---
```
文件：`src/content/posts/my-first-blog-post.md`

URL：`/posts/my-first-blog-post`

#### 示例 2：自定义 Slug
```yaml
---
title: 我的第一篇博客文章
published: 2023-09-09
slug: hello-world
---
```
文件：`src/content/posts/my-first-blog-post.md`

URL：`/posts/hello-world`

### Slug 使用建议

1. **使用英文和连字符**：`my-awesome-post` 而不是 `my awesome post`
2. **保持简洁**：避免过长的 slug
3. **具有描述性**：让 URL 能够反映文章内容
4. **避免特殊字符**：只使用字母、数字和连字符
5. **保持一致性**：在整个博客中使用相似的命名模式

### 注意事项

- Slug 一旦设置并发布，建议不要随意更改，以免影响 SEO 和已存在的链接
- 如果多个文章使用相同的 slug，后面的文章会覆盖前面的
- Slug 会自动转换为小写