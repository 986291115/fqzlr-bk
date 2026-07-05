# 博客数据迁移计划

## 概述

将旧网站（`my-blog`）的个人信息、网站信息、文章、友链、相册等数据迁移到当前模板项目（`dumplingandcakeblog`）中，**保留当前模板的所有样式和功能风格不变**。

## 研究结论

两个项目基于同一套框架（Firefly/Astro），目录结构和配置方式高度相似：

- 配置文件都在 `src/config/` 目录下
- 内容都在 `src/content/` 目录下
- 静态资源都在 `public/` 和 `src/assets/` 目录下

**数据迁移方式**：通过复制/替换配置文件和内容文件来实现，不修改任何组件、样式和功能代码。

## 迁移内容清单

### 1. 站点配置（siteConfig.ts）
- **源文件**：`my-blog/src/config/siteConfig.ts`
- **目标文件**：`dumplingandcakeblog/src/config/siteConfig.ts`
- **迁移内容**：
  - 站点标题、副标题、URL、描述、关键词
  - 主题色配置
  - 导航栏配置（logo、标题等）
  - 站点开始日期、时区
  - 上下班时间配置
  - 页面开关配置
  - 说说封面配置
  - 文章列表布局配置
  - 分页配置
  - 统计分析配置
  - 热力图配置
  - 图像优化配置
  - 备案号配置

### 2. 个人资料配置（profileConfig.ts）
- **源文件**：`my-blog/src/config/profileConfig.ts`
- **目标文件**：`dumplingandcakeblog/src/config/profileConfig.ts`
- **迁移内容**：
  - 头像、下班头像
  - 名字、展示名、徽章
  - 职业标签
  - 个人签名
  - 社交链接（QQ群、B站、GitHub、Email、RSS等）

### 3. 友链配置（friendsConfig.ts）
- **源文件**：`my-blog/src/config/friendsConfig.ts`
- **目标文件**：`dumplingandcakeblog/src/config/friendsConfig.ts`
- **迁移内容**：
  - 友链页面配置（标题、描述、申请链接、站点信息、注意事项）
  - 全部友链数据

### 4. 赞助配置（sponsorConfig.ts）
- **源文件**：`my-blog/src/config/sponsorConfig.ts`
- **目标文件**：`dumplingandcakeblog/src/config/sponsorConfig.ts`
- **迁移内容**：
  - 赞助标题、描述
  - 赞助方式（爱发电、微信、支付宝）
  - 赞助者列表

### 5. 文章内容（posts）
- **源目录**：`my-blog/src/content/posts/`
- **目标目录**：`dumplingandcakeblog/src/content/posts/`
- **迁移方式**：复制整个 `posts` 目录，覆盖目标目录

### 6. 相册数据
**注意：两个项目的相册实现方式不同！**
- **旧网站**：通过 `galleryConfig.ts` 配置 + `public/gallery/` 图片
- **新网站**：通过 `src/content/album/` content collection 管理

**迁移方案**：
1. 将 `public/gallery/` 图片复制到新网站的 `public/gallery/`
2. 将 `galleryConfig.ts` 中的相册配置转换为 `src/content/album/` 下的 Markdown 文件
3. 每个相册生成一个 `.md` 文件，包含 title、date、location、tags、photos 等字段

### 7. 静态资源
- **头像图片**：`my-blog/src/assets/images/` → `dumplingandcakeblog/src/assets/images/`
  - `avatar.gif`、`avatar.webp`、`shangban.png`、`xiaban.gif` 等
- **赞助二维码**：`my-blog/public/assets/images/` → `dumplingandcakeblog/public/assets/images/`
  - `wechat.png`、`alipay.png` 等
- **Favicon**：`my-blog/public/favicon/` → `dumplingandcakeblog/public/favicon/`
- **相册图片**：`my-blog/public/gallery/` → `dumplingandcakeblog/public/gallery/`

### 8. 其他内容（可选，待确认）
以下内容是否需要迁移，请用户确认：
- 番剧数据（bangumi）：电影、书籍、游戏、音乐
- 说说（moments）
- 日常规划（routines）
- 旅行足迹（places）
- 笔记本（notebooks）
- 更新日志（changelog）
- 日历（calendar）
- 关于页面（about.md）
- 友链自定义内容（friends.mdx）
- 留言板（guestbook.md）
- 导航栏配置（navBarConfig.ts）
- 侧边栏配置（sidebarConfig.ts）
- 页脚配置（footerConfig.ts）
- 评论系统配置（commentConfig.ts）
- 背景壁纸配置（backgroundWallpaper.ts）
- Pio 配置（pioConfig.ts）

## 执行步骤

1. **备份当前项目**：建议用户先备份当前模板项目
2. **配置文件迁移**：替换 siteConfig.ts、profileConfig.ts、friendsConfig.ts、sponsorConfig.ts
3. **静态资源迁移**：复制头像、二维码、favicon、相册图片
4. **文章内容迁移**：复制 posts 目录
5. **相册数据转换**：将 galleryConfig 转换为 album content collection
6. **验证构建**：运行 `npm run build` 验证项目是否能正常构建
7. **本地预览**：启动开发服务器检查效果

## 风险与注意事项

1. **样式保持不变**：只迁移数据和配置，不修改任何组件、样式文件
2. **配置兼容性**：两个项目的配置类型定义可能略有差异，需要检查类型匹配
3. **图片路径**：确保迁移后的图片路径与配置中的引用一致
4. **相册格式转换**：旧网站用配置文件，新网站用 content collection，需要格式转换
5. **备份**：建议迁移前备份当前项目

## 需要用户确认

1. 上述第 8 项中的"其他内容"哪些需要迁移？
2. 相册数据是否需要完整迁移？
3. 是否需要先备份当前项目？
