---
title: "fuwari 博客主题 Mizuki 和 Firefly 对比，以及好玩的主页和笔记博客分享"
published: 2026-05-10
updated: 2026-05-10
description: "博客系列第6期。对比 fuwari 框架下两个好看的主题 Mizuki 和 Firefly，顺便分享一些好玩的主页和笔记博客玩法。"
tags:
  - 博客
  - fuwari
  - Mizuki
  - Firefly
  - Astro
  - 主题对比
slug: mizuki-vs-firefly-themes
category: 分享
draft: false
pinned: false
author: fqzlr
---

<iframe width="100%" height="468"
  src="//player.bilibili.com/player.html?bvid=BV15n5n6nEKU&p=1&autoplay=0"
  scrolling="no" border="0" frameborder="no"
  framespacing="0" allowfullscreen="true">
</iframe>

## fuwari 框架简介

[fuwari](https://github.com/fuwari) 是一个基于 Astro 的静态博客框架体系，下面有多个主题可选。它的特点是部署方式统一（都是 Astro 生态），但不同主题的视觉风格差异很大，适合不同需求的人。

这期视频主要对比其中两个主题：**Mizuki** 和 **Firefly**。

## Mizuki vs Firefly

### Mizuki

Mizuki 更偏「笔记/知识库」风格，界面简洁清爽，适合喜欢极简风的人。它的特点是：

- 布局紧凑，信息密度高
- 适合做个人笔记、知识分享
- 首页展示文章列表，一目了然
- 整体风格偏学术/技术博客

如果你主要想拿来写技术笔记、做知识库，Mizuki 很合适。

### Firefly

Firefly 更偏「个人博客/主页」风格，视觉设计更丰富，可玩性更高。它的特点是：

- 界面更现代，动效和排版更讲究
- 支持更多自定义配置
- 社区活跃，文档齐全
- 适合做个人品牌展示

如果你想打造一个有设计感的个人博客，Firefly 是更好的选择。

### 怎么选

| | Mizuki | Firefly |
|---|--------|---------|
| 风格 | 极简笔记 | 设计感博客 |
| 适合场景 | 知识库、技术笔记 | 个人品牌、内容展示 |
| 上手难度 | 简单 | 稍复杂但文档全 |
| 自定义程度 | 中等 | 较高 |

我的建议：如果你纠结，选 Firefly。它的文档更完善，社区更大，遇到问题更容易找到解决方案。而且后面几期教程都是基于 Firefly 讲的。

## 好玩的主页玩法

除了传统博客，fuwari 生态还可以做很多有趣的东西：

**个人主页**：不做博客，就做一个简洁的个人介绍页，放你的联系方式、项目链接、技能展示。

**笔记站**：把 Obsidian 的笔记同步到博客，变成一个在线知识库。

**项目展示**：用来展示你的开源项目或者作品集。

## 友链

视频里提到了友链功能。友链就是和其他博主互换链接，互相导流。Firefly 主题自带友链页面，你可以在 `src/content/` 下创建友链数据文件，格式大概是：

```yaml
name: 博主名
link: https://他们的博客地址
avatar: 头像链接
description: 一句话介绍
```

也可以加一个友链自助申请按钮，让访客自己提交。这个在后面的文章里有专门讲（[Firefly 友链自助申请](https://fqzlr.com/posts/blog/firefly-link-button/)）。

> 欢迎来加友链：[fqzlr.com/friends](https://fqzlr.com/friends)

## 相关资源

- Firefly 源码：[github.com/CuteLeaf/Firefly](https://github.com/CuteLeaf/Firefly)
- 作者博客：[fqzlr.com](https://fqzlr.com)

> 视频链接：[BV15n5n6nEKU](https://www.bilibili.com/video/BV15n5n6nEKU)
