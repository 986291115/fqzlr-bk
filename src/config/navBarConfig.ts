import {
	LinkPreset,
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/config";
import { siteConfig } from "./siteConfig";

// 根据页面开关动态生成导航栏配置
const getDynamicNavBarConfig = (): NavBarConfig => {
	// 基础导航栏链接
	const links: (NavBarLink | LinkPreset)[] = [
		// 主页
		LinkPreset.Home,

		// 归档
		LinkPreset.Archive,

		// 项目推荐
		{
			name: "常用网站",
			url: "/projects/",
			icon: "material-symbols:star",
		},
	];

	// 动态
	links.push({
		name: "动态",
		url: "/moments/",
		icon: "material-symbols:local-cafe",
	});

	// 生活 (原本的番组计划)
	if (siteConfig.pages.bangumi) {
		links.push({
			name: "记录",
			url: "/bangumi/",
			icon: "material-symbols:camera-outdoor",
		});
	}

	// 新生活功能页 - 放在记录后面、我的网站前面
	// 找到记录所在的索引，在其后插入生活
	const lifeLink = {
		name: "生活",
		url: "/life/",
		icon: "material-symbols:favorite",
		children: [
			{
				name: "总览",
				url: "/life/",
				icon: "material-symbols:home-outline",
			},
			{
				name: "健康",
				url: "/life/health/",
				icon: "material-symbols:favorite-outline",
			},
			{
				name: "想法",
				url: "/life/ideas/",
				icon: "material-symbols:lightbulb-outline",
			},
			{
				name: "地点",
				url: "/life/places/",
				icon: "material-symbols:location-on-outline",
			},
			{
				name: "计划",
				url: "/life/plans/",
				icon: "material-symbols:check-circle-outline",
			},
			{
				name: "笔记本",
				url: "/life/notebooks/",
				icon: "material-symbols:book-outline",
			},
		],
	};

	// 找到记录(link)的索引，在其后插入生活
	const recordIndex = links.findIndex((link) => typeof link !== 'number' && link.name === "记录");
	if (recordIndex !== -1) {
		links.splice(recordIndex + 1, 0, lifeLink);
	} else {
		links.push(lifeLink);
	}

	// 我的网站
	links.push({
		name: "我的网站",
		url: "#",
		icon: "material-symbols:public",
		children: [
			{
				name: "跑步步数",
				url: "https://ze.tsh520.cn/",
				external: true,
				icon: "material-symbols:directions-run",
			},
			{
				name: "临时邮箱",
				url: "https://email.0824.uk/",
				external: true,
				icon: "material-symbols:mail",
			},
			{
				name: "评论管理",
				url: "https://co.tsh520.cn/",
				external: true,
				icon: "material-symbols:comment",
			},
		],
	});

	// 关于及其子菜单
	links.push({
		name: "关于",
		url: "/content/",
		icon: "material-symbols:info",
		children: [
			// 关于页面
			LinkPreset.About,

			// 友链
			LinkPreset.Friends,

			// 留言板
			...(siteConfig.pages.guestbook ? [LinkPreset.Guestbook] : []),

			// 赞助
			...(siteConfig.pages.sponsor ? [LinkPreset.Sponsor] : []),
		],
	});

	// 仅返回链接，其它导航搜索相关配置在模块顶层常量中独立导出
	return { links } as NavBarConfig;
};

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

export const navBarConfig: NavBarConfig = getDynamicNavBarConfig();
