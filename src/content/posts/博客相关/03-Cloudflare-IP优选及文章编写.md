---
title: "博客部署教程补充之 Cloudflare IP优选及文章编写发布"
published: 2026-05-03
updated: 2026-05-03
description: "博客系列第4期。教你做 Cloudflare IP 优选加速国内访问，以及 Astro 博客的 Markdown 文章编写规范。"
tags:
  - Cloudflare
  - IP优选
  - Astro
  - Markdown
  - 博客
category: 教程
draft: false
pinned: false
author: fqzlr
---

## 为什么要做 IP 优选

Cloudflare 的默认节点对国内访问不太友好，有时候打开很慢。IP 优选的原理是找到一个国内延迟最低的 Cloudflare 节点，把你的域名解析到这个节点上，访问速度会有明显提升。

做完之后体感差别很大，建议部署好博客之后就做这一步。

## IP 优选三步走

### 第一步：添加路由规则

1. 登录 Cloudflare，进入你博客域名的控制台
2. 左侧菜单找到 **规则（Rules）**
3. 点 **添加路由**，地址填 `你的域名/*`（比如 `blog.example.com/*`）
4. 保存

这条规则的作用是让博客的所有页面和静态资源都走优选节点。

### 第二步：配置 DNS 优选解析

1. 左侧菜单进入 **DNS** -> **记录**
2. 点 **添加记录**：
   - 类型：A 记录或 CNAME 都行
   - 名称：随便起个前缀，比如 `speed`
   - 目标：填优选节点地址（格式 `任意内容.cf.090227.xyz`）
   - **重点：关闭代理（把云朵图标点灰）**，不然优选不生效
3. 保存

### 第三步：把主域名指向优选节点

1. 再添加一条 DNS 记录：
   - 名称：填你博客域名的前缀（比如 `blog`，根域名就填 `@`）
   - 目标：填上一步创建的记录名（比如 `speed.你的域名.com`）
   - 代理状态：同样关闭
2. 保存，等 1-3 分钟生效

刷新博客试试，应该能感觉到速度提升。

**原理简述**：博客域名 -> 优选地址 -> Cloudflare 自动选最快的国内节点。Astro 生成的都是纯静态文件（HTML/CSS/图片），配合 CDN 加速效果很好。

## 文章编写规范

博客部署好了，接下来就是写文章。Astro 博客用 Markdown 格式，有一些固定规范。

### 文章放哪

所有文章放在项目源码的 `src/content/posts/` 目录下，文件后缀 `.md`。文件名建议用英文或拼音，避免中文路径可能带来的问题。

图片等资源放在 `src/content/posts/images/` 或 `src/assets/` 下，用相对路径引用。

### Frontmatter 必须写

每篇文章顶部必须有一段 YAML 元数据，用 `---` 包裹：

```yaml
---
title: 文章标题
date: 2026-05-03 19:00:00
description: 简短描述，100字以内，用于SEO和列表展示
cover: /src/content/posts/images/cover.jpg
tags: [标签1, 标签2]
categories: 分类名
draft: false
author: 作者名
---
```

各字段说明：

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 文章标题 |
| `date` | 是 | 发布时间，格式 `YYYY-MM-DD HH:MM` |
| `description` | 否 | 文章摘要 |
| `cover` | 否 | 封面图路径 |
| `tags` | 否 | 标签列表 |
| `categories` | 否 | 分类 |
| `draft` | 是 | `true` 为草稿不会显示，`false` 正式发布 |
| `author` | 否 | 作者名 |

### 编辑器选择

两个推荐：

- **VS Code**：适合想折腾项目配置的人，对 Astro 项目支持好
- **Obsidian**：适合只想安静写文章的人，可视化编辑，不用记语法（后面有专门的教程讲怎么联动）

## 写完之后

文章写好后：

```bash
git add .
git commit -m "新增文章：xxx"
git push
```

推到 GitHub 后 Cloudflare 自动构建上线，刷新博客就能看到了。

> 文字版：[fqzlr.com/posts/blog/ip](https://fqzlr.com/posts/blog/ip/)
>
> 视频链接：[BV1Hk9fBTE6H](https://www.bilibili.com/video/BV1Hk9fBTE6H)
