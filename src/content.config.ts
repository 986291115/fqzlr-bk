import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

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

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});

const specCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" }),
	schema: z.object({}),
});

const momentsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/moments" }),
	schema: ({ image }) =>
		z.object({
			author: z.string().optional().default(""),
			avatar: z.string().optional().default(""),
			published: z.date(),
			images: z
				.array(image().or(z.string()))
				.or(z.string())
				.optional()
				.default([]),
			tags: z.array(z.string()).optional().default([]),
			location: z.string().optional().default(""),
			device: z.string().optional().default(""),
		}),
});

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
			status: z.number().min(1).max(5).default(2), // 1: 想看, 2: 看过, 3: 在看, 4: 搁置, 5: 抛弃
			image: image().or(z.string()),
			link: z.string(), // 对应的文章链接或外部链接
			score: z.number().min(0).max(10).optional(),
			comment: z.string().optional(),
			tags: z.array(z.string()).optional().default([]),
			published: z.date().optional(),
		}),
});

const lifeCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/life" }),
	schema: z.object({
		label: z.string().optional().default(""),
		value: z.string().optional().default(""),
		title: z.string().optional().default(""),
		description: z.string().optional().default(""),
		date: z.string().optional().default(""),
		createdAt: z.string().optional().default(""),
		completedAt: z.string().optional().default(""),
		content: z.string().optional().default(""),
		status: z.enum(["done", "todo"]).optional(),

		// Health record (one file per day)
		workoutType: z.string().optional().default(""),
		runKm: z.number().optional().default(0),
		stepsToday: z.number().optional(),
		workoutMinutes: z.number().optional(),
		sleepHours: z.number().optional(),
		allowedFoods: z.array(z.string()).optional().default([]),
		avoidFoods: z.array(z.string()).optional().default([]),
		sleepQuality: z.number().min(1).max(5).optional().default(3),

		// Notebook
		name: z.string().optional().default(""),
		cover: z.string().optional().default(""),
		summary: z.string().optional().default(""),
		entries: z.number().optional().default(0),
		updatedAt: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),

		// Plan
		planName: z.string().optional().default(""),
		targetDesc: z.string().optional().default(""),
		dailyTarget: z.number().optional().default(1),
		monthlyTarget: z.number().optional().default(20),
		checkins: z.array(z.string()).optional().default([]),

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

const lifeWorkoutCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/life/health/workout" }),
	schema: z.object({
		date: z.string(),
		workoutType: z.string().optional().default(""),
		runKm: z.number().optional().default(0),
		workoutMinutes: z.number().optional(),
		stepsToday: z.number().optional(),
	}),
});

const lifeSleepCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/life/health/sleep" }),
	schema: z.object({
		date: z.string(),
		sleepHours: z.number().optional(),
		sleepQuality: z.number().min(1).max(5).optional().default(3),
	}),
});

const lifeFoodCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/life/health/food" }),
	schema: z.object({
		date: z.string(),
		allowedFoods: z.array(z.string()).optional().default([]),
		avoidFoods: z.array(z.string()).optional().default([]),
	}),
});

const notebooksCollection = defineCollection({
	loader: glob({ pattern: "**/_index.md", base: "./src/content/life/notebooks" }),
	schema: z.object({
		name: z.string(),
		cover: z.string().optional().default(""),
		summary: z.string().optional().default(""),
	}),
});

const notebookGrowthCollection = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/content/life/notebooks/growth", exclude: ["**/_index.md"] }),
	schema: z.object({
		date: z.string().optional().default(""),
	}),
});

const notebookStudyCollection = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/content/life/notebooks/study", exclude: ["**/_index.md"] }),
	schema: z.object({
		date: z.string().optional().default(""),
	}),
});

const notebookIdeasCollection = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/content/life/notebooks/ideas", exclude: ["**/_index.md"] }),
	schema: z.object({
		date: z.string().optional().default(""),
	}),
});

export const collections = {
	posts: postsCollection,
	spec: specCollection,
	moments: momentsCollection,
	bangumi: bangumiCollection,
	life: lifeCollection,
	lifeWorkout: lifeWorkoutCollection,
	lifeSleep: lifeSleepCollection,
	lifeFood: lifeFoodCollection,
	notebooks: notebooksCollection,
	notebookGrowth: notebookGrowthCollection,
	notebookStudy: notebookStudyCollection,
	notebookIdeas: notebookIdeasCollection,
};
