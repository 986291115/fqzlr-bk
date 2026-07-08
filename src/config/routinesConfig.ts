/**
 * 日常规划页面配置
 * 用于管理日常规划展示的内容
 */

// 日常规划项类型定义
export interface RoutineItem {
	id: string;
	name: string;
	time: string;
	icon: string;
	color: string;
	description: string;
	body: string;
	updatedAt: string;
	order: number;
	enabled: boolean;
}

// 日常规划页面配置
export interface RoutinePageConfig {
	title?: string;
	description?: string;
}

// 日常规划页面配置
export const routinePageConfig: RoutinePageConfig = {
	title: "日常规划",
	description: "记录和规划生活中的各项事务",
};

// 日常规划列表配置
export const routinesConfig: RoutineItem[] = [
	{
		id: "daily-schedule",
		name: "每日时间规划表",
		time: "全天",
		icon: "✊️",
		color: "#22c55e",
		description: "2026年10月1日之前",
		body: `| 时间段           | 每日固定安排                           |
| ------------- | -------------------------------- |
| 7:30⏰         | 准时起床，饮用一杯咖啡☕，去外面买两个鸡蛋🥚吃（回教室吃）   |
| 晨间上课前📚       | 提前到教室，选一个可以自己学习的座位               |
| 白天无课时（18点前）📖 | 没课的时候白天不在宿舍（6点之前）                |
| 11:20🍱       | 中午11.20点外卖，回宿舍吃饭                 |
| 午间饭后😴        | 吃完饭直接离开宿舍，困的话在教室睡会，订半个小时闹钟       |
| 18:00后🏠      | 6点以后回宿舍吃饭和宝宝打视频💞                |
| 20:30🧹       | 8.30应该能结束，洗漱，洗衣服，跑步🏃            |
| 21:30～23:00📝 | 9.30开始整理今天的笔记（一个半小时足够）           |
| 23:00后🇬🇧    | 11点学会英语（一边学一边做笔记分块完成）            |
| 日常自律约束🚫      | 不刷抖音了，吃饭的时候不看动漫的话可以看会，吃完饭不能拖延继续看 |`,
		updatedAt: "2026-04-26",
		order: 1,
		enabled: true,
	},
	{
		id: "noon-rest",
		name: "午间小憩",
		time: "中午 12:00-13:00",
		icon: "😴",
		color: "#a855f7",
		description: "午餐后短暂休息，恢复精力",
		body: `## 目标

通过短暂的午休，保持下午的工作和学习效率。

## 具体安排

1. **12:00-12:10** 午餐时间，细嚼慢咽
2. **12:10-12:15** 轻微活动，散步 5 分钟
3. **12:15-12:35** 小憩 20 分钟（设定闹钟）
4. **12:35-12:40** 清醒醒脑，做几个深呼吸

## 注意事项

> 午睡时间不宜过长，20-30 分钟最佳，避免进入深度睡眠后反而更困。

- 避免在电脑前睡觉
- 保持环境安静、光线暗淡
- 醒来后喝一杯温水`,
		updatedAt: "2026-04-18",
		order: 2,
		enabled: true,
	},
];

// 获取所有日常规划（按 order 排序，相同 order 按 updatedAt 倒序）
export function getAllRoutines(): RoutineItem[] {
	return [...routinesConfig].sort((a, b) => {
		if (a.order !== b.order) return a.order - b.order;
		return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
	});
}

// 获取启用的日常规划
export function getEnabledRoutines(): RoutineItem[] {
	return getAllRoutines().filter((r) => r.enabled !== false);
}
