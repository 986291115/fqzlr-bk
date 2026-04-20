import { type CollectionEntry, getCollection } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl } from "@utils/url-utils";

// // Retrieve posts and sort them by publication date
async function getRawSortedPosts() {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const sorted = allBlogPosts.sort((a, b) => {
		// 首先按置顶状态排序，置顶文章在前
		if (a.data.pinned && !b.data.pinned) return -1;
		if (!a.data.pinned && b.data.pinned) return 1;

		// 如果置顶状态相同，则按发布日期排序
		const dateA = new Date(a.data.published);
		const dateB = new Date(b.data.published);
		return dateA > dateB ? -1 : 1;
	});
	return sorted;
}

export async function getSortedPosts() {
	const sorted = await getRawSortedPosts();

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].id;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].id;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
	}

	return sorted;
}
export type PostForList = {
	id: string;
	data: CollectionEntry<"posts">["data"];
};
export async function getSortedPostsList(): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts();

	// delete post.body
	const sortedPostsList = sortedFullPosts.map((post) => ({
		id: post.id,
		data: post.data,
	}));

	return sortedPostsList;
}

export type ArchiveItem = {
	id: string;
	type: "post" | "moment" | "bangumi" | "life";
	data: {
		title: string;
		published: Date;
		tags: string[];
		category?: string | null;
		image?: string;
		link?: string;
	};
};

// 辅助函数
const isIn = (entryId: string, folder: string) =>
	entryId.replace(/\\/g, "/").startsWith(`${folder}/`);

export async function getArchiveList(): Promise<ArchiveItem[]> {
	const posts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const moments = await getCollection("moments");
	const bangumi = await getCollection("bangumi");
	const lifeEntries = await getCollection("life");
	const workoutEntries = await getCollection("lifeWorkout");
	const sleepEntries = await getCollection("lifeSleep");
	const foodEntries = await getCollection("lifeFood");
	const notebooksEntries = await getCollection("notebooks");
	const checkinEntries = await getCollection("checkin");
	const routinesEntries = await getCollection("routines");

	const postItems: ArchiveItem[] = posts.map((post) => ({
		id: post.id,
		type: "post",
		data: {
			title: post.data.title,
			published: post.data.published,
			tags: post.data.tags,
			category: post.data.category,
		},
	}));

	const momentItems: ArchiveItem[] = moments.map((moment) => {
		// 提取摘要作为标题
		let title = moment.body || "";
		title = title.replace(/[#*`]/g, "").trim(); // 移除 markdown 符号
		if (title.length > 50) title = `${title.substring(0, 50)}...`;
		if (!title) title = i18n(I18nKey.moments) || "日常动态";

		return {
			id: moment.id,
			type: "moment",
			data: {
				title: title,
				published: moment.data.published,
				tags: moment.data.tags,
				category: null,
			},
		};
	});

	const bangumiItems: ArchiveItem[] = bangumi.map((b) => ({
		id: b.id,
		type: "bangumi",
		data: {
			title: b.data.title,
			published: b.data.published || new Date(0),
			tags: [],
			category: null,
			image: typeof b.data.image === "string" ? b.data.image : (b.data.image as any)?.src,
			link: b.data.link,
		},
	}));

	// 生活动态归档
	const lifeItems: ArchiveItem[] = [];

	// 运动记录
	workoutEntries.forEach((w) => {
		lifeItems.push({
			id: w.id,
			type: "life",
			data: {
				title: `运动: ${w.data.workoutType || "锻炼"} - ${w.data.runKm || 0}km`,
				published: w.data.date,
				tags: ["运动"],
				link: "/life/health/",
			},
		});
	});

	// 睡眠记录
	sleepEntries.forEach((s) => {
		lifeItems.push({
			id: s.id,
			type: "life",
			data: {
				title: `睡眠: ${s.data.sleepHours || 0}小时`,
				published: s.data.date,
				tags: ["睡眠"],
				link: "/life/health/",
			},
		});
	});

	// 饮食记录
	foodEntries.forEach((f) => {
		lifeItems.push({
			id: f.id,
			type: "life",
			data: {
				title: `饮食记录`,
				published: f.data.date,
				tags: ["饮食"],
				link: "/life/health/",
			},
		});
	});

	// 想法记录
	lifeEntries.filter((entry) => isIn(entry.id, "ideas")).forEach((i) => {
		const title = i.data.content || "想法";
		lifeItems.push({
			id: i.id,
			type: "life",
			data: {
				title: title.length > 50 ? `${title.substring(0, 50)}...` : title,
				published: i.data.completedAt || i.data.createdAt || new Date(),
				tags: ["想法"],
				link: "/life/ideas/",
			},
		});
	});

	// 笔记本记录（排除 _index 元数据条目）
	notebooksEntries
		.filter((n) => !n.id.includes("_index"))
		.forEach((n) => {
			lifeItems.push({
				id: n.id,
				type: "life",
				data: {
					title: n.data.name || "笔记本",
					published: n.data.date || new Date(),
					tags: ["笔记本"],
					link: "/life/notebooks/",
				},
			});
		});

	// 打卡记录
	checkinEntries.forEach((c) => {
		lifeItems.push({
			id: c.id,
			type: "life",
			data: {
				title: `打卡: ${c.data.name}`,
				published: c.data.checkins?.[c.data.checkins.length - 1] || new Date(),
				tags: ["打卡"],
				link: "/life/checkin/",
			},
		});
	});

	// 日常规划
	routinesEntries.forEach((r) => {
		lifeItems.push({
			id: r.id,
			type: "life",
			data: {
				title: `规划: ${r.data.name}`,
				published: r.data.updatedAt instanceof Date ? r.data.updatedAt : new Date(),
				tags: ["规划"],
				link: "/life/routines/",
			},
		});
	});

	return [...postItems, ...momentItems, ...bangumiItems, ...lifeItems].sort((a, b) => {
		return b.data.published.getTime() - a.data.published.getTime();
	});
}
export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const allMoments = await getCollection("moments");

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	allMoments.forEach((moment: { data: { tags: string[] } }) => {
		if (Array.isArray(moment.data.tags)) {
			moment.data.tags.forEach((tag: string) => {
				if (!countMap[tag]) countMap[tag] = 0;
				countMap[tag]++;
			});
		}
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(): Promise<Category[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { category: string | null } }) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName =
			typeof post.data.category === "string"
				? post.data.category.trim()
				: String(post.data.category).trim();

		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		return (
			count[b] - count[a] || a.toLowerCase().localeCompare(b.toLowerCase())
		);
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c),
		});
	}
	return ret;
}
