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
		repo: "your-username/your-repo",
		// Issue 标签（可选）
		labels: ["friend-link"],
	},

	// 本站信息（用于在申请指南中展示）
	siteInfo: {
		name: "小饺子和小蛋糕的博客",
		desc: "记录生活与技术的个人博客",
		url: "https://example.com",
		avatar: "https://example.com/avatar.png",
	},

	// 注意事项
	notes: [
		{
			title: "网站要求",
			content: "网站内容健康，无违法违规内容，且已正常运营一段时间",
		},
		{
			title: "友链形式",
			content: "首页友链或内页友链均可，互相尊重",
		},
		{
			title: "失效处理",
			content: "如发现网站无法访问或内容违规，将有权移除友链",
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
