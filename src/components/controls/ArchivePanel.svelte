<script lang="ts">
import { onMount, tick } from "svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { getPostUrlBySlug } from "@/utils/url-utils";

interface Post {
	id: string;
	type?: string;
	data: {
		title: string;
		tags: string[];
		category?: string | null;
		published: Date;
	};
}
interface MonthGroup {
	month: number;
	posts: Post[];
}
interface YearGroup {
	year: number;
	months: MonthGroup[];
	totalCount: number;
}
interface ActiveFilter {
	labelKey: I18nKey;
	values: string[];
}
interface PostMetaTag {
	name: string;
}

export let tags: string[] = [];
export let categories: string[] = [];
export let sortedPosts: Post[] = [];

let yearGroups: YearGroup[] = [];
let activeFilters: ActiveFilter[] = [];
let primaryFilter: ActiveFilter | null = null;
let secondaryFilters: ActiveFilter[] = [];
let filteredPostCount = 0;
let categoryColors: Map<string, string> = new Map();
let hoveredPostId: string | null = null;
let highlightedYear: number | null = null;
let highlightedMonth: string | null = null;

let highlightPathD = "";

let panelEl: HTMLElement;
let yearBlockRefs: Map<number, HTMLElement> = new Map();
let monthBlockRefs: Map<string, HTMLElement> = new Map();
let postRowRefs: Map<string, HTMLElement> = new Map();

const categoryColorPalette = [
	"#fbbf24",
	"#fb7185",
	"#34d399",
	"#60a5fa",
	"#a78bfa",
	"#f472b6",
	"#2dd4bf",
	"#fb923c",
	"#22d3ee",
	"#818cf8",
	"#e879f9",
	"#a3e635",
	"#f87171",
	"#a78bfa",
	"#06b6d4",
	"#f59e0b",
	"#f43f5e",
	"#10b981",
];

function formatDate(d: Date): string {
	return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatMonth(m: number): string {
	return `${m}${i18n(I18nKey.month)}`;
}
function getCategoryColor(name: string): string {
	const color = categoryColors.get(name);
	return color ? `color: ${color}` : "";
}
function normalizeCategoryName(name: string | null | undefined): string {
	return (name || "").trim();
}
function normalizeTags(tags: string[] | undefined | null): string[] {
	return Array.from(
		new Set(
			(tags || []).map((tag) => tag.trim()).filter((tag) => tag.length > 0),
		),
	);
}
function initializeCategoryColors(ps: Post[]): void {
	categoryColors = new Map();
	const set = new Set<string>();
	for (const p of ps) {
		const cat = normalizeCategoryName(p.data.category);
		if (cat) set.add(cat);
	}
	const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, "zh-CN"));
	for (let i = 0; i < sorted.length; i++) {
		categoryColors.set(
			sorted[i],
			categoryColorPalette[i % categoryColorPalette.length],
		);
	}
}
function getPostCategoryName(post: Post): string {
	return (
		normalizeCategoryName(post.data.category) || i18n(I18nKey.uncategorized)
	);
}
function getPostMetaTags(post: Post): PostMetaTag[] {
	return normalizeTags(post.data.tags)
		.slice(0, 3)
		.map((tag) => ({ name: tag }));
}
function getPostMetaMoreCount(post: Post): number {
	return Math.max(0, normalizeTags(post.data.tags).length - 3);
}

function groupByYearMonth(ps: Post[]): YearGroup[] {
	const ym = new Map<number, Map<number, Post[]>>();
	for (const p of ps) {
		const y = p.data.published.getFullYear(),
			mo = p.data.published.getMonth() + 1;
		if (!ym.has(y)) ym.set(y, new Map());
		const mm = ym.get(y)!;
		if (!mm.has(mo)) mm.set(mo, []);
		mm.get(mo)!.push(p);
	}
	return Array.from(ym.keys())
		.sort((a, b) => b - a)
		.map((year) => {
			const mm = ym.get(year)!;
			const months = Array.from(mm.keys())
				.sort((a, b) => b - a)
				.map((month) => ({ month, posts: mm.get(month)! }));
			return {
				year,
				months,
				totalCount: months.reduce((s, m) => s + m.posts.length, 0),
			};
		});
}

function getItemUrl(post: Post): string {
	if (
		post.type === "moment" &&
		typeof post.id === "string" &&
		post.id.startsWith("ext-")
	) {
		return "/moments/";
	}
	if (post.type && post.type !== "post") {
		return (post as any).data?.link || getPostUrlBySlug(post.id);
	}
	return getPostUrlBySlug(post.id);
}
function formatFilterValues(f: ActiveFilter): string {
	return f.labelKey === I18nKey.tags
		? f.values.map((v) => `#${v}`).join(" / ")
		: f.values.join(" / ");
}
function resolvePrimary(f: ActiveFilter[]): ActiveFilter | null {
	return f.find((f) => f.labelKey === I18nKey.tags) ?? f[0] ?? null;
}
function formatFilterSummary(fs: ActiveFilter[]): string {
	return fs
		.map((f) => `${i18n(f.labelKey)}: ${formatFilterValues(f)}`)
		.join("  ·  ");
}

function registerYearBlock(node: HTMLElement, year: number) {
	yearBlockRefs.set(year, node);
	return {
		destroy() {
			yearBlockRefs.delete(year);
		},
	};
}
function registerMonthBlock(
	node: HTMLElement,
	key: { year: number; month: number },
) {
	monthBlockRefs.set(`${key.year}-${key.month}`, node);
	return {
		destroy() {
			monthBlockRefs.delete(`${key.year}-${key.month}`);
		},
	};
}
function registerPostRow(node: HTMLElement, postId: string) {
	postRowRefs.set(postId, node);
	return {
		destroy() {
			postRowRefs.delete(postId);
		},
	};
}

async function computeHighlight(postId: string) {
	await tick();
	if (!panelEl) {
		highlightPathD = "";
		return;
	}

	let targetYear: number | null = null;
	let targetMonth: number | null = null;
	for (const yg of yearGroups) {
		for (const mg of yg.months) {
			if (mg.posts.some((p) => p.id === postId)) {
				targetYear = yg.year;
				targetMonth = mg.month;
				break;
			}
		}
		if (targetYear !== null) break;
	}
	if (targetYear === null || targetMonth === null) {
		highlightPathD = "";
		highlightedYear = null;
		highlightedMonth = null;
		return;
	}

	highlightedYear = targetYear;
	highlightedMonth = `${targetYear}-${targetMonth}`;

	const panelRect = panelEl.getBoundingClientRect();
	const tw =
		Number.parseFloat(getComputedStyle(panelEl).getPropertyValue("--tw")) * 16;
	const r = 4;

	const yearBlock = yearBlockRefs.get(targetYear);
	const monthBlock = monthBlockRefs.get(`${targetYear}-${targetMonth}`);
	const postRow = postRowRefs.get(postId);

	if (!yearBlock || !monthBlock || !postRow) {
		highlightPathD = "";
		return;
	}

	const yr = yearBlock.getBoundingClientRect();
	const mr = monthBlock.getBoundingClientRect();
	const pr = postRow.getBoundingClientRect();

	const x0 = yr.left - panelRect.left + tw / 2;
	const y0 = yr.top - panelRect.top + tw / 2;
	const x1 = mr.left - panelRect.left + tw / 2;
	const y1 = mr.top - panelRect.top + tw / 2;
	const x2 = pr.left - panelRect.left + tw / 2;
	const y2 = pr.top - panelRect.top + pr.height / 2;

	const d = [
		`M ${x0} ${y0}`,
		`L ${x0} ${y1 - r}`,
		`A ${r} ${r} 0 0 0 ${x0 + r} ${y1}`,
		`L ${x1 - r} ${y1}`,
		`A ${r} ${r} 0 0 0 ${x1} ${y1 + r}`,
		`L ${x1} ${y2 - r}`,
		`A ${r} ${r} 0 0 0 ${x1 + r} ${y2}`,
		`L ${x2} ${y2}`,
	].join(" ");

	highlightPathD = d;
}

async function onPostEnter(id: string) {
	hoveredPostId = id;
	await computeHighlight(id);
}
function onPostLeave() {
	hoveredPostId = null;
	highlightedYear = null;
	highlightedMonth = null;
	highlightPathD = "";
}

function applyFilters(allPosts: Post[]) {
	const params = new URLSearchParams(window.location.search);
	tags = params.has("tag") ? params.getAll("tag") : [];
	categories = params.has("category") ? params.getAll("category") : [];
	const uncategorized = params.get("uncategorized");
	let filtered = allPosts;
	const cf: ActiveFilter[] = [];
	if (categories.length > 0)
		cf.push({ labelKey: I18nKey.categories, values: categories });
	if (uncategorized)
		cf.push({
			labelKey: I18nKey.categories,
			values: [i18n(I18nKey.uncategorized)],
		});
	if (tags.length > 0) cf.push({ labelKey: I18nKey.tags, values: tags });
	activeFilters = cf;
	primaryFilter = resolvePrimary(cf);
	secondaryFilters = primaryFilter ? cf.filter((f) => f !== primaryFilter) : [];
	if (tags.length > 0)
		filtered = filtered.filter(
			(p) =>
				Array.isArray(p.data.tags) && p.data.tags.some((t) => tags.includes(t)),
		);
	if (categories.length > 0)
		filtered = filtered.filter(
			(p) => p.data.category && categories.includes(p.data.category),
		);
	if (uncategorized) filtered = filtered.filter((p) => !p.data.category);
	filtered = filtered
		.slice()
		.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
	filteredPostCount = filtered.length;
	initializeCategoryColors(filtered);
	yearGroups = groupByYearMonth(filtered);
}

onMount(async () => {
	let allPosts = [...sortedPosts];
	applyFilters(allPosts);
});
</script>

<div class="archive-panel card-base" bind:this={panelEl}>

	{#if primaryFilter}
		<div class="mb-6">
			<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
				<div class="min-w-0 text-sm text-75">
					<span class="text-50">{i18n(primaryFilter.labelKey)}</span>
					<span class="mx-2 text-30">/</span>
					<span class="font-semibold text-(--primary)">{formatFilterValues(primaryFilter)}</span>
					{#if secondaryFilters.length > 0}
						<span class="ml-2 text-50">· {formatFilterSummary(secondaryFilters)}</span>
					{/if}
				</div>
				<div class="shrink-0 text-xs text-50">
					{filteredPostCount} {i18n(filteredPostCount === 1 ? I18nKey.postCount : I18nKey.postsCount)}
					<span class="mx-1.5 text-30">·</span>
					{yearGroups.length} {i18n(I18nKey.year)}
				</div>
			</div>
		</div>
	{/if}

	{#each yearGroups as yearGroup (yearGroup.year)}
		<div
			class="ap-year-block"
			use:registerYearBlock={yearGroup.year}
		>
			<div class="ap-year-header">
				<div class="ap-col">
					<div
						class="ap-node ap-year-node"
						class:highlighted={highlightedYear === yearGroup.year}
					></div>
				</div>
				<div class="ap-year-label">
					<h2 class="ap-h1">{yearGroup.year}{i18n(I18nKey.year)}</h2>
					<span class="ap-count">
						共 {yearGroup.totalCount} {i18n(yearGroup.totalCount === 1 ? I18nKey.postCount : I18nKey.postsCount)}
					</span>
				</div>
			</div>

			<div class="ap-months-area">
				{#each yearGroup.months as monthGroup (monthGroup.month)}
					<div
						class="ap-month-block"
						use:registerMonthBlock={{ year: yearGroup.year, month: monthGroup.month }}
					>
						<div class="ap-month-header">
							<div class="ap-col">
								<div class="ap-hline ap-month-hline"></div>
								<div
									class="ap-node ap-month-node"
									class:highlighted={highlightedMonth === `${yearGroup.year}-${monthGroup.month}`}
								></div>
							</div>
							<div class="ap-month-label">
								<h3 class="ap-h2">{formatMonth(monthGroup.month)}</h3>
								<span class="ap-count">
									{monthGroup.posts.length} {i18n(monthGroup.posts.length === 1 ? I18nKey.postCount : I18nKey.postsCount)}
								</span>
							</div>
						</div>

						<div class="ap-posts-area">
							<ul class="ap-post-list">
								{#each monthGroup.posts as post, postIdx (post.id)}
									{@const postTags = getPostMetaTags(post)}
									{@const postMoreCount = getPostMetaMoreCount(post)}
									{@const catColor = getCategoryColor(getPostCategoryName(post))}
									<li
										class="ap-post-row"
										class:last={postIdx === monthGroup.posts.length - 1}
										use:registerPostRow={post.id}
									>
										<div class="ap-col">
											<div class="ap-hline ap-post-hline"></div>
											<div
												class="ap-node ap-post-node"
												class:hovered={hoveredPostId === post.id}
											></div>
										</div>
										<a
											href={getItemUrl(post)}
											aria-label={post.data.title}
											class="ap-post-link group btn-plain"
											on:mouseenter={() => onPostEnter(post.id)}
											on:mouseleave={onPostLeave}
										>
											<span class="ap-date">{formatDate(post.data.published)}</span>
											<span class="ap-post-content">
												<span class="ap-title group-hover:text-(--primary)">
													{post.data.title}
												</span>
												<span class="ap-meta">
													<span class="ap-category" style={catColor}>
														#{getPostCategoryName(post)}
													</span>
													{#if postTags.length > 0}
														<span class="ap-meta-gap" aria-hidden="true"></span>
														{#each postTags as tag, i (tag.name)}
															<span class="ap-tag">
																{tag.name}
															</span>
															{#if i < postTags.length - 1}
																<span class="ap-meta-divider" aria-hidden="true">/</span>
															{/if}
														{/each}
													{/if}
													{#if postMoreCount > 0}
														<span class="ap-tag-more">
															+{postMoreCount}
														</span>
													{/if}
												</span>
											</span>
										</a>
									</li>
								{/each}
							</ul>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/each}

	{#if highlightPathD}
		<svg class="ap-highlight-svg" aria-hidden="true">
			<path d={highlightPathD} fill="none" stroke="var(--lh)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	{/if}

</div>

<style>
.archive-panel {
	--tw: 2rem;
	--lc: var(--line-color, oklch(0.82 0 0));
	--lh: oklch(0.15 0 0);
	--nc: var(--line-color, oklch(0.82 0 0));
	--nh: oklch(0.15 0 0);
	--lw: 2.5px;
	position: relative;
}

.ap-year-block {
	position: relative;
	margin-bottom: 2.5rem;
}

.ap-year-block::before {
	content: "";
	position: absolute;
	left: calc(var(--tw) / 2);
	top: calc(var(--tw) / 2);
	bottom: 1rem;
	width: 0;
	border-left: var(--lw) dashed var(--lc);
	z-index: 0;
}

.ap-months-area { padding-left: var(--tw); }

.ap-month-block {
	position: relative;
	margin-bottom: 0.5rem;
}

.ap-month-block::before {
	content: "";
	position: absolute;
	left: calc(var(--tw) / 2);
	top: calc(var(--tw) / 2);
	bottom: 1rem;
	width: 0;
	border-left: var(--lw) dashed var(--lc);
	z-index: 0;
}

.ap-posts-area { padding-left: var(--tw); }
.ap-post-list  { list-style: none; margin: 0; padding: 0; }

.ap-post-row {
	position: relative;
	display: flex;
	align-items: center;
	min-height: 2.25rem;
	transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.ap-post-row:hover {
	transform: translateX(0.375rem);
}

.ap-post-row::before {
	content: none;
}

.ap-col {
	position: relative;
	width: var(--tw);
	flex-shrink: 0;
	align-self: stretch;
}

.ap-node {
	position: absolute;
	left: 50%;
	transform: translateX(-50%);
	border-radius: 50%;
	z-index: 2;
	transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
.ap-node.highlighted,
.ap-node.hovered {
	z-index: 3;
}

.ap-year-node {
	top: calc(50% - 0.375rem);
	width: 0.75rem; height: 0.75rem;
	border: 2px solid var(--nc);
	background: var(--page-bg, white);
}
.ap-year-node.highlighted {
	background: var(--nh);
	border-color: var(--nh);
}

.ap-month-node {
	top: calc(50% - 0.25rem);
	width: 0.5rem; height: 0.5rem;
	background: var(--nc);
}
.ap-month-node.highlighted {
	background: var(--nh);
	transform: translateX(-50%) scale(1.5);
}

.ap-post-node {
	top: calc(50% - 0.2rem);
	width: 0.4rem; height: 0.4rem;
	background: var(--nc);
}
.ap-post-node.hovered {
	background: var(--nh);
	transform: translateX(-50%) scale(1.6);
}

.ap-hline {
	position: absolute;
	height: 0;
	border-top: var(--lw) dashed var(--lc);
	z-index: 1;
}
.ap-month-hline {
	top: 50%;
	left: calc(-1 * var(--tw) / 2);
	width: var(--tw);
}
.ap-post-hline {
	top: 50%;
	left: calc(-1 * var(--tw) / 2);
	width: var(--tw);
}

.ap-highlight-svg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	z-index: 1;
	overflow: visible;
}
.ap-highlight-svg path {
	filter: drop-shadow(0 0 2px var(--page-bg, white)) drop-shadow(0 0 2px var(--page-bg, white));
}
:global(.dark) .ap-highlight-svg path {
	filter: drop-shadow(0 0 2px var(--page-bg, #0d0d0d)) drop-shadow(0 0 2px var(--page-bg, #0d0d0d));
}

.ap-year-header, .ap-month-header {
	display: flex; align-items: center; min-height: var(--tw);
}
.ap-year-label, .ap-month-label {
	display: flex; align-items: baseline; gap: 0.6rem; padding-left: 0.5rem; flex: 1;
}
.ap-h1 { font-size: 1.375rem; font-weight: 700; color: var(--deep-text); margin: 0; }
.ap-h2 { font-size: 1.05rem;  font-weight: 600; color: var(--deep-text); margin: 0; }
.ap-count { font-size: 0.75rem; color: var(--content-meta); }

.ap-post-link {
	display: flex; align-items: center; gap: 0.85rem;
	flex: 1; min-height: 2.5rem; padding: 0.25rem 0.5rem;
	margin-left: 0;
	border-radius: 0.5rem; text-decoration: none; overflow: hidden;
}
.ap-date {
	font-size: 0.875rem; color: var(--content-meta);
	font-variant-numeric: tabular-nums; white-space: nowrap;
	flex-shrink: 0; width: 2.8rem; text-align: right;
}
.ap-post-content {
	display: flex;
	align-items: center;
	gap: 0.85rem;
	flex: 1;
	min-width: 0;
}
.ap-category {
	font-size: 0.8rem; font-weight: 700;
	white-space: nowrap; flex-shrink: 0;
	color: var(--content-meta);
}
.ap-meta {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	flex-shrink: 0;
	min-width: 0;
	white-space: nowrap;
}
.ap-meta-gap {
	display: inline-block;
	width: 0.5rem;
	flex-shrink: 0;
}
.ap-meta-divider {
	color: var(--meta-divider);
	font-size: 0.8rem;
	font-weight: 700;
	flex-shrink: 0;
	margin: 0 0.05rem;
}
.ap-tag {
	font-size: 0.8rem;
	font-weight: 700;
	white-space: nowrap;
	flex-shrink: 0;
}
.ap-tag-more {
	color: var(--content-meta);
	font-size: 0.8rem;
	font-weight: 700;
	white-space: nowrap;
	flex-shrink: 0;
}
.ap-title {
	font-size: 0.9rem; font-weight: 500; color: var(--deep-text);
	overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	flex: 1; min-width: 0; transition: color 0.15s ease; display: block;
}

:global(.dark) .archive-panel {
	--lh: oklch(0.9 0 0);
	--nh: oklch(0.9 0 0);
}

@media (max-width: 768px) {
	.archive-panel { --tw: 1.5rem; }
	.ap-post-link {
		align-items: flex-start;
		gap: 0.5rem;
		min-height: auto;
		padding: 0.45rem 0.5rem 0.5rem;
	}
	.ap-date {
		width: 2.6rem;
		font-size: 0.78rem;
		margin-top: 0.1rem;
	}
	.ap-post-content {
		flex: 1;
		min-width: 0;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
	}
	.ap-title {
		width: 100%;
		font-size: 0.92rem;
		white-space: normal;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		text-overflow: ellipsis;
		overflow-wrap: anywhere;
	}
	.ap-meta {
		width: 100%;
		flex-wrap: wrap;
		gap: 0.2rem;
		white-space: normal;
	}
	.ap-meta-gap {
		display: none;
	}
	.ap-category { font-size: 0.75rem; }
	.ap-tag,
	.ap-tag-more,
	.ap-meta-divider { font-size: 0.72rem; }

	.ap-year-block::before,
	.ap-month-block::before {
		content: none;
	}
	.ap-hline,
	.ap-node,
	.ap-col,
	.ap-highlight-svg {
		display: none;
	}
	.ap-months-area,
	.ap-posts-area {
		padding-left: 0.5rem;
	}
}
</style>
