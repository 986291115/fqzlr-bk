import type { ProfileConfig } from "../types/config";

export const profileConfig: ProfileConfig = {
	// ============================================================
	// 头像设置
	// ============================================================
	// 图片路径支持三种格式：
	// 1. public 目录（以 "/" 开头，不优化）："/assets/images/avatar.webp"
	// 2. src 目录（不以 "/"开头，自动优化但会增加构建时间，推荐）："assets/images/avatar.webp"
	// 3. 远程 URL："https://example.com/avatar.jpg"
	avatar: "assets/images/shangban.png",

	// 下班时间头像（为空则始终使用上方 avatar）
	avatarOffWork: "assets/images/xiaban.gif",

	name: "Fqzlr", // 名字

	// 首页展示名字（留空则使用 name）
	displayName: "Fqzlrの博客",

	// 职业/身份标签
	occupation: "[啥都不会 / 无技术博主]",

	// ============================================================
	// 个人签名设置
	// ============================================================
	// 支持多条，会循环打字+删除效果
	bio: ["躬身入局，心为主理，行有尺度，自持本心."],

	// ============================================================
	// 链接配置
	// 已预装图标集：fa7-brands、fa7-regular、fa7-solid、material-symbols、simple-icons
	// 访问 https://icones.js.org/ 获取图标代码
	// 如需使用未预装的图标集，执行：pnpm add @iconify-json/<icon-set-name>
	// showName: true 显示图标和名称，false 只显示图标
	// ============================================================
	links: [
		{
			name: "QQ群",
			icon: "simple-icons:tencentqq",
			url: "https://qm.qq.com/q/wrmF4FI9pu",
			showName: false,
		},
		{
			name: "Bilibili",
			icon: "simple-icons:bilibili",
			url: "https://space.bilibili.com/2017273493",
			showName: false,
		},
		{
			name: "GitHub",
			icon: "simple-icons:github",
			url: "https://github.com/fqzlr",
			showName: false,
		},
		{
			name: "Email",
			icon: "material-symbols:mail-outline",
			url: "mailto:fqzlr@outlook.com",
			showName: false,
		},
		{
			name: "RSS",
			icon: "material-symbols:rss-feed",
			url: "/rss/",
			showName: false,
		},
	],

	// ============================================================
	// 首页 Hero 区域配置
	// true = 显示，false = 隐藏
	// ============================================================
	homeHero: {
		// ---------- 头像 ----------
		showAvatar: true, // 左侧圆形头像
		// 头像位置：default=默认（左侧面板里），bottom-left=左下角，bottom-right=右下角
		avatarPosition: "bottom-right",
		showWorkStatus: true, // 头像右下角工作状态徽章（上班中/下班了）

		// ---------- 名字 ----------
		showDisplayName: true, // 首页大标题（配合 displayName 使用）
		showVerticalName: true, // 竖排名字（配合 name 使用）

		// ---------- 职业/身份标签 ----------
		showOccupation: true,

		// ---------- B站徽章 ----------
		showBilibiliBadge: true, // 名字下方 B站徽章
		bilibiliBadgeText: "B站：番茄煮理人",

		// ---------- 个人签名 ----------
		showBio: true,

		// ---------- 胶囊标签 ----------
		showPill: true, // 右上角胶囊标签
		pillText: "BLOG",

		// ---------- 竖排标题 ----------
		showVerticalTitle: true,
		verticalTitle: "博客",

		// ---------- 竖排创意标签 ----------
		showVerticalCreative: true,
		verticalCreative: "CREATIVE",

		// ---------- 底部日文小文字 ----------
		showFooterText: true,
		footerText: "システム起動完了",

		// ---------- 主页右侧角色人物图 ----------
		showCharacter: false,

		// ---------- 右侧磨砂玻璃卡片 ----------
		showArtWindow: false, // 右下角透明玻璃矩形框

		// ---------- 角色对话气泡 ----------
		showSpeech: true,
		speechChinese: "番茄主理人？",
		speechEnglish: "Welcome to my blog, enjoy your stay!",
	},
};
