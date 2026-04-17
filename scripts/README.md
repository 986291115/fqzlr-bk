# 同步脚本使用说明

## 功能
将 Obsidian 笔记库中的笔记同步到博客项目的 content 文件夹中。

## 配置

1. 复制 `sync.config.example.js` 为 `sync.config.js`
2. 修改配置文件中的路径：
   - `obsidianVaultPath`: 你的 Obsidian 笔记库路径
   - `projectContentPath`: 博客项目的 content 文件夹路径（通常是 `src/content`）

## 使用方法

```bash
# 进入 scripts 目录
cd scripts

# 运行同步脚本
node sync.js
```

## 同步选项

脚本提供以下同步选项：
1. **同步文章** - 同步到 `posts/` 文件夹
2. **同步动态** - 同步到 `moments/` 文件夹
3. **同步记录** - 同步到 `life/` 文件夹及其子文件夹
4. **同步生活** - 同步到 `life/` 文件夹（同"同步记录"）
5. **同步全部** - 同步所有类型的内容
6. **退出**

## 文件命名规则

脚本会根据 frontmatter 中的 `published` 字段自动重命名文件：
- moments: `YYYY-MM-DD.md`
- posts: 保留原文件名或使用 title 生成

## 注意事项

- 确保 Obsidian 笔记包含正确的 frontmatter 元数据
- moments 类型的笔记需要 `published` 字段（日期格式：YYYY-MM-DD）
- 重复的文件会被跳过（基于文件路径和修改时间）
