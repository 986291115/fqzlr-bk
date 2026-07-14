---
title: "Obsidian 笔记软件联动 Mizuki & Firefly Astro 等个人博客，优雅的利用图床写文章"
published: 2026-05-18
updated: 2026-05-18
description: "博客系列第7期。用 Obsidian 写笔记，通过 Astro Composer 插件自动转换为博客内容，配合图床优雅发布。"
image: "api"
tags:
  - Obsidian
  - Astro
  - 图床
  - 博客
  - 笔记软件
slug: obsidian-astro-imgbed-workflow
category: 博客相关
draft: false
pinned: false
author: fqzlr
---

<iframe width="100%" height="468"
  src="//player.bilibili.com/player.html?bvid=BV1jWLH6cERQ&p=1&autoplay=0"
  scrolling="no" border="0" frameborder="no"
  framespacing="0" allowfullscreen="true">
</iframe>

## 这套工作流是什么

简单说就是：**用 Obsidian 写笔记 -> 自动转成博客文章格式 -> 推送到 GitHub -> 博客自动更新**。

写文章的人不需要关心部署、构建这些事，只管在 Obsidian 里写就行。整个流程打通之后，写作体验非常丝滑。

这个方案适用于所有基于 Astro 的博客主题，包括 Mizuki、Firefly 等。

## 前置条件

- 已经有一个 Astro 博客（参考前面几期教程）
- 安装了 Obsidian
- 有一个自建图床（参考第5期图床教程）
- 会基本的 Git 操作

## 核心：安装 Astro Composer 插件

这个插件是 Obsidian 和 Astro 博客之间的桥梁，它能把 Obsidian 笔记自动转换成 Astro 能识别的 Markdown 格式。

### 安装步骤

Astro Composer 还没上架社区插件库，需要通过 BRAT 安装：

1. 先在 Obsidian 社区插件里搜索安装 **BRAT**
2. 启用 BRAT 后，打开 BRAT 设置
3. 点 **Add a beta plugin**
4. 输入仓库地址：`https://github.com/astro-modular/astro-composer`
5. 点 Add Plugin，等安装完启用

### 配置插件

安装后进入 Astro Composer 设置，有几个关键配置项：

**Posts Folder** — Obsidian 里放博客文章的文件夹

比如设成 `Blog/Posts`，以后所有要发到博客的笔记都放在这个文件夹下。

**Astro Content Path** — 本地 Astro 项目的 `src/content` 目录路径

比如 `D:/MyBlog/Firefly/src/content`，插件会把转换后的内容同步到这个目录。

**Link Base Path** — 博客的文章访问路径前缀

比如填 `/blog`，插件会自动把 Obsidian 内部链接转成博客友好的格式。

**Creation Mode** — 文章存储结构

推荐选 `Folder-based with index.md`，每篇文章一个文件夹，里面放 `index.md`。

**Draft Management** — 草稿管理

建议启用 `Underscore Prefix`，草稿文件会自动加下划线前缀（如 `_my-draft.md`），Astro 会忽略这些文件不发布。

## 配合图床使用

写文章的时候图片怎么办？这就是图床派上用场的时候了。

1. 在 Obsidian 里插入图片
2. 图片自动上传到你的 Cloudflare 图床
3. 文章里的图片链接自动替换成图床 URL
4. 推送到 GitHub 后，博客上的图片直接加载图床链接

这样图片不占项目仓库空间，加载速度也快。

## 日常写作流程

配好之后日常使用就三步：

1. 打开 Obsidian，在 Posts Folder 里新建笔记，正常写
2. 写完后用 Git 推送代码到 GitHub
3. Cloudflare 自动构建，博客更新

整个过程不需要手动去管 Astro 的文件格式、Frontmatter 这些，Astro Composer 都帮你处理好了。

## 进阶：配合 Git 插件自动同步

Obsidian 有个 **Obsidian Git** 插件，可以设置定时自动 commit + push。配好之后你连 Git 命令都不用打，写完笔记保存，Obsidian 自动帮你推到 GitHub。

这样就实现了真正的「写完即发布」。

> 视频链接：[BV1jWLH6cERQ](https://www.bilibili.com/video/BV1jWLH6cERQ)
