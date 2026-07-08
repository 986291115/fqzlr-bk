export interface DaohangItem {
	id: string;
	name: string;
	url: string;
	icon: string;
	description: string;
	category: string;
	tags: string[];
	color: string;
	image?: string;
	featured: boolean;
	order: number;
	enabled?: boolean;
}

export interface DaohangPageConfig {
	title?: string;
	description?: string;
	showComment?: boolean;
}

export const daohangPageConfig: DaohangPageConfig = {
	title: "网站导航",
	description: "收录个人网站、常用工具和收藏网站",
	showComment: false,
};

export const daohangConfig: DaohangItem[] = [
	{
		id: "dh-10-cloudflare",
		name: "Cloudflare",
		url: "https://dash.cloudflare.com/",
		icon: "material-symbols:cloud",
		description: "全球CDN与网络安全服务",
		category: "常用网站",
		tags: ["云服务", "CDN"],
		color: "#f97316",
		featured: true,
		order: 10,
		enabled: true,
	},
	{
		id: "dh-20-emoji-dict",
		name: "Emoji词典",
		url: "https://www.emojiall.com/",
		icon: "material-symbols:psychology",
		description: "全面的emoji表情查询工具",
		category: "资源网站",
		tags: ["工具", "emoji"],
		color: "#ec4899",
		featured: false,
		order: 20,
		enabled: true,
	},
	{
		id: "dh-21-anime-skr",
		name: "樱之空动漫",
		url: "https://skr.skr3.cc:666/user/plays.html",
		icon: "material-symbols:movie",
		description: "动漫资源分享平台",
		category: "资源网站",
		tags: ["动漫", "资源"],
		color: "#ec4899",
		featured: false,
		order: 21,
		enabled: true,
	},
	{
		id: "dh-30-image-converter",
		name: "100%多功能图片转换器",
		url: "https://imagestool.com/webp2jpg-online/",
		icon: "material-symbols:image",
		description: "在线图片格式转换工具",
		category: "工具网站",
		tags: ["图片处理", "工具"],
		color: "#10b981",
		featured: false,
		order: 30,
		enabled: true,
	},
	{
		id: "dh-31-font-preview",
		name: "在线本地字体预览",
		url: "https://www.lddgo.net/convert/local-font-preview",
		icon: "material-symbols:format-underlined",
		description: "本地字体在线预览工具",
		category: "工具网站",
		tags: ["字体", "工具"],
		color: "#8b5cf6",
		featured: false,
		order: 31,
		enabled: true,
	},
	{
		id: "dh-32-ping-test",
		name: "在线Ping测试",
		url: "https://www.itdog.cn/",
		icon: "material-symbols:network-check",
		description: "多线路网络延迟测试工具",
		category: "工具网站",
		tags: ["网络", "工具"],
		color: "#3b82f6",
		featured: false,
		order: 32,
		enabled: true,
	},
	{
		id: "dh-33-remove-bg",
		name: "免费在线抠图",
		url: "https://www.koukoutu.com/removebgtool/all",
		icon: "material-symbols:auto-fix-high",
		description: "无需上传的在线图像抠图工具",
		category: "工具网站",
		tags: ["图片处理", "AI"],
		color: "#10b981",
		featured: false,
		order: 33,
		enabled: true,
	},
	{
		id: "dh-34-free-font",
		name: "Free Font 艺术体",
		url: "https://font.ittools.cc/art",
		icon: "material-symbols:text-increase",
		description: "商用免费字体收集",
		category: "工具网站",
		tags: ["字体", "资源"],
		color: "#f59e0b",
		featured: false,
		order: 34,
		enabled: true,
	},
	{
		id: "dh-35-font-freedom",
		name: "释放字体自由",
		url: "https://fonts.zeoseven.com/",
		icon: "material-symbols:text-increase",
		description: "字体资源分享网站",
		category: "工具网站",
		tags: ["字体", "资源"],
		color: "#f59e0b",
		featured: false,
		order: 35,
		enabled: true,
	},
	{
		id: "dh-36-codepen",
		name: "CodePen",
		url: "https://codepen.io/",
		icon: "material-symbols:code-rounded",
		description: "在线前端代码编辑器和社区",
		category: "工具网站",
		tags: ["前端", "代码", "编辑器"],
		color: "#000000",
		featured: false,
		order: 36,
		enabled: true,
	},
	{
		id: "dh-37-uiverse",
		name: "Uiverse",
		url: "https://uiverse.io/",
		icon: "material-symbols:palette-outline",
		description: "开源 UI 组件库，复制即用",
		category: "设计资源",
		tags: ["UI", "组件", "CSS", "开源"],
		color: "#7c3aed",
		featured: false,
		order: 37,
		enabled: true,
	},
	{
		id: "dh-38-react-bits",
		name: "React Bits",
		url: "https://www.reactbits.dev/",
		icon: "fa7-solid:atom",
		description: "React 组件和模式集合",
		category: "开发工具",
		tags: ["React", "组件", "前端"],
		color: "#61dafb",
		featured: false,
		order: 38,
		enabled: true,
	},
	{
		id: "dh-39-skillsmp",
		name: "SkillsMP",
		url: "https://skillsmp.com/zh/",
		icon: "material-symbols:hub-outline",
		description: "技能学习和分享平台",
		category: "学习资源",
		tags: ["学习", "技能", "教程"],
		color: "#10b981",
		featured: false,
		order: 39,
		enabled: true,
	},
	{
		id: "dh-40-fomalhaut",
		name: "Fomalhaut",
		url: "https://www.fomal.cc/",
		icon: "material-symbols:person",
		description: "技术博主个人网站",
		category: "大佬博客",
		tags: ["博客", "技术"],
		color: "#3b82f6",
		featured: true,
		order: 40,
		enabled: true,
	},
	{
		id: "dh-41-haiyong",
		name: "海拥",
		url: "https://blog.haiyong.site/",
		icon: "material-symbols:person",
		description: "前端技术分享博客",
		category: "大佬博客",
		tags: ["博客", "技术"],
		color: "#3b82f6",
		featured: false,
		order: 41,
		enabled: true,
	},
	{
		id: "dh-42-moewah",
		name: "喵斯基部落",
		url: "https://blog.moewah.com/",
		icon: "material-symbols:person",
		description: "运维技术与经验分享",
		category: "大佬博客",
		tags: ["博客", "运维"],
		color: "#8b5cf6",
		featured: false,
		order: 42,
		enabled: true,
	},
	{
		id: "dh-43-xiaomi-mimo",
		name: "小米 MiMo",
		url: "https://platform.xiaomimimo.com/",
		icon: "material-symbols:smart-toy-outline",
		description: "小米 MiMo AI 平台",
		category: "AI 工具",
		tags: ["AI", "小米", "大模型"],
		color: "#ff6900",
		featured: false,
		order: 43,
		enabled: true,
	},
	{
		id: "dh-50-qwerty-learner",
		name: "Qwerty Learner",
		url: "https://qwerty.kaiyi.cool/",
		icon: "material-symbols:keyboard",
		description: "键盘工作者单词记忆软件",
		category: "学习网站",
		tags: ["学习", "工具"],
		color: "#06b6d4",
		featured: false,
		order: 50,
		enabled: true,
	},
	{
		id: "dh-51-mianshiya",
		name: "面试鸭",
		url: "https://www.mianshiya.com/",
		icon: "material-symbols:school",
		description: "程序员面试题库平台",
		category: "学习网站",
		tags: ["面试", "编程"],
		color: "#f59e0b",
		featured: false,
		order: 51,
		enabled: true,
	},
	{
		id: "dh-60-firefly-docs",
		name: "Firefly Docs",
		url: "https://docs-firefly.cuteleaf.cn/zh/",
		icon: "material-symbols:menu-book",
		description: "Firefly项目文档",
		category: "文档",
		tags: ["文档", "工具"],
		color: "#10b981",
		featured: false,
		order: 60,
		enabled: true,
	},
	{
		id: "dh-70-maptiler",
		name: "MapTiler Cloud",
		url: "https://cloud.maptiler.com/maps/",
		icon: "material-symbols:map",
		description: "地图服务与可视化平台",
		category: "其他网站",
		tags: ["地图", "可视化"],
		color: "#3b82f6",
		featured: false,
		order: 70,
		enabled: true,
	},
];

export const categoryOrder: Record<string, number> = {
	"我的网站": 0,
	"常用网站": 1,
	"资源网站": 2,
	"工具网站": 3,
	"大佬博客": 4,
	"学习网站": 5,
	"设计资源": 6,
	"开发工具": 7,
	"学习资源": 8,
	"AI 工具": 9,
	"文档": 10,
	"其他网站": 11,
};

export const categoryIcons: Record<string, string> = {
	"我的网站": "material-symbols:person",
	"常用网站": "material-symbols:star",
	"资源网站": "material-symbols:folder",
	"工具网站": "material-symbols:handyman",
	"大佬博客": "material-symbols:menu-book",
	"学习网站": "material-symbols:school",
	"设计资源": "material-symbols:palette-outline",
	"开发工具": "material-symbols:code-rounded",
	"学习资源": "material-symbols:school",
	"AI 工具": "material-symbols:smart-toy-outline",
	"文档": "material-symbols:description",
	"其他网站": "material-symbols:link",
};

export function getAllDaohang(): DaohangItem[] {
	return [...daohangConfig].sort((a, b) => a.order - b.order);
}

export function getEnabledDaohang(): DaohangItem[] {
	return daohangConfig
		.filter((item) => item.enabled !== false)
		.sort((a, b) => a.order - b.order);
}

export function getDaohangByCategory(category: string): DaohangItem[] {
	return daohangConfig
		.filter((item) => item.enabled !== false && item.category === category)
		.sort((a, b) => a.order - b.order);
}

export function getFeaturedDaohang(): DaohangItem[] {
	return daohangConfig
		.filter((item) => item.enabled !== false && item.featured)
		.sort((a, b) => a.order - b.order);
}

export function getAllCategories(): string[] {
	const categories = new Set(daohangConfig.map((item) => item.category));
	return [...categories].sort(
		(a, b) => (categoryOrder[a] ?? 99) - (categoryOrder[b] ?? 99),
	);
}

export function getEnabledCategories(): string[] {
	const enabled = daohangConfig.filter((item) => item.enabled !== false);
	const categories = new Set(enabled.map((item) => item.category));
	return [...categories].sort(
		(a, b) => (categoryOrder[a] ?? 99) - (categoryOrder[b] ?? 99),
	);
}

export function getCategoryIcon(category: string): string {
	return categoryIcons[category] || "material-symbols:link";
}
