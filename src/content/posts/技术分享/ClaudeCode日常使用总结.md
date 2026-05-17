---
title: Claude Code 命令笔记
published: 2026-05-17
category: 技术分享
tags:
  - AI
  - 工具
  - Claude Code
image: "api"
description: "Claude Code 常用命令和操作备忘，随用随记。"
descriptionSource: ai
---

日常使用中记下来的命令和操作，方便查阅。

## 安装

```bash
npm install -g @anthropic-ai/claude-code
```

## 启动 / 退出

```bash
claude              # 在项目目录下启动交互模式
claude -p "一句话"   # 非交互模式，直接执行一句话然后退出
claude --resume      # 恢复上次会话
Ctrl + C             # 退出 / 中断当前操作
Ctrl + D             # 发送 EOF，退出
```

## 对话中的斜杠命令

```bash
/help               # 查看所有可用命令
/clear              # 清空当前对话上下文
/compact            # 压缩上下文（对话太长时用，释放窗口）
/doctor             # 检查环境配置是否正常
/status             # 查看当前会话状态
/cost               # 查看本次会话 Token 用量和费用
```

## 配置相关

```bash
/config             # 打开配置界面
/model              # 切换模型（opus / sonnet / haiku）
/theme              # 切换终端主题
/output-style       # 调整输出风格
/init               # 初始化项目，生成 CLAUDE.md 描述文件
```

## 权限和安全

```bash
/permissions        # 管理工具权限（允许 / 拒绝特定操作）
/login              # 登录 Anthropic 账号
/logout             # 登出
```

## Git / PR

```bash
/review             # 审查当前的 PR
/security-review    # 安全审查当前分支的变更
```

## 工作区

```bash
/add-dir            # 添加额外的工作目录
/ide                # IDE 集成相关
```

## Skill 技能

Skill 是 Claude Code 内置的专项功能模块，输入 `/技能名` 就能调用。每个技能有特定的用途，相当于请了个临时专家来帮忙。

### 代码相关

```bash
/init               # 初始化项目 CLAUDE.md，自动分析代码库并生成文档让 Claude 更懂项目
/review             # 审查 PR，检查代码质量、潜在问题和改进建议
/security-review    # 安全审查，检查当前分支变更中的安全漏洞和风险
/simplify           # 审查已修改代码的可复用性、质量和效率，给出优化建议
```

### 配置相关

```bash
/update-config      # 修改 settings.json 配置（权限、环境变量、钩子等）
/keybindings-help   # 自定义键盘快捷键
/fewer-permission-prompts  # 分析操作记录，自动添加常用工具到权限白名单，减少弹窗
```

### 自动化

```bash
/loop               # 定时循环执行某个命令，适合轮询部署状态、监控等重复任务
                    # 用法：/loop 5m /review        （每5分钟审查一次PR）
                    # 用法：/loop 10m "查看构建状态"  （每10分钟检查构建）
```

### API 开发

```bash
/claude-api         # Anthropic SDK / API 开发助手，帮你写、调试、优化 API 调用代码
                    # 支持 prompt caching、tool use、streaming 等特性的接入和调试
```

## 对话中的操作

```bash
# 引用文件
直接拖文件到终端，或者输入文件路径

# 多行输入
Ctrl + Enter        # 换行（输入多行内容）
Enter               # 发送消息
Esc                 # 取消当前输入

# 历史消息
↑ / ↓               # 浏览历史输入
```

## 常用 CLI 参数

```bash
claude --help                       # 查看所有 CLI 参数
claude --version                    # 查看版本
claude -p "帮我看看这个bug"          # 单次执行，输出结果后退出
claude --continue                   # 继续上一次的会话
claude --model sonnet               # 指定模型启动
claude --verbose                    # 详细输出模式
claude --dangerously-skip-permissions  # 跳过权限确认（慎用）
```

## 基本使用方式

```
# 让它读代码、解释逻辑
帮我看看这个项目的封面图是怎么获取的

# 让它改代码
把封面图随机逻辑改成按日期选，同一天刷新不换图

# 让它处理配置
保留这些编号，其他的删掉：11、13、14、15、17、18...

# 排查问题（先分析不动手）
音乐播放器歌词滚动为什么不会自动定位到当前行？先分析，别急着改

# 重构 / 整理
把封面图配置里多余的 URL 删掉，只留我指定的这些
```

## 改完代码后的操作

```bash
# 看具体改了什么
git diff

# 撤回某个文件的修改
git checkout -- <文件名>

# 撤回所有未暂存的修改
git checkout -- .

# 看改了哪些文件
git status
```

## 记几个关键点

- 说清楚**哪个页面、什么现象、想要什么效果**，不然它猜不准
- 不确定怎么改的时候，让它先分析、给方案，确认了再说"动手改"
- 一次别说太多需求，拆开一步一步来
- 改完就跑 `git diff` 看看动了什么
- 它改的东西自己要验证，不能全信
- 对话太长了上下文会压缩，觉得它变蠢了就 `/clear` 重来
