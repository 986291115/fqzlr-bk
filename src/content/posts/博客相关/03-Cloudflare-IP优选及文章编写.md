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
slug: cloudflare-ip-optimize-and-writing
category: 教程
draft: false
pinned: false
author: fqzlr
---

<iframe width="100%" height="468"
  src="//player.bilibili.com/player.html?bvid=BV1Hk9fBTE6H&p=1&autoplay=0"
  scrolling="no" border="0" frameborder="no"
  framespacing="0" allowfullscreen="true">
</iframe>

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

博客部署好了，接下来就是写文章。Firefly 用 Markdown（`.md`）或 MDX（`.mdx`）格式，功能很丰富。

### 文章放哪

所有文章放在 `src/content/posts/` 目录下，可以建子目录来组织。图片等资源放在同目录或 `src/assets/` 下。文件名建议用英文连字符格式（如 `cloudflare-ip-optimize.md`），避免中文路径问题。

### Frontmatter 必须写

每篇文章顶部用 `---` 包裹 YAML 元数据：

```yaml
---
title: "文章标题"           # 必填
published: 2026-05-03       # 必填，发布日期
updated: 2026-05-04         # 可选，更新日期
description: "文章简介"      # 可选，首页卡片显示
image:                      # 可选，封面图（相对路径/网络链接/随机图API都行）
tags:
  - 标签1
  - 标签2
category: 分类名             # 可选
draft: false                # true 则隐藏不显示
pinned: false               # true 则置顶
slug: my-custom-url         # 可选，自定义URL路径
author: 作者名               # 可选
comment: true               # 可选，是否开启评论
---
```

各字段说明：

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 文章标题 |
| `published` | 是 | 发布日期，格式 `YYYY-MM-DD` |
| `updated` | 否 | 更新日期 |
| `description` | 否 | 首页卡片显示的简介 |
| `image` | 否 | 封面图，支持相对路径、绝对路径、网络链接、随机图 API |
| `tags` | 否 | 标签列表 |
| `category` | 否 | 分类 |
| `draft` | 否 | `true` 为草稿不显示，`false` 正式发布 |
| `pinned` | 否 | `true` 置顶显示 |
| `slug` | 否 | 自定义 URL 路径，建议英文连字符 |
| `author` | 否 | 作者名 |
| `comment` | 否 | 是否开启评论，默认 true |
| `licenseName` | 否 | 许可证名称（如 CC BY-NC-SA 4.0） |
| `password` | 否 | 文章密码，设置后需输入密码才能查看 |

### 数学公式（KaTeX）

主题内置 KaTeX，直接用就行。

行内公式用单 `$`：`$E = mc^2$`

块级公式用双 `$$`：

```
$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
```

### Mermaid 图表

用 `mermaid` 代码块即可渲染各种图表：

````
```mermaid
graph TD
    A[开始] --> B{条件}
    B -->|是| C[执行]
    B -->|否| D[结束]
```
````

还支持时序图、甘特图、饼图、类图、状态图等。

### 提醒框

用 GitHub 风格的语法，很直观：

```markdown
> [!NOTE]
> 普通提示

> [!TIP]
> 小技巧

> [!WARNING]
> 注意

> [!CAUTION]
> 危险操作
```

### 嵌入视频

直接粘贴 iframe：

```html
<iframe src="//player.bilibili.com/player.html?bvid=BV1xxxxx"
  scrolling="no" border="0" frameborder="no"
  framespacing="0" allowfullscreen="true">
</iframe>
```

### GitHub 仓库卡片

```markdown
::github{repo="CuteLeaf/Firefly"}
```

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

> 官方文档：[docs-firefly.cuteleaf.cn/zh/guide/writing](https://docs-firefly.cuteleaf.cn/zh/guide/writing.html)
>
> 文字版：[fqzlr.com/posts/blog/ip](https://fqzlr.com/posts/blog/ip/)
>
> 视频链接：[BV1Hk9fBTE6H](https://www.bilibili.com/video/BV1Hk9fBTE6H)
