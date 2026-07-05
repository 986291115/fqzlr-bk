import type { FriendsPageConfig } from "../types/config";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	// 显示列数：2列或3列
	columns: 2,

	// 是否开启友链申请
	applyLink: true,

	// GitHub Issue 申请友链配置
	githubIssue: {
		// GitHub 仓库地址（格式：owner/repo）
		repo: "fqzlr/fqzlr-bk",
		// Issue 标签（可选）
		labels: ["friend-link"],
	},

	// 本站信息（用于在申请指南中展示）
	siteInfo: {
		name: "fqzlr",
		desc: "躬身入局，心为主理，行有尺度，自持本心",
		url: "https://fqzlr.com",
		avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
	},

	// 注意事项
	notes: [
		{
			title: "互换原则",
			content: "请先将本站添加到您的友链页面，确认后会添加您的友链",
		},
		{
			title: "链接维护",
			content: "友链网站长期无法访问或内容违规，将会被移除",
		},
		{
			title: "内容要求",
			content: "内容积极向上，不含有任何含色情/反动/暴力等违法违规内容",
		},
		{
			title: "站点要求",
			content: "支持 HTTPS，以原创内容为主，能够正常访问且有持续更新",
		},
	],
};

// 提示：友链数据已迁移到 src/content/friends/ 目录下
// 每个 .md 文件代表一个友链，通过 frontmatter 配置：
// - title: 友链标题
// - imgurl: 头像图片URL
// - desc: 友链描述
// - siteurl: 友链地址
// - tags: 标签数组（可选）
// - weight: 权重，数字越大排序越靠前（可选，默认0）
// - enabled: 是否启用（可选，默认true）
