/**
 * 更新日志配置
 * 用于管理网站更新日志内容
 */

export type ChangelogType = "feature" | "improvement" | "fix" | "removal";

export interface ChangelogItem {
	id: string;
	version: string;
	date: string;
	time?: string;
	type: ChangelogType;
	description: string;
	body?: string;
	enabled?: boolean;
}

export interface ChangelogPageConfig {
	title?: string;
	description?: string;
}

export const changelogPageConfig: ChangelogPageConfig = {
	title: "更新日志",
	description: "记录网站的每一次迭代与成长",
};

export const changelogConfig: ChangelogItem[] = [
	{
		id: "2026-07-05-v1-0-0",
		version: "v1.0.0",
		date: "2026-07-05",
		time: "22:00",
		type: "feature",
		description: "博客迁移，及前台页面更新",
		body: "",
		enabled: true,
	},
];

export function getEnabledChangelog(): ChangelogItem[] {
	const enabled = changelogConfig.filter((c) => c.enabled !== false);
	return enabled.sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);
}
