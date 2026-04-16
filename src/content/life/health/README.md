# 健康记录

记录运动、睡眠和饮食数据，帮助追踪健康习惯。

## 数据存放

- 运动记录：`src/content/life/health/workout/`
- 睡眠记录：`src/content/life/health/sleep/`
- 饮食记录：`src/content/life/health/food/`

## 运动记录格式

在 `workout/` 下新建 md 文件：

```yaml
---
date: "2026-04-15"          # 运动日期（必填）
workoutType: "跑步"          # 运动类型（选填）
runKm: 5.2                   # 跑步公里数（选填）
workoutMinutes: 30           # 运动时长，分钟（选填）
stepsToday: 10000            # 当天步数（选填）
---
```

## 睡眠记录格式

在 `sleep/` 下新建 md 文件：

```yaml
---
date: "2026-04-15"          # 记录日期（必填）
sleepHours: 7.5             # 睡眠时长，小时（选填）
sleepQuality: 4             # 睡眠质量，1-5分（选填，默认3）
---
```

## 饮食记录格式

在 `food/` 下新建 md 文件：

```yaml
---
date: "2026-04-15"          # 记录日期（必填）
allowedFoods:               # 今天可以吃的食物（选填）
  - "蔬菜"
  - "水果"
avoidFoods:                 # 今天戒口的食物（选填）
  - "奶茶"
  - "炸鸡"
---
```

## 数据展示

- 健康页面顶部显示当月/今年/累计统计数据
- 运动记录按日期倒序展示，显示跑步公里数、运动时长和步数
- 睡眠记录显示睡眠时长和质量评分
- 饮食记录展示能吃和戒口的食物分类
