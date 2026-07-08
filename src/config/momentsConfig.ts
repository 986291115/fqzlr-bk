/**
 * 说说/动态页面配置
 * 用于管理首页说说展示的内容
 */

// 说说项类型定义
export interface MomentItem {
	id: string;
	author: string;
	avatar?: string;
	pinned: boolean;
	published: string;
	images: string[];
	tags: string[];
	location?: string;
	device?: string;
	body: string;
	enabled?: boolean;
}

// 说说封面配置
export interface MomentsCover {
	cover_image: string;
	cover_avatar: string;
	cover_name: string;
	cover_bio: string;
}

// 说说页面配置
export interface MomentsPageConfig {
	title?: string;
	description?: string;
	showComment?: boolean;
	randomizeSort?: boolean;
}

// 说说封面配置
export const momentsCover: MomentsCover = {
	cover_image: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
	cover_avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
	cover_name: "番茄主理人",
	cover_bio: "躬身入局，心为主理，行有尺度，自持本心.",
};

// 说说列表配置
export const momentsConfig: MomentItem[] = [
	{
		id: "2026-07-06-ceshi2",
		author: "番茄主理人",
		pinned: true,
		published: "2026-07-06",
		location: "杭州",
		images: [
			"https://tu.fqzlr.com/file/beijing/1777365393328_bkg__7_.png",
		],
		tags: ["测试"],
		body: `**测试** 
## 测试
---
测试
- 测试`,
		enabled: true,
	},
	{
		id: "2026-07-06-ceshi",
		author: "fqzlr",
		pinned: true,
		published: "2026-07-06",
		location: "中国",
		images: [
			"https://tu.fqzlr.com/file/beijing/1777266325757_bk4__1_.webp",
		],
		tags: ["测试"],
		body: `测试`,
		enabled: true,
	},
	{
		id: "2026-05-10-xiangfa",
		author: "fqzlr",
		avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
		pinned: false,
		published: "2026-05-10",
		location: "河南-郑州",
		images: [],
		tags: ["想法"],
		body: `笔记命名就是title属性

其他采用功能属性+日期的方式`,
		enabled: true,
	},
];

// 说说页面配置
export const momentsPageConfig: MomentsPageConfig = {
	title: "动态",
	description: "记录生活中的点点滴滴",
	showComment: true,
	randomizeSort: false,
};

// 获取启用的说说（按时间倒序，置顶优先）
export function getEnabledMoments(): MomentItem[] {
	const enabled = momentsConfig.filter((m) => m.enabled !== false);
	const pinned = enabled
		.filter((m) => m.pinned)
		.sort(
			(a, b) =>
				new Date(b.published).getTime() - new Date(a.published).getTime(),
		);
	const normal = enabled
		.filter((m) => !m.pinned)
		.sort(
			(a, b) =>
				new Date(b.published).getTime() - new Date(a.published).getTime(),
		);
	return [...pinned, ...normal];
}
