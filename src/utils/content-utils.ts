import { type CollectionEntry, getCollection } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl } from "@utils/url-utils";
import { siteConfig } from "@/config";
import { getEnabledMoments } from "@/config/momentsConfig";

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
		// 日期相同，按 order 排序（越小越靠前）
		if (dateA.getTime() === dateB.getTime()) {
			return (a.data.order ?? 0) - (b.data.order ?? 0);
		}
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
		order?: number;
	};
};

// 辅助函数
const isIn = (entryId: string, folder: string) =>
	entryId.replace(/\\/g, "/").startsWith(`${folder}/`);

export async function getArchiveList(): Promise<ArchiveItem[]> {
	const { archive: archiveConfig } = siteConfig;

	const postItems: ArchiveItem[] = [];
	if (archiveConfig.posts) {
		const posts = await getCollection("posts", ({ data }) => {
			return import.meta.env.PROD ? data.draft !== true : true;
		});
		postItems.push(
			...posts.map((post) => ({
				id: post.id,
				type: "post",
				data: {
					title: post.data.title,
					published: post.data.published,
					tags: post.data.tags,
					category: post.data.category,
					order: post.data.order,
				},
			})),
		);
	}

	const momentItems: ArchiveItem[] = [];
	if (archiveConfig.moments) {
		const moments = getEnabledMoments();
		momentItems.push(
			...moments.map((moment) => {
				let title = moment.body || "";
				title = title.replace(/[#*`]/g, "").trim();
				if (title.length > 50) title = `${title.substring(0, 50)}...`;
				if (!title) title = i18n(I18nKey.moments) || "日常动态";
				return {
					id: moment.id,
					type: "moment",
					data: {
						title: title,
						published: new Date(moment.published),
						tags: moment.tags,
						category: null,
					},
				};
			}),
		);
	}

	const bangumiItems: ArchiveItem[] = [];
	if (archiveConfig.bangumi) {
		const bangumi = await getCollection("bangumi");
		bangumiItems.push(
			...bangumi.map((b) => {
				let link = b.data.link || "";
				if (!link) {
					const slug = b.id
						.replace(/\\/g, "/")
						.replace(/\.(md|mdx|markdown)$/i, "");
					if (b.data.category === "book") {
						link = `/books/${slug}/`;
					} else if (b.data.category === "music") {
						link = "/music/";
					} else {
						link = "/movies-games/";
					}
				}
				return {
					id: b.id,
					type: "bangumi",
					data: {
						title: b.data.title,
						published: b.data.published || new Date(0),
						tags: [],
						category: null,
						image:
							typeof b.data.image === "string"
								? b.data.image
								: (b.data.image as any)?.src,
						link,
					},
				};
			}),
		);
	}

	const lifeItems: ArchiveItem[] = [];
	if (archiveConfig.life) {
		const lifeEntries = await getCollection("life");
		const notebooksEntries = await getCollection("notebooks");
		const routinesEntries = await getCollection("routines");

		lifeEntries
			.filter((entry) => isIn(entry.id, "places"))
			.forEach((p) => {
				const parts = [p.data.province, p.data.city].filter(Boolean);
				lifeItems.push({
					id: p.id,
					type: "life",
					data: {
						title: parts.length > 0 ? parts.join(" ") : "足迹记录",
						published: p.data.date || new Date(),
						tags: ["足迹"],
						link: "/life/places/",
					},
				});
			});

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

		routinesEntries.forEach((r) => {
			lifeItems.push({
				id: r.id,
				type: "life",
				data: {
					title: `规划: ${r.data.name}`,
					published:
						r.data.updatedAt instanceof Date ? r.data.updatedAt : new Date(),
					tags: ["规划"],
					link: "/life/routines/",
				},
			});
		});
	}

	return [...postItems, ...momentItems, ...bangumiItems, ...lifeItems].sort(
		(a, b) => {
			const timeA = a.data.published.getTime();
			const timeB = b.data.published.getTime();
			if (timeA === timeB) {
				return (a.data.order ?? 0) - (b.data.order ?? 0);
			}
			return timeB - timeA;
		},
	);
}
export type CatalogGroup = {
	name: string;
	count: number;
	posts: PostForList[];
	isCurrent: boolean;
};

/**
 * 获取按分类分组的全部文章，用于文章详情页左侧目录组件。
 * - 组内排序保持 getSortedPosts 原序（pinned 优先 + published 降序）
 * - 组间按该组最新文章的 published 日期降序
 * - 当前文章所在分类标记 isCurrent=true（用于 SSR 默认展开）
 */
export async function getCatalogGroups(
	currentPostId: string,
): Promise<CatalogGroup[]> {
	const sorted = await getSortedPosts();

	// 找到当前文章，确定其分类键
	const currentPost = sorted.find((p) => p.id === currentPostId);
	const currentCategoryKey =
		currentPost?.data.category?.trim() || i18n(I18nKey.uncategorized);

	// 按分类分组（保持 sorted 原序）
	const groupMap = new Map<string, PostForList[]>();
	for (const post of sorted) {
		const categoryName = post.data.category?.trim();
		const key = categoryName || i18n(I18nKey.uncategorized);
		if (!groupMap.has(key)) groupMap.set(key, []);
		groupMap.get(key)?.push({ id: post.id, data: post.data });
	}

	// 转换为数组
	const groups: CatalogGroup[] = [];
	for (const [name, posts] of groupMap) {
		groups.push({
			name,
			count: posts.length,
			posts,
			isCurrent: name === currentCategoryKey,
		});
	}

	// 组间按最新文章 published 降序（posts[0] 即最新，因 sorted 已按 published 降序）
	groups.sort((a, b) => {
		const aTime = a.posts[0]?.data.published
			? new Date(a.posts[0].data.published).getTime()
			: 0;
		const bTime = b.posts[0]?.data.published
			? new Date(b.posts[0].data.published).getTime()
			: 0;
		return bTime - aTime;
	});

	return groups;
}

export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const allMoments = getEnabledMoments();

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	allMoments.forEach((moment) => {
		if (Array.isArray(moment.tags)) {
			moment.tags.forEach((tag: string) => {
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
