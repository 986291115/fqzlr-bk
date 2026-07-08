<script lang="ts">
import { onMount } from "svelte";
import {
	hasValidToken,
	showToast,
	ensureIconify,
	getRepoFile,
	genId,
	deepClone,
	registerSubmitHandler,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";
import { repoConfig } from "@/config/editConfig";

interface BangumiItem {
	id: string;
	title: string;
	name_cn?: string;
	category: string;
	subcategory?: string;
	status: number;
	score?: number;
	image: string;
	tags: string[];
	comment?: string;
	published: string;
	link?: string;
	artist?: string;
	audioUrl?: string;
	lrcUrl?: string;
	metingServer?: string;
	metingId?: string;
	enabled?: boolean;
	_draft?: boolean;
	_deleted?: boolean;
}

let {
	defaultCategory = "all",
	customPageName = "番剧",
	initialItems = [],
}: {
	defaultCategory?: string;
	customPageName?: string;
	initialItems?: BangumiItem[];
} = $props();

let editMode = $state(false);
let saving = $state(false);
let items = $state<BangumiItem[]>([]);
let originalItems = $state<BangumiItem[]>([]);
let editingIndex = $state(-1);
let activeTab = $state(defaultCategory);
let activeStatusTab = $state("all");
let tagsInput = $state("");
let repoLoaded = $state(false);
let fileSha = $state<string | null>(null);
let originalTS = $state<string>("");

const pageKey = customPageName === "书架"
	? "books"
	: customPageName === "影视游戏"
		? "movies-games"
		: "bangumi";

const pageName = customPageName;

function stripLineComments(code: string): string {
	const lines = code.split("\n");
	return lines
		.map((line) => {
			let inStr = false;
			let quotes = 0;
			for (let i = 0; i < line.length - 1; i++) {
				if (line[i] === '"' && (i === 0 || line[i - 1] !== "\\")) {
					inStr = !inStr;
					quotes++;
				}
				if (!inStr && line[i] === "/" && line[i + 1] === "/") {
					if (quotes % 2 === 0) {
						return line.substring(0, i);
					}
				}
			}
			return line;
		})
		.join("\n");
}

function parseArrayFromTS(tsContent: string, startMarker: string): any[] {
	tsContent = tsContent.replace(/\r\n/g, "\n");
	const startIdx = tsContent.indexOf(startMarker);
	if (startIdx === -1) return [];
	let bracketStart = tsContent.indexOf("[", startIdx);
	if (bracketStart === -1) return [];
	let depth = 1;
	let idx = bracketStart + 1;
	while (idx < tsContent.length && depth > 0) {
		if (tsContent[idx] === "[") depth++;
		else if (tsContent[idx] === "]") depth--;
		if (depth > 0) idx++;
	}
	let arrayStr = tsContent.substring(bracketStart + 1, idx).trim();
	arrayStr = stripLineComments(arrayStr);
	arrayStr = arrayStr.replace(/,(\s*[\]\}])/g, "$1");
	arrayStr = arrayStr.replace(/,(\s*)$/, "$1");
	arrayStr = arrayStr.replace(/^(\s*)(\w+)\s*:/gm, '$1"$2":');
	try {
		return JSON.parse(`[${arrayStr}]`);
	} catch (e) {
		console.error("Failed to parse array from TS:", e);
		return [];
	}
}

function parseBangumiFromTS(tsContent: string): BangumiItem[] {
	const items = parseArrayFromTS(tsContent, "export const bangumiConfig: BangumiItem[] = [");
	return items.map((item: any, index: number) => ({
		id: item.id || `bg-${index}`,
		title: item.title || "",
		name_cn: item.name_cn || "",
		category: item.category || "anime",
		subcategory: item.subcategory,
		status: item.status || 2,
		score: item.score || 0,
		image: item.image || "",
		tags: Array.isArray(item.tags) ? item.tags : [],
		comment: item.comment || "",
		published: item.published || new Date().toISOString().slice(0, 10),
		link: item.link || "",
		artist: item.artist || "",
		audioUrl: item.audioUrl || "",
		lrcUrl: item.lrcUrl || "",
		metingServer: item.metingServer || "",
		metingId: item.metingId || "",
		enabled: item.enabled !== false,
	}));
}

function buildBangumiObject(item: BangumiItem): string {
	const obj: any = {
		id: item.id,
		title: item.title,
	};
	if (item.name_cn) obj.name_cn = item.name_cn;
	obj.category = item.category;
	if (item.subcategory) obj.subcategory = item.subcategory;
	obj.status = item.status;
	if (item.score) obj.score = item.score;
	obj.image = item.image;
	obj.tags = item.tags;
	if (item.comment) obj.comment = item.comment;
	obj.published = item.published;
	if (item.link) obj.link = item.link;
	if (item.artist) obj.artist = item.artist;
	if (item.audioUrl) obj.audioUrl = item.audioUrl;
	if (item.lrcUrl) obj.lrcUrl = item.lrcUrl;
	if (item.metingServer) obj.metingServer = item.metingServer;
	if (item.metingId) obj.metingId = item.metingId;
	obj.enabled = item.enabled !== false;

	const json = JSON.stringify(obj, null, 2)
		.split("\n")
		.map((line, i, arr) =>
			i === arr.length - 1 ? `\t\t${line},` : `\t\t${line}`,
		)
		.join("\n");
	return json;
}

function replaceArrayInTS(
	originalContent: string,
	startMarker: string,
	newArrayContent: string,
): string {
	const startIdx = originalContent.indexOf(startMarker);
	if (startIdx === -1) return originalContent;
	let bracketStart = originalContent.indexOf("[", startIdx);
	if (bracketStart === -1) return originalContent;
	let depth = 1;
	let idx = bracketStart + 1;
	while (idx < originalContent.length && depth > 0) {
		if (originalContent[idx] === "[") depth++;
		else if (originalContent[idx] === "]") depth--;
		if (depth > 0) idx++;
	}
	return (
		originalContent.substring(0, bracketStart + 1) +
		"\n" +
		newArrayContent +
		"\n\t]" +
		originalContent.substring(idx + 1)
	);
}

function buildBangumiConfigTS(
	bangumiList: BangumiItem[],
	originalContent?: string,
): string {
	const entries = bangumiList.map((m) => buildBangumiObject(m));
	const arrayContent = entries.join("\n");

	if (originalContent) {
		let result = originalContent;
		result = replaceArrayInTS(
			result,
			"export const bangumiConfig: BangumiItem[] = [",
			arrayContent,
		);
		return result;
	}

	return `/**
 * 番剧/影视收藏页面配置
 * 用于管理番剧、书籍、游戏、音乐收藏
 */

export type BangumiCategory = "anime" | "book" | "game" | "music" | "real";
export type BangumiSubcategory = "movie" | "tv" | "anime" | "documentary" | "game";

export interface BangumiItem {
	id: string;
	title: string;
	name_cn?: string;
	category: BangumiCategory;
	subcategory?: BangumiSubcategory;
	status: number;
	score?: number;
	image: string;
	tags: string[];
	comment?: string;
	published: string;
	link?: string;
	artist?: string;
	audioUrl?: string;
	lrcUrl?: string;
	metingServer?: string;
	metingId?: string;
	enabled?: boolean;
}

export interface BangumiPageConfig {
	title?: string;
	description?: string;
	showComment?: boolean;
	itemsPerPage?: number;
	itemsPerPageMobile?: number;
}

export const bangumiPageConfig: BangumiPageConfig = {
	title: "番剧",
	description: "记录我看过的动漫、书籍、游戏和音乐",
	showComment: true,
	itemsPerPage: 12,
	itemsPerPageMobile: 6,
};

export const bangumiConfig: BangumiItem[] = [
${arrayContent}
];

export function getAllBangumi(): BangumiItem[] {
	return bangumiConfig.filter((item) => item.enabled !== false);
}

export function getBangumiByCategory(category: BangumiCategory): BangumiItem[] {
	return getAllBangumi()
		.filter((item) => item.category === category)
		.sort(
			(a, b) =>
				new Date(b.published).getTime() - new Date(a.published).getTime(),
		);
}

export function getBangumiByStatus(status: number): BangumiItem[] {
	return getAllBangumi().filter((item) => item.status === status);
}

export function getBangumiStats() {
	const all = getAllBangumi();
	const stats: Record<BangumiCategory, number> = {
		anime: 0,
		book: 0,
		game: 0,
		music: 0,
		real: 0,
	};
	all.forEach((item) => {
		stats[item.category] = (stats[item.category] || 0) + 1;
	});
	return stats;
}
`;
}

const drafts = setupRepoDrafts({
	pageKey,
	pageName,
	getContent: () =>
		buildBangumiConfigTS(
			items.filter((m) => !m._deleted),
			originalTS,
		),
	setContent: (v) => {
		const parsed = parseBangumiFromTS(v);
		if (parsed.length > 0 || v.includes("bangumiConfig")) {
			items = parsed;
		}
	},
	getPath: () => "src/config/bangumiConfig.ts",
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => originalTS,
	setOriginalContent: (v) => (originalTS = v),
	getCommitMsg: (isEdit) =>
		isEdit ? `chore(${pageKey}): 更新${pageName}` : `chore(${pageKey}): 创建${pageName}配置`,
	onSubmitted: () => {
		setTimeout(() => window.location.reload(), 1200);
	},
});

let hasChanges = $derived(drafts.hasLocalChanges());

$effect(() => {
	window.dispatchEvent(
		new CustomEvent("edit:hasChanges", {
			detail: { pageKey, hasChanges },
		}),
	);
});

const statusMap: Record<number, { name: string; color: string }> = {
	1: { name: "想看", color: "#3b82f6" },
	2: { name: "看过", color: "#22c55e" },
	3: { name: "在看", color: "#f59e0b" },
	4: { name: "搁置", color: "#8b5cf6" },
	5: { name: "抛弃", color: "#ef4444" },
};

const categoryMap: Record<string, { name: string; color: string }> = {
	anime: { name: "动漫", color: "#ec4899" },
	book: { name: "书籍", color: "#14b8a6" },
	game: { name: "游戏", color: "#8b5cf6" },
	music: { name: "音乐", color: "#f59e0b" },
	real: { name: "影视", color: "#3b82f6" },
};

const subcategoryMap: Record<string, { name: string; color: string }> = {
	movie: { name: "电影", color: "#3b82f6" },
	tv: { name: "剧集", color: "#8b5cf6" },
	anime: { name: "动漫", color: "#ec4899" },
	documentary: { name: "纪录片", color: "#14b8a6" },
	game: { name: "游戏", color: "#8b5cf6" },
};

const categoryList = (() => {
	if (customPageName === "影视游戏") {
		return [
			{ id: "movie", name: "电影" },
			{ id: "tv", name: "剧集" },
			{ id: "anime", name: "动漫" },
			{ id: "documentary", name: "纪录片" },
			{ id: "game", name: "游戏" },
		];
	} else if (customPageName === "书架") {
		return [{ id: "book", name: "书籍" }];
	}
	return [
		{ id: "anime", name: "动漫" },
		{ id: "book", name: "书籍" },
		{ id: "game", name: "游戏" },
		{ id: "music", name: "音乐" },
		{ id: "real", name: "影视" },
	];
})();

const tabs = [{ id: "all", name: "全部" }, ...categoryList];

const statusTabs = [
	{ id: "all", name: "全部" },
	{ id: "2", name: "看过" },
	{ id: "3", name: "在看" },
	{ id: "1", name: "想看" },
	{ id: "4", name: "搁置" },
	{ id: "5", name: "抛弃" },
];

function getItemSubcategory(item: BangumiItem): string {
	if (item.subcategory) return item.subcategory;
	if (item.category === "game") return "game";
	if (item.category !== "real") return item.category;
	const tags = item.tags || [];
	if (tags.some((t) => t.includes("纪录"))) return "documentary";
	if (tags.some((t) => t.includes("动漫") || t.includes("动画"))) return "anime";
	if (tags.some((t) => t.includes("电视剧") || t.includes("剧集"))) return "tv";
	return "movie";
}

let filteredItems = $derived.by(() => {
	let result = items.filter((i) => !i._deleted);

	if (customPageName === "影视游戏" && activeTab !== "all") {
		result = result.filter((i) => getItemSubcategory(i) === activeTab);
	} else if (activeTab !== "all" && customPageName !== "影视游戏") {
		result = result.filter((i) => i.category === activeTab);
	}

	if (activeStatusTab !== "all") {
		result = result.filter((i) => i.status === Number(activeStatusTab));
	}

	return result;
});

onMount(() => {
	ensureIconify();
	if (initialItems && initialItems.length > 0) {
		items = initialItems.map((i) => ({ ...i, id: i.id || genId("bg"), enabled: i.enabled !== false }));
	} else {
		collectFromDOM();
	}
	originalItems = deepClone(items);
	loadRepoData();

	window.addEventListener("edit:sidebarModeChange", handleSidebarModeChange);
	window.addEventListener("edit:sidebarSaveDraft", handleSidebarSaveDraft);
	window.addEventListener("edit:sidebarSubmit", handleSidebarSubmit);
	window.addEventListener("edit:sidebarCancel", handleSidebarCancel);
	window.addEventListener("edit:sidebarAdd", handleSidebarAdd);

	return () => {
		window.removeEventListener("edit:sidebarModeChange", handleSidebarModeChange);
		window.removeEventListener("edit:sidebarSaveDraft", handleSidebarSaveDraft);
		window.removeEventListener("edit:sidebarSubmit", handleSidebarSubmit);
		window.removeEventListener("edit:sidebarCancel", handleSidebarCancel);
		window.removeEventListener("edit:sidebarAdd", handleSidebarAdd);
	};
});

async function loadRepoData() {
	const existing = await getRepoFile("src/config/bangumiConfig.ts", repoConfig);
	if (existing && existing.content) {
		try {
			const repoItems: BangumiItem[] = parseBangumiFromTS(existing.content);
			originalTS = existing.content;
			fileSha = existing.sha || null;

			const repoMap = new Map(repoItems.map((m) => [m.id, m]));
			items = items.map((m) => {
				const repoItem = repoMap.get(m.id);
				if (repoItem) {
					return {
						...m,
						enabled: repoItem.enabled ?? m.enabled,
					};
				}
				return m;
			});

			const existingIds = new Set(items.map((m) => m.id));
			for (const g of repoItems) {
				if (!existingIds.has(g.id)) {
					items = [...items, { ...g, id: g.id || genId("bg") }];
					existingIds.add(g.id);
				}
			}

			originalItems = deepClone(items);
		} catch (e) {
			console.error("Failed to parse repo bangumi:", e);
		}
	} else {
		originalTS = buildBangumiConfigTS(items);
	}
	repoLoaded = true;
	drafts.restoreFromDrafts();
}

function handleSidebarModeChange(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== pageKey) return;
	if (detail.editing) {
		editMode = true;
		hideSSRContent();
	} else {
		editMode = false;
		showSSRContent();
	}
}

function handleSidebarSaveDraft(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== pageKey) return;
	handleSaveDraft();
}

function handleSidebarSubmit(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== pageKey) return;
	handleSubmit();
}

function handleSidebarCancel(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== pageKey) return;
	handleCancel();
}

function handleSidebarAdd(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== pageKey) return;
	handleAdd();
}

function collectFromDOM() {
	const grid = document.querySelector(".mg-grid, .books-grid, [data-bangumi-grid]");
	if (!grid) return;

	const result: BangumiItem[] = [];
	const cards = grid.querySelectorAll(".mg-item, .bangumi-item, [data-bangumi-item]");

	cards.forEach((el) => {
		const title = el.querySelector("h3, .title, .bangumi-title")?.textContent?.trim() || "";
		const img = el.querySelector("img") as HTMLImageElement | null;
		const image = img?.src || img?.getAttribute("data-src") || "";

		let status = 2;
		const statusEl = el.querySelector("[data-status]");
		if (statusEl) {
			const s = parseInt(statusEl.getAttribute("data-status") || "2");
			if (!isNaN(s)) status = s;
		}

		result.push({
			id: genId("bg"),
			title,
			name_cn: title,
			category: customPageName === "书架" ? "book" : "anime",
			status,
			score: 0,
			image,
			tags: [],
			comment: "",
			published: new Date().toISOString().slice(0, 10),
			enabled: true,
		});
	});

	if (result.length > 0) {
		items = result;
		originalItems = deepClone(result);
	}
}

function hideSSRContent() {
	const selectors = [
		".mg-grid",
		".books-grid",
		".mg-tabs-wrapper",
		".mg-filter-wrapper",
		".mg-section",
		"[data-bangumi-grid]",
		"[data-mg-tab-nav]",
		".tools-tab-pill",
		".mg-item",
		".bangumi-item",
		".bookshelf",
		".bookshelf-container",
	];
	selectors.forEach((sel) => {
		document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
			el.style.display = "none";
		});
	});
}

function showSSRContent() {
	const selectors = [
		".mg-grid",
		".books-grid",
		".mg-tabs-wrapper",
		".mg-filter-wrapper",
		".mg-section",
		"[data-bangumi-grid]",
		"[data-mg-tab-nav]",
		".tools-tab-pill",
		".mg-item",
		".bangumi-item",
		".bookshelf",
		".bookshelf-container",
	];
	selectors.forEach((sel) => {
		document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
			el.style.display = "";
		});
	});
}

function handleCancel() {
	editMode = false;
	items = deepClone(originalItems);
	editingIndex = -1;
	activeTab = defaultCategory;
	activeStatusTab = "all";
	drafts.clearDrafts();
	showSSRContent();
}

function handleAdd() {
	const today = new Date().toISOString().slice(0, 10);
	let defaultCat = "anime";
	let defaultSubcat: string | undefined;

	if (customPageName === "书架") {
		defaultCat = "book";
	} else if (customPageName === "影视游戏") {
		defaultCat = "real";
		defaultSubcat = activeTab !== "all" ? activeTab : "movie";
	} else if (activeTab !== "all") {
		defaultCat = activeTab;
	}

	const newItem: BangumiItem = {
		id: genId("bg"),
		title: "",
		name_cn: "",
		category: defaultCat,
		subcategory: defaultSubcat,
		status: activeStatusTab !== "all" ? parseInt(activeStatusTab) : 2,
		score: 0,
		image: "",
		tags: [],
		comment: "",
		published: today,
		enabled: true,
		_draft: true,
	};
	items = [newItem, ...items];
	tagsInput = "";
	editingIndex = 0;
}

function startEdit(index: number) {
	const item = filteredItems[index];
	if (!item) return;
	const realIndex = items.findIndex((i) => i.id === item.id);
	if (realIndex < 0) return;

	editingIndex = realIndex;
	tagsInput = items[realIndex].tags.join(", ");
}

function finishEdit() {
	if (editingIndex < 0) return;
	const item = items[editingIndex];
	if (!item.title.trim()) {
		showToast("标题不能为空", "warning");
		return;
	}

	item.tags = tagsInput
		.split(/[,，、\s]+/)
		.map((s) => s.trim())
		.filter((s) => s);

	items[editingIndex] = { ...item };
	items = [...items];
	showToast("已修改，记得点击保存", "info");
	editingIndex = -1;
}

function cancelItemEdit() {
	if (editingIndex < 0) return;
	const item = items[editingIndex];

	if (item._draft && !item.title.trim()) {
		items = items.filter((_, i) => i !== editingIndex);
	} else {
		const orig = originalItems.find((o) => o.id === item.id && !item._draft);
		if (orig) {
			items[editingIndex] = deepClone(orig);
			items = [...items];
		}
	}
	editingIndex = -1;
}

function deleteItem(index: number) {
	const item = filteredItems[index];
	if (!item) return;
	const realIndex = items.findIndex((i) => i.id === item.id);
	if (realIndex < 0) return;

	if (!confirm(`确定要删除「${item.title}」吗？`)) return;

	if (item._draft) {
		items = items.filter((_, i) => i !== realIndex);
	} else {
		items[realIndex] = { ...items[realIndex], _deleted: true };
		items = [...items];
	}

	showToast("已标记删除，记得点击保存", "info");
}

function restoreItem(index: number) {
	const realIndex = items.findIndex((i) => i.id === filteredItems[index]?.id);
	if (realIndex < 0) return;
	items[realIndex] = { ...items[realIndex], _deleted: false };
	items = [...items];
}

function getRealIndex(item: BangumiItem): number {
	return items.findIndex((it) => it.id === item.id);
}

function handleSaveDraft() {
	drafts.saveToDrafts();
}

async function handleSubmit() {
	if (editingIndex >= 0) {
		finishEdit();
		if (editingIndex >= 0) return;
	}
	if (!hasValidToken()) {
		showToast("GitHub 代理未配置，请联系管理员", "warning");
		return;
	}
	saving = true;
	try {
		const cleanData = items.map(({ _draft, _deleted, ...rest }) => ({
			...rest,
			id: rest.id || genId("bg"),
			enabled: rest.enabled !== false,
		}));
		items = cleanData;
		drafts.saveToDrafts();
		await drafts.submitDrafts();
	} catch (err) {
		showToast("保存出错：" + (err as Error).message, "error");
		console.error(err);
	} finally {
		saving = false;
	}
}

registerSubmitHandler(pageKey, async (draft) => {
	if (draft.payload?.type === "repo" && draft.payload.content !== undefined) {
		const content = String(draft.payload.content);
		const parsedItems = parseBangumiFromTS(content);
		if (parsedItems.length === 0 && !content.includes("bangumiConfig")) {
			return false;
		}
		return true;
	}
	return false;
});
</script>


{#if editMode}
  <div class="bg-editor">
    <!-- Tabs -->
    <div class="bg-tabs">
      {#each tabs as tab}
        <button
          class:bg-tab-active={activeTab === tab.id}
          class="bg-tab-btn"
          onclick={() => (activeTab = tab.id)}
        >
          {tab.name}
        </button>
      {/each}
    </div>

    <!-- Status filters -->
    <div class="bg-status-filters">
      {#each statusTabs as st}
        <button
          class:bg-status-active={activeStatusTab === st.id}
          class="bg-status-btn"
          onclick={() => (activeStatusTab = st.id)}
        >
          {st.name}
        </button>
      {/each}
    </div>

    <!-- Grid -->
    {#if filteredItems.length > 0}
      <div class="bg-grid">
        {#each filteredItems as item, i (i + "-" + item.id)}
          <div
            class="bg-card"
            class:bg-card-draft={item._draft}
            class:bg-card-deleted={item._deleted}
            class:bg-card-editing={editingIndex === getRealIndex(item)}
          >
            {#if editingIndex !== getRealIndex(item)}
              <div class="bg-card-actions">
                <button class="bg-action-btn bg-action-edit" onclick={() => startEdit(i)} title="编辑">
                  <iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
                </button>
                {#if item._deleted}
                  <button class="bg-action-btn bg-action-restore" onclick={() => restoreItem(i)} title="恢复">
                    <iconify-icon icon="material-symbols:restore"></iconify-icon>
                  </button>
                {:else}
                  <button class="bg-action-btn bg-action-delete" onclick={() => deleteItem(i)} title="删除">
                    <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
                  </button>
                {/if}
              </div>

              <div class="bg-card-cover">
                {#if item.image}
                  <img src={item.image} alt={item.title} loading="lazy" />
                {:else}
                  <div class="bg-card-cover-placeholder">
                    <iconify-icon icon="material-symbols:image-outline"></iconify-icon>
                  </div>
                {/if}
              </div>

              <div class="bg-card-info">
                <h4 class="bg-card-title">{item.title || "（无标题）"}</h4>
                <div class="bg-card-meta">
                  <span
                    class="bg-status-badge"
                    style={`background:${statusMap[item.status]?.color}20;color:${statusMap[item.status]?.color};border-color:${statusMap[item.status]?.color}40`}
                  >
                    {statusMap[item.status]?.name}
                  </span>
                  {#if item._draft}
                    <span class="bg-draft-badge">新增</span>
                  {/if}
                  {#if item._deleted}
                    <span class="bg-deleted-badge">已删除</span>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="bg-card-edit-form">
                <div class="bg-edit-form-header">
                  <iconify-icon icon="material-symbols:edit-document-outline-rounded"></iconify-icon>
                  <span>{item._draft ? "添加条目" : "编辑条目"}</span>
                  {#if item._draft}
                    <span class="bg-draft-badge">新增</span>
                  {/if}
                </div>

                <div class="bg-edit-form-body">
                  <div class="bg-form-group">
                    <label>标题 *</label>
                    <input
                      type="text"
                      class="bg-input"
                      bind:value={items[getRealIndex(item)].title}
                      placeholder="条目标题"
                    />
                  </div>
                  <div class="bg-form-group">
                    <label>中文名称</label>
                    <input
                      type="text"
                      class="bg-input"
                      bind:value={items[getRealIndex(item)].name_cn}
                      placeholder="中文名称（可选）"
                    />
                  </div>

                  <div class="bg-form-row">
                    <div class="bg-form-group">
                      <label>分类</label>
                      <select class="bg-select" bind:value={items[getRealIndex(item)].category}>
                        {#each Object.entries(categoryMap) as [key, val]}
                          <option value={key}>{val.name}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="bg-form-group">
                      <label>状态</label>
                      <select class="bg-select" bind:value={items[getRealIndex(item)].status}>
                        {#each Object.entries(statusMap) as [key, val]}
                          <option value={key}>{val.name}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="bg-form-group">
                      <label>评分</label>
                      <input
                        type="number"
                        class="bg-input"
                        bind:value={items[getRealIndex(item)].score}
                        min="0"
                        max="10"
                        step="0.5"
                      />
                    </div>
                  </div>

                  <div class="bg-form-group">
                    <label>封面图 URL</label>
                    <input
                      type="text"
                      class="bg-input"
                      bind:value={items[getRealIndex(item)].image}
                      placeholder="https://example.com/cover.jpg"
                    />
                  </div>

                  <div class="bg-form-group">
                    <label>标签（逗号分隔）</label>
                    <input
                      type="text"
                      class="bg-input"
                      bind:value={tagsInput}
                      placeholder="标签1, 标签2, 标签3"
                    />
                  </div>

                  <div class="bg-form-group">
                    <label>短评/简介</label>
                    <textarea
                      class="bg-textarea"
                      bind:value={items[getRealIndex(item)].comment}
                      rows={3}
                      placeholder="简单的评价或介绍..."
                      spellcheck="false"
                    ></textarea>
                  </div>

                  <div class="bg-form-group">
                    <label>日期</label>
                    <input
                      type="date"
                      class="bg-input"
                      bind:value={items[getRealIndex(item)].published}
                    />
                  </div>

                  <div class="bg-form-group">
                    <label>链接（可选）</label>
                    <input
                      type="text"
                      class="bg-input"
                      bind:value={items[getRealIndex(item)].link}
                      placeholder="相关文章或外部链接"
                    />
                  </div>

                  {#if items[getRealIndex(item)].category === "music"}
                    <div class="bg-form-row">
                      <div class="bg-form-group">
                        <label>艺术家</label>
                        <input
                          type="text"
                          class="bg-input"
                          bind:value={items[getRealIndex(item)].artist}
                          placeholder="艺术家/歌手"
                        />
                      </div>
                      <div class="bg-form-group">
                        <label>音频 URL</label>
                        <input
                          type="text"
                          class="bg-input"
                          bind:value={items[getRealIndex(item)].audioUrl}
                          placeholder="音频文件链接"
                        />
                      </div>
                    </div>
                    <div class="bg-form-row">
                      <div class="bg-form-group">
                        <label>歌词 URL</label>
                        <input
                          type="text"
                          class="bg-input"
                          bind:value={items[getRealIndex(item)].lrcUrl}
                          placeholder="歌词文件链接"
                        />
                      </div>
                      <div class="bg-form-group">
                        <label>Meting 服务器</label>
                        <input
                          type="text"
                          class="bg-input"
                          bind:value={items[getRealIndex(item)].metingServer}
                          placeholder="netease/tencent/..."
                        />
                      </div>
                    </div>
                    <div class="bg-form-group">
                      <label>Meting ID</label>
                      <input
                        type="text"
                        class="bg-input"
                        bind:value={items[getRealIndex(item)].metingId}
                        placeholder="歌曲 ID"
                      />
                    </div>
                  {/if}
                </div>

                <div class="bg-edit-form-footer">
                  <button class="bg-btn bg-btn-cancel" onclick={cancelItemEdit}>取消</button>
                  <button class="bg-btn bg-btn-save" onclick={finishEdit}>完成</button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="bg-empty">
        <iconify-icon icon="material-symbols:collections-bookmark-outline" style="font-size:48px;opacity:0.3;"></iconify-icon>
        <p>暂无数据，点击"添加"创建第一条</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .bg-editor {
    padding: 1rem 0;
  }

  .bg-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }
  .bg-tab-btn {
    padding: 0.4rem 0.875rem;
    border-radius: 9999px;
    border: 1.5px solid var(--border, #d1d5db);
    background: transparent;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    color: var(--text-color, #374151);
    transition: all 0.2s;
    font-family: inherit;
  }
  :global(.dark) .bg-tab-btn {
    border-color: #374151;
    color: #d1d5db;
  }
  .bg-tab-active {
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white !important;
    border-color: hsl(var(--theme-hue, 165), 70%, 50%);
  }

  .bg-status-filters {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .bg-status-btn {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    border: 1px solid var(--border, #e5e7eb);
    background: transparent;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--content-meta, #6b7280);
    transition: all 0.2s;
    font-family: inherit;
  }
  :global(.dark) .bg-status-btn {
    border-color: #374151;
    color: #9ca3af;
  }
  .bg-status-active {
    background: var(--btn-regular-bg);
    color: var(--btn-content) !important;
    border-color: var(--primary) !important;
  }

  .bg-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  @media (min-width: 640px) {
    .bg-grid { grid-template-columns: repeat(4, 1fr); }
  }
  @media (min-width: 1024px) {
    .bg-grid { grid-template-columns: repeat(5, 1fr); }
  }
  @media (min-width: 1280px) {
    .bg-grid { grid-template-columns: repeat(6, 1fr); }
  }

  .bg-card {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    background: var(--card-bg, white);
    border: 1px solid var(--border, rgba(0,0,0,0.08));
    transition: all 0.2s;
  }
  :global(.dark) .bg-card {
    background: rgba(23, 23, 23, 0.8);
    border-color: rgba(255,255,255,0.08);
  }
  .bg-card:hover {
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.4);
    transform: translateY(-2px);
  }
  .bg-card-draft {
    border-style: dashed;
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
  }
  .bg-card-deleted {
    opacity: 0.5;
    border-color: rgba(239, 68, 68, 0.3) !important;
  }

  .bg-card-actions {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 4px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .bg-card:hover .bg-card-actions {
    opacity: 1;
  }
  .bg-action-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 14px;
    backdrop-filter: blur(8px);
    transition: all 0.15s;
    color: white;
  }
  .bg-action-btn iconify-icon {
    display: flex;
  }
  .bg-action-edit { background: rgba(59, 130, 246, 0.9); }
  .bg-action-edit:hover { background: rgba(37, 99, 235, 1); }
  .bg-action-delete { background: rgba(239, 68, 68, 0.9); }
  .bg-action-delete:hover { background: rgba(220, 38, 38, 1); }
  .bg-action-restore { background: rgba(34, 197, 94, 0.9); }
  .bg-action-restore:hover { background: rgba(22, 163, 74, 1); }

  .bg-card-cover {
    width: 100%;
    aspect-ratio: 3 / 4;
    overflow: hidden;
    background: var(--bg-secondary, #f3f4f6);
  }
  .bg-card-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .bg-card-cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--content-meta, #9ca3af);
    font-size: 2rem;
  }

  .bg-card-info {
    padding: 0.625rem 0.75rem;
  }
  .bg-card-title {
    margin: 0 0 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-color, #1f2937);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
  }
  :global(.dark) .bg-card-title {
    color: #e5e7eb;
  }
  .bg-card-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .bg-status-badge {
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    border: 1px solid;
  }
  .bg-draft-badge {
    padding: 1px 6px;
    border-radius: 999px;
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
    font-size: 10px;
    font-weight: 600;
  }
  .bg-deleted-badge {
    padding: 1px 6px;
    border-radius: 999px;
    background: #ef4444;
    color: white;
    font-size: 10px;
    font-weight: 600;
  }

  .bg-empty {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--content-meta, #9ca3af);
    font-size: 0.875rem;
  }

  .bg-card-editing {
    grid-column: span 2;
    grid-row: span 2;
  }
  @media (max-width: 640px) {
    .bg-card-editing {
      grid-column: span 1;
      grid-row: span 1;
    }
  }

  .bg-card-edit-form {
    display: flex;
    flex-direction: column;
    height: 100%;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .bg-edit-form-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    font-size: 13px;
    font-weight: 600;
    color: hsl(var(--theme-hue, 165), 70%, 45%);
    border-bottom: 1px solid var(--border, rgba(0,0,0,0.08));
  }

  .bg-edit-form-body {
    padding: 14px;
    overflow-y: auto;
    flex: 1;
  }

  .bg-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .bg-form-group {
    margin-bottom: 10px;
  }
  .bg-form-group label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary, #4b5563);
    margin-bottom: 4px;
  }
  :global(.dark) .bg-form-group label {
    color: #d1d5db;
  }
  .bg-input,
  .bg-select,
  .bg-textarea {
    width: 100%;
    padding: 7px 10px;
    border: 1.5px solid var(--border, #d1d5db);
    border-radius: 6px;
    font-size: 12px;
    background: var(--bg-color, white);
    color: var(--text-color, #1f2937);
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
    font-family: inherit;
  }
  :global(.dark) .bg-input,
  :global(.dark) .bg-select,
  :global(.dark) .bg-textarea {
    background: #0f0f1a;
    border-color: #374151;
    color: #e5e7eb;
  }
  .bg-input:focus,
  .bg-select:focus,
  .bg-textarea:focus {
    border-color: hsl(var(--theme-hue, 165), 70%, 50%);
    box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }
  .bg-textarea {
    resize: vertical;
    min-height: 60px;
  }

  .bg-edit-form-footer {
    display: flex;
    gap: 8px;
    padding: 12px 14px;
    border-top: 1px solid var(--border, rgba(0,0,0,0.08));
  }
  .bg-btn {
    flex: 1;
    padding: 7px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
  }
  .bg-btn-cancel {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-color, #374151);
  }
  .bg-btn-cancel:hover {
    background: var(--border, #e5e7eb);
  }
  :global(.dark) .bg-btn-cancel {
    background: #2d2d44;
    color: #d1d5db;
  }
  :global(.dark) .bg-btn-cancel:hover {
    background: #3d3d55;
  }
  .bg-btn-save {
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
  }
  .bg-btn-save:hover {
    background: hsl(var(--theme-hue, 165), 75%, 45%);
  }

  @media (max-width: 640px) {
    .bg-form-row {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
