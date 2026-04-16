# 笔记本

成长日记、学习复盘、灵感随笔，按 `_index.md` 同名文件夹组织。

## 数据存放

- 笔记本配置：`src/content/life/notebooks/`
- 成长日记：`src/content/life/notebooks/growth/`
- 学习复盘：`src/content/life/notebooks/study/`
- 灵感随笔：`src/content/life/notebooks/ideas/`

## 创建新的笔记本

1. 在 `notebooks/` 下创建文件夹（如 `reading/`）
2. 在文件夹内创建 `_index.md` 配置文件
3. 在文件夹内创建 md 条目文件

## 笔记本配置格式（_index.md）

```yaml
---
name: "读书笔记"             # 笔记本名称（必填）
cover: "https://example.com/cover.jpg"  # 封面图片 URL（选填）
summary: "记录读过的书籍和读书感悟"  # 笔记本描述（选填）
---
```

## 条目记录格式

在笔记本文件夹内新建 md 文件：

```yaml
---
date: "2026-04-15"          # 记录日期（必填）
---
正文内容在这里书写...
```

## 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| name | 是 | 笔记本名称 |
| cover | 否 | 封面图片 URL |
| summary | 否 | 笔记本描述 |

## 条目字段

| 字段 | 必填 | 说明 |
|------|------|------|
| date | 是 | 记录日期 |

## 数据展示

- 笔记本列表页显示所有笔记本，按最近更新时间排序
- 每个笔记本显示封面、名称、描述、条目数和最近更新日期
- 点击笔记本进入详情页，查看该笔记本下的所有条目
