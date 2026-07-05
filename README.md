<img src="./_backup/original-docs/docs/images/1131.png" width = "350" height = "500" alt="Firefly" align=right />

<div align="center">

# Fqzlr 的博客
> 基于 Firefly 主题的个人博客网站，构建于 Astro 框架之上
>
> ![Node.js >= 22](https://img.shields.io/badge/node.js-%3E%3D22-brightgreen)
![pnpm >= 9](https://img.shields.io/badge/pnpm-%3E%3D9-blue)
![Astro](https://img.shields.io/badge/Astro-6.4.6-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue)
>
> ![GitHub License](https://img.shields.io/github/license/fqzlr/fqzlr-bk)

</div>


---
📖 README：
**[简体中文](README.md)** | **[English](_backup/README.en.md)**

🚀 在线站点：
[**🌐 Fqzlr的博客**](https://fqzlr.com/)

⚡ 静态站点生成: 基于Astro的超快加载速度和SEO优化

🎨 现代化设计: 简洁美观的界面，支持自定义主题色

📱 移动友好: 完美的响应式体验，移动端专项优化

🔧 高度可配置: 大部分功能模块均可通过配置文件自定义

<img alt="firefly" src="./_backup/original-docs/docs/images/1.webp" />

>[!TIP]
>
>这是 Fqzlr 的个人技术博客，基于 Firefly 主题模板二次开发。专注 NAS 分享、AI 实践、学习笔记与技术总结，以及个人成长分享。

## ✨ 功能特性

### 核心功能

- [x] **Astro + Tailwind CSS** - 基于现代技术栈的超快静态站点生成
- [x] **流畅动画** - Swup 页面过渡动画，提供丝滑的浏览体验
- [x] **响应式设计** - 完美适配桌面端、平板和移动设备
- [x] **多语言支持** - i18n 国际化，支持简体中文和英文
- [x] **全文搜索** - 基于 Pagefind 的客户端搜索，支持文章内容索引
- [x] **在线编辑** - 支持文章、说说、相册、友链等内容的在线编辑

### 个性化

- [x] **动态侧边栏** - 支持配置单侧边栏、双侧边栏
- [x] **文章布局** - 支持配置(单列)列表、网格(多列/瀑布流)布局
- [x] **字体管理** - 支持自定义字体，丰富的字体选择器
- [x] **页脚配置** - HTML 内容注入，完全自定义
- [x] **亮暗色模式** - 支持亮色/暗色/跟随系统三种模式
- [x] **导航栏自定义** - Logo、标题、链接全面自定义
- [x] **壁纸模式切换** - 横幅壁纸、全屏透明壁纸、纯色背景
- [x] **主题色自定义** - 360° 色相调节
- [x] **上下班头像** - 根据时间自动切换上下班头像

### 页面与组件

- [x] **首页** - 动态门户、最新文章、说说、站点统计
- [x] **博客文章** - 分类、标签、归档、搜索
- [x] **说说/动态** - 微信朋友圈风格的短内容发布
- [x] **留言板** - 支持弹幕效果的留言页面
- [x] **公告栏** - 支持侧边栏公告提示
- [x] **看板娘** - 支持 Spine 和 Live2D 两种动画引擎
- [x] **站点统计** - 显示文章、分类、标签数目、文章总字数等数据
- [x] **站点日历** - 显示当月日历，以及当月的发布文章
- [x] **赞助页面** - 赞助链接跳转、收款码展示、赞助者列表
- [x] **分享海报** - 支持生成精美的文章分享海报
- [x] **樱花特效** - 支持樱花特效，全屏樱花效果
- [x] **友情链接** - 精美的友情链接展示页面，支持 GitHub Issue 申请
- [x] **番组计划** - 展示动漫、游戏、书籍和音乐收藏
- [x] **评论系统** - 集成 Waline 评论系统
- [x] **访问量统计** - 支持 Umami / Google Analytics / Microsoft Clarity
- [x] **音乐播放器** - Material Design 3 设计风格的音乐播放器
- [x] **相册** - 图片相册展示，支持标签分类
- [x] **网址导航** - 实用的网址导航页面
- [x] **笔记本** - 日记、随笔、学习笔记管理
- [x] **足迹地图** - 旅行足迹记录与地图展示
- [x] **日常规划** - 作息时间表展示
- [x] **更新日志** - 版本更新记录

### 内容增强

- [x] **图片灯箱** - Fancyapps 图片预览功能
- [x] **浮动目录** - 动态显示文章目录，支持锚点跳转
- [x] **邮箱保护** - 防止爬虫抓取邮箱地址
- [x] **侧边栏目录** - 动态显示文章目录，支持锚点跳转
- [x] **增强代码块** - 基于 Expressive Code，支持代码折叠、行号、语言标识
- [x] **数学公式支持** - KaTeX 渲染引擎，支持行内和块级公式
- [x] **文章随机封面图** - 支持通过 API 获取随机封面图
- [x] **Markdown 扩展** - 更多的 Markdown 扩展语法（提醒块、GitHub 卡片等）

### SEO 与订阅

- [x] **SEO 优化** - 完整的 meta 标签和结构化数据
- [x] **RSS 订阅** - 自动生成 RSS Feed
- [x] **站点地图** - 自动生成 XML Sitemap，支持页面过滤配置

## 📁 项目结构

```
dumplingandcakeblog/
├── _backup/                  # 备份文件（旧内容、原始文档、临时文件等）
├── api/                      # 服务端 API 脚本
├── public/                   # 静态资源（不经过构建优化）
│   ├── assets/               # 图片、JS 等资源
│   ├── favicon/              # 网站图标
│   ├── gallery/              # 相册图片
│   └── pio/                  # 看板娘模型
├── scripts/                  # 工具脚本
│   ├── fetch-media/          # 媒体资源抓取脚本
│   ├── fetch-music/          # 音乐下载脚本
│   ├── generate-icons/       # 图标生成脚本
│   ├── new-post/             # 新建文章脚本
│   └── sync/                 # 笔记同步脚本
├── src/
│   ├── assets/               # 资源文件（会被构建优化）
│   │   └── images/           # 图片资源
│   ├── components/           # Astro/Svelte 组件
│   │   ├── comment/          # 评论组件
│   │   ├── common/           # 通用组件
│   │   ├── controls/         # 控制组件（返回顶部、搜索等）
│   │   ├── edit/             # 在线编辑组件
│   │   ├── features/         # 特色功能组件
│   │   ├── guestbook/        # 留言板组件
│   │   ├── layout/           # 布局组件
│   │   ├── life/             # 生活相关组件
│   │   ├── moments/          # 说说组件
│   │   ├── pages/            # 页面专用组件
│   │   └── widget/           # 侧边栏组件
│   ├── config/               # 配置文件（核心！）
│   │   ├── siteConfig.ts     # 站点基础配置
│   │   ├── profileConfig.ts  # 用户资料配置
│   │   ├── friendsConfig.ts  # 友链配置
│   │   ├── sponsorConfig.ts  # 赞助配置
│   │   ├── navBarConfig.ts   # 导航栏配置
│   │   ├── sidebarConfig.ts  # 侧边栏配置
│   │   ├── musicConfig.ts    # 音乐播放器配置
│   │   └── ...               # 其他配置
│   ├── constants/            # 常量定义
│   ├── content/              # 内容集合（Markdown 文件）
│   │   ├── posts/            # 博客文章
│   │   ├── moments/          # 说说动态
│   │   ├── album/            # 相册
│   │   ├── bangumi/          # 番组计划
│   │   ├── friends/          # 友情链接
│   │   ├── life/             # 生活记录
│   │   │   ├── notebooks/    # 笔记本
│   │   │   ├── places/       # 足迹
│   │   │   └── routines/     # 日常规划
│   │   ├── changelog/        # 更新日志
│   │   ├── daohang/          # 网址导航
│   │   ├── spec/             # 特殊页面内容
│   │   ├── ziyuan/           # 资源（公告、名言等）
│   │   └── danmu/            # 弹幕
│   ├── content.config.ts     # 内容集合配置
│   ├── i18n/                 # 国际化语言包
│   ├── layouts/              # 页面布局
│   ├── pages/                # 页面路由
│   ├── styles/               # 全局样式
│   ├── types/                # TypeScript 类型定义
│   └── utils/                # 工具函数
├── astro.config.mjs          # Astro 配置文件
├── package.json              # 项目依赖
└── README.md                 # 项目说明
```

## 🚀 快速开始

### 环境要求

- Node.js ≥ 22
- pnpm ≥ 9

### 本地开发部署

1. **克隆仓库：**
   ```bash
   git clone https://github.com/fqzlr/fqzlr-bk.git
   cd dumplingandcakeblog
   ```

2. **安装依赖：**
   ```bash
   # 如果没有安装 pnpm，先安装
   npm install -g pnpm

   # 安装项目依赖
   pnpm install
   ```

3. **配置博客：**
   - 编辑 `src/config/` 目录下的配置文件自定义博客设置
   - 主要配置文件：`siteConfig.ts`（站点基础）、`profileConfig.ts`（个人资料）
   - 内容文件存放在 `src/content/` 目录下

4. **启动开发服务器：**
   ```bash
   pnpm dev
   ```
   博客将在 `http://localhost:4321` 可用

### 平台托管部署

参考 [Astro 官方部署指南](https://docs.astro.build/zh-cn/guides/deploy/) 将博客部署至 Vercel, Netlify, GitHub Pages, Cloudflare Pages 等平台。

**通用配置：**
- 框架预设：`Astro`
- 根目录：`./`
- 输出目录：`dist`
- 构建命令：`pnpm run build`
- 安装命令：`pnpm install`

## ⚙️ 配置说明

### 设置网站语言

编辑 `src/config/siteConfig.ts` 文件：

```typescript
const SITE_LANG = "zh_CN"; // 简体中文
```

**支持的语言代码：**
- `zh_CN` - 简体中文
- `en` - 英文
- `zh_TW` - 繁体中文（备份中）
- `ja` - 日语（备份中）
- `ru` - 俄语（备份中）

### 配置文件总览

所有配置文件位于 `src/config/` 目录下：

| 配置文件 | 说明 |
|---------|------|
| `siteConfig.ts` | 站点基础配置（标题、URL、主题色、页面开关等） |
| `profileConfig.ts` | 用户资料配置（头像、名字、签名、社交链接等） |
| `navBarConfig.ts` | 导航栏配置（菜单项、Logo、搜索等） |
| `sidebarConfig.ts` | 侧边栏布局配置（显示哪些组件、左右侧栏等） |
| `friendsConfig.ts` | 友链页面配置（申请方式、本站信息等） |
| `sponsorConfig.ts` | 赞助页面配置（赞助方式、赞助者列表等） |
| `musicConfig.ts` | 音乐播放器配置（歌单、播放器设置等） |
| `commentConfig.ts` | 评论系统配置（Waline/Giscus/Twikoo 等） |
| `backgroundWallpaper.ts` | 背景壁纸配置 |
| `fontConfig.ts` | 字体配置 |
| `footerConfig.ts` | 页脚配置 |
| `sakuraConfig.ts` | 樱花特效配置 |
| `pioConfig.ts` | 看板娘配置（Spine / Live2D） |
| `coverImageConfig.ts` | 文章封面图配置 |
| `announcementConfig.ts` | 公告配置 |
| `adConfig.ts` | 广告配置 |
| `editConfig.ts` | 在线编辑功能配置 |

## 📝 文章 Frontmatter

```yaml
---
title: 文章标题
published: 2026-07-01          # 发布日期
updated: 2026-07-05            # 更新日期（可选）
description: 文章描述           # SEO 描述
image: ./cover.jpg             # 封面图，或使用 "api" 启用随机封面
tags: [标签1, 标签2]           # 标签
category: 分类名               # 分类
draft: false                   # 是否为草稿
lang: zh-CN                    # 文章语言（与站点默认不同时设置）
pinned: false                  # 是否置顶
comment: true                  # 是否允许评论
---
```

## 🧞 常用命令

下列指令均需要在项目根目录执行：

| Command | 说明 |
|:--------|:-----|
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 在 `localhost:4321` 启动本地开发服务器 |
| `pnpm build` | 构建网站至 `./dist/` |
| `pnpm preview` | 本地预览已构建的网站 |
| `pnpm check` | 检查代码中的错误 |
| `pnpm format` | 使用 Biome 格式化代码 |
| `pnpm lint` | 使用 Biome 检查代码规范 |
| `pnpm new-post <filename>` | 创建新文章 |
| `pnpm sync` | 同步笔记（Obsidian 集成） |
| `pnpm icons` | 生成图标 |
| `pnpm astro ...` | 执行 Astro CLI 命令 |

## 🎨 内容编辑方式

### 方式一：直接编辑文件（推荐）

直接在 `src/content/` 对应目录下创建/编辑 Markdown 文件。

### 方式二：在线编辑

网站内置了在线编辑功能，访问 `/admin.html`（需先在 `editConfig.ts` 中配置密码）。

支持在线编辑的内容：
- 博客文章
- 说说动态
- 友情链接
- 相册
- 笔记本
- 日常规划
- 足迹
- 赞助
- 网址导航
- 番组计划

### 方式三：命令行创建

```bash
pnpm new-post 文章标题
```

## 🔗 友链申请

本博客支持通过 GitHub Issue 自动申请友链：

1. 前往 [GitHub Issues](https://github.com/fqzlr/my-blog/issues/new/choose)
2. 选择「友链申请」模板
3. 填写相关信息并提交
4. 审核通过后会自动添加

## 🙏 致谢

本博客基于以下开源项目二次开发：

- [Firefly](https://github.com/CuteLeaf/Firefly) - 博客主题模板
- [Astro](https://astro.build) - 静态站点生成框架
- [Tailwind CSS](https://tailwindcss.com) - CSS 框架
- [Svelte](https://svelte.dev) - 组件框架
- [Iconify](https://iconify.design) - 图标库

最初基于 [CuteLeaf/Firefly](https://github.com/CuteLeaf/Firefly)，该项目是从 [saicaca/fuwari](https://github.com/saicaca/fuwari) fork 而来。感谢所有原始贡献者的宝贵工作。

### 技术栈

- Astro 6.x
- Tailwind CSS 4.x
- Svelte 5.x
- TypeScript
- Pagefind（搜索）
- Swup（页面过渡）
- Waline（评论）
- Fancyapps（图片灯箱）
- KaTeX（数学公式）
- Expressive Code（代码高亮）

## 📝 许可协议

本项目遵循 [MIT license](https://mit-license.org/) 开源协议，详细查看 [LICENSE](./LICENSE) 文件。

**版权声明：**
- Copyright (c) 2024 [saicaca](https://github.com/saicaca) - [fuwari](https://github.com/saicaca/fuwari)
- Copyright (c) 2025 [CuteLeaf](https://github.com/CuteLeaf) - [Firefly](https://github.com/CuteLeaf/Firefly)
- Copyright (c) 2026 [Fqzlr](https://fqzlr.com) - 个人博客二次开发

根据 MIT 开源协议，你可以自由使用、修改、分发代码，但需保留上述版权声明。
