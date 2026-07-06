/**
 * Astro 内容集合配置文件
 *
 * 功能说明：
 * 1. 定义所有内容集合的数据结构（Schema）
 * 2. 每个集合对应 src/content/ 下的一个目录
 * 3. 使用 Zod 进行数据验证，确保内容格式正确
 * 4. 支持 Markdown、MDX、JSON、YAML 等多种格式
 *
 * 使用方法：
 * - 新增内容：在对应目录下创建 .md/.mdx/.json 文件，按照 schema 定义填写 frontmatter
 * - 修改 schema：在对应集合的 schema 中添加/删除字段，需同步更新内容文件
 * - 新增集合：复制一个集合定义，修改名称、路径和 schema，然后在底部 collections 对象中注册
 *
 * 集合说明：
 * - posts:       博客文章（核心内容）
 * - spec:        特殊页面（关于、友链、留言板等页面的自定义内容）
 * - moments:     说说/动态（类似朋友圈的短内容）
 * - bangumi:     番组计划（动漫、书籍、游戏、音乐收藏）
 * - life:        生活记录（规划、足迹等）
 * - notebooks:   笔记本（日记、随笔等）
 * - routines:    日常规划（作息时间表）
 * - album:       相册（图片集合）
 * - daohang:     导航（网址导航）
 * - ziyuan:      资源（公告、名言等）
 * - friends:     友情链接
 * - changelog:   更新日志
 * - danmu:       弹幕
 */

import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// ============================================================================
// 博客文章集合 - 网站核心内容
// 目录：src/content/posts/
// ============================================================================
const postsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),
		pinned: z.boolean().optional().default(false),
		author: z.string().optional().default(""),
		sourceLink: z.string().optional().default(""),
		licenseName: z.string().optional().default(""),
		licenseUrl: z.string().optional().default(""),
		comment: z.boolean().optional().default(true),
		order: z.number().optional().default(0),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});

// ============================================================================
// 特殊页面集合 - 关于、友链、留言板等页面的自定义内容
// 目录：src/content/spec/
// 说明：这些页面的主要内容由组件渲染，此集合用于补充自定义内容
// ============================================================================
const specCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" }),
	schema: z.object({}),
});

// ============================================================================
// 说说/动态集合 - 类似朋友圈的短内容发布
// 目录：src/content/moments/
// 支持图片、标签、定位、设备信息等
// ============================================================================
const momentsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/moments" }),
	schema: ({ image }) =>
		z.object({
			author: z.string().optional().default(""),
			avatar: z.string().optional().default(""),
			pinned: z.boolean().optional().default(false),
			published: z.date(),
			images: z
				.array(image().or(z.string()))
				.or(z.string())
				.optional()
				.default([]),
			tags: z.array(z.string()).optional().default([]),
			location: z.string().optional().default(""),
			device: z.string().optional().default(""),
			// Cover settings (used by _cover.md only)
			cover_image: z.string().optional().default(""),
			cover_avatar: z.string().optional().default(""),
			cover_name: z.string().optional().default(""),
			cover_bio: z.string().optional().default(""),
		}),
});

// ============================================================================
// 番组计划集合 - 动漫、书籍、游戏、音乐收藏管理
// 目录：src/content/bangumi/
// 分类：anime(动漫), book(书籍), game(游戏), music(音乐), real(影视)
// 状态：1=想看, 2=看过, 3=在看, 4=搁置, 5=抛弃
// ============================================================================
const bangumiCollection = defineCollection({
	loader: glob({
		pattern: "**/*.{md,mdx,yaml,yml}",
		base: "./src/content/bangumi",
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			name_cn: z.string().optional(),
			category: z
				.enum(["book", "anime", "music", "game", "real"])
				.default("anime"),
			subcategory: z.enum(["movie", "tv", "anime", "documentary"]).optional(),
			status: z.number().min(1).max(5).default(2), // 1: 想看, 2: 看过, 3: 在看, 4: 搁置, 5: 抛弃
			image: image().or(z.string()),
			link: z.string().optional(), // 对应文章的链接；为空时自动从文件路径推导
			score: z.number().min(0).max(10).optional(),
			comment: z.string().optional(),
			tags: z.array(z.string()).optional().default([]),
			published: z.date().optional(),
			// Music-specific fields
			artist: z.string().optional(),
			audioUrl: z.string().optional(),
			lrcUrl: z.string().optional(),
			metingServer: z.string().optional(),
			metingId: z.string().optional(),
		}),
});

// ============================================================================
// 生活记录集合 - 足迹、规划等生活相关内容
// 目录：src/content/life/
// 包含：places(足迹), routines(日常规划) 等子目录
// ============================================================================
const lifeCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/life" }),
	schema: z.object({
		label: z.string().optional().default(""),
		value: z.string().optional().default(""),
		title: z.string().optional().default(""),
		description: z.string().optional().default(""),
		date: z.coerce.date().optional(),
		createdAt: z.coerce.date().optional(),
		completedAt: z.coerce.date().optional(),
		content: z.string().optional().default(""),
		status: z.enum(["done", "todo"]).optional(),

		// Notebook
		name: z.string().optional().default(""),
		cover: z.string().optional().default(""),
		summary: z.string().optional().default(""),
		entries: z.number().optional().default(0),
		updatedAt: z.union([z.string(), z.date()]).optional(),
		tags: z.array(z.string()).optional().default([]),

		// Plan
		planName: z.string().optional().default(""),
		targetDesc: z.string().optional().default(""),
		dailyTarget: z.number().optional().default(1),
		monthlyTarget: z.number().optional().default(20),
		checkins: z.array(z.coerce.date()).optional().default([]),

		// Place
		province: z.string().optional().default(""),
		city: z.string().optional().default(""),
		experience: z.string().optional().default(""),
		visitCount: z.number().optional().default(1),
		lat: z.number().optional(),
		lng: z.number().optional(),

		// Legacy fields (keep compatibility with existing data)
		waterCups: z.number().optional(),
		meals: z
			.array(z.object({ name: z.string(), value: z.string() }))
			.optional()
			.default([]),
		streak: z.number().optional().default(0),
		progress: z.number().min(0).max(100).optional().default(0),
	}),
});

// ============================================================================
// 笔记本集合 - 日记、随笔、学习笔记等
// 目录：src/content/life/notebooks/
// 支持多个笔记本分类，每个笔记本有独立的封面和简介
// ============================================================================
const notebooksCollection = defineCollection({
	loader: glob({
		pattern: "**/*.{md,json}",
		base: "./src/content/life/notebooks",
	}),
	schema: z.object({
		name: z.string().optional().default("未命名日记本"),
		cover: z.string().optional().default(""),
		summary: z.string().optional().default(""),
		image: z
			.union([z.string(), z.array(z.string())])
			.optional()
			.default(""),
		tags: z.array(z.string()).optional().default([]),
		date: z.coerce.date().optional(),
	}),
});

// ============================================================================
// 日常规划集合 - 作息时间表、每日规划
// 目录：src/content/life/routines/
// 用于展示每日时间规划，支持图标、颜色自定义
// ============================================================================
const routinesCollection = defineCollection({
	loader: glob({
		pattern: "**/*.{md,mdx}",
		base: "./src/content/life/routines",
	}),
	schema: z.object({
		name: z.string(),
		time: z.string().optional().default(""),
		description: z.string().optional().default(""),
		icon: z.string().optional().default("📌"),
		color: z.string().optional().default(""),
		updatedAt: z.union([z.string(), z.date()]).optional(),
	}),
});

// ============================================================================
// 相册集合 - 图片展示与管理
// 目录：src/content/album/
// 支持标签分类、地点信息、照片说明等
// 注意：cover 和 photos 使用字符串路径（public 目录下的图片）
// ============================================================================
const albumCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx,json}", base: "./src/content/album" }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			subtitle: z.string().optional().default(""),
			cover: z.string().optional(),
			date: z.coerce.date(),
			location: z.string().optional().default(""),
			photos: z
				.array(
					z.string()
						.or(
							z.object({
								src: z.string(),
								alt: z.string().optional(),
								caption: z.string().optional(),
							}),
						),
				)
				.optional()
				.default([]),
			tags: z.array(z.string()).optional().default([]),
			draft: z.boolean().optional().default(false),
		}),
});

// ============================================================================
// 资源集合 - 公告、每日名言等站点资源
// 目录：src/content/ziyuan/
// 支持两种模式：公告模式（content）和名言模式（quotes）
// ============================================================================
const ziyuanCollection = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/ziyuan" }),
	schema: z.union([
		z.object({
			title: z.string(),
			content: z.string(),
			closable: z.boolean().optional().default(true),
			link: z
				.object({
					enable: z.boolean().optional().default(true),
					text: z.string(),
					url: z.string(),
					external: z.boolean().optional().default(false),
				})
				.optional(),
			quotes: z.undefined().optional(),
		}),
		z.object({
			title: z.string(),
			quotes: z.array(
				z.object({
					text: z.string(),
					author: z.string(),
				}),
			),
			content: z.undefined().optional(),
			closable: z.undefined().optional(),
			link: z.undefined().optional(),
		}),
	]),
});

// ============================================================================
// 友情链接集合 - 友链展示与管理
// 目录：src/content/friends/
// 每个 .md 文件代表一个友链，通过 frontmatter 配置信息
// ============================================================================
const friendsCollection = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/friends" }),
	schema: z.object({
		title: z.string(),
		imgurl: z.string(),
		desc: z.string(),
		siteurl: z.string(),
		tags: z.array(z.string()).optional().default([]),
		weight: z.number().optional().default(0),
		enabled: z.boolean().optional().default(true),
	}),
});

// ============================================================================
// 导航集合 - 网址导航
// 目录：src/content/daohang/
// 支持分类、图标、描述、特色标记等
// ============================================================================
const daohangCollection = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/daohang" }),
	schema: z.object({
		name: z.string(),
		url: z.string(),
		icon: z.string().optional().default(""),
		description: z.string().optional().default(""),
		category: z.string().default("未分类"),
		tags: z.array(z.string()).optional().default([]),
		color: z.string().optional().default(""),
		image: z.string().optional().default(""),
		featured: z.boolean().optional().default(false),
		order: z.number().optional().default(0),
	}),
});

// ============================================================================
// 更新日志集合 - 版本更新记录
// 目录：src/content/changelog/
// 类型：feature(新功能), improvement(改进), fix(修复), removal(移除)
// ============================================================================
const changelogCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/changelog" }),
	schema: z.object({
		version: z.string(),
		date: z.coerce.date(),
		time: z.string().optional(),
		type: z.enum(["feature", "improvement", "fix", "removal"]),
		description: z.string(),
	}),
});

// ============================================================================
// 弹幕集合 - 留言板弹幕效果
// 目录：src/content/danmu/
// 用于在留言板页面展示滚动弹幕
// ============================================================================
const danmuCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/danmu" }),
	schema: z.object({
		nickname: z.string(),
		time: z.string().optional().default(""),
	}),
});

/**
 * 导出所有内容集合
 *
 * 注意：集合名称与目录名称对应，在页面中通过 getCollection() 获取内容
 * 例如：const posts = await getCollection("posts");
 */
export const collections = {
	posts: postsCollection,
	spec: specCollection,
	moments: momentsCollection,
	bangumi: bangumiCollection,
	life: lifeCollection,
	notebooks: notebooksCollection,
	routines: routinesCollection,
	album: albumCollection,
	daohang: daohangCollection,
	ziyuan: ziyuanCollection,
	friends: friendsCollection,
	changelog: changelogCollection,
	danmu: danmuCollection,
};
