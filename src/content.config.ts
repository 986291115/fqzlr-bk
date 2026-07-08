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
 * - life:        生活记录（规划、足迹等）
 * - ziyuan:      资源（公告、名言等）
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
	life: lifeCollection,
	ziyuan: ziyuanCollection,
	danmu: danmuCollection,
};
