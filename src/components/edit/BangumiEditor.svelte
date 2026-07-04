<script lang="ts">
import { onMount } from "svelte";
import {
	hasValidToken,
	showToast,
	ensureIconify,
	getRepoFile,
	updateRepoFile,
	createRepoFile,
	deleteRepoFile,
	genId,
	deepClone,
	registerSubmitHandler,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";
import { repoConfig } from "@/config/editConfig";

interface BangumiItem {
	id: string;
	slug: string;
	title: string;
	name_cn: string;
	category: string;
	subcategory?: string;
	status: number;
	score: number;
	image: string;
	tags: string[];
	comment: string;
	published: string;
	sha?: string;
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
let originalItemsJson = $state("");
let editingIndex = $state(-1);
let activeTab = $state(defaultCategory);
let activeStatusTab = $state("all");
let modalItem = $state<BangumiItem | null>(null);
let modalMode = $state<"add" | "edit">("add");
let tagsInput = $state("");

const pageKey = customPageName === "书架"
	? "books"
	: customPageName === "影视游戏"
		? "movies-games"
		: "bangumi";

const pageName = customPageName;

function serializeItems(): string {
	return JSON.stringify(
		items.map((i) => ({
			id: i.id,
			slug: i.slug,
			title: i.title,
			name_cn: i.name_cn,
			category: i.category,
			subcategory: i.subcategory,
			status: i.status,
			score: i.score,
			image: i.image,
			tags: i.tags,
			comment: i.comment,
			published: i.published,
			_draft: i._draft,
			_deleted: i._deleted,
		})),
	);
}

function deserializeItems(json: string) {
	try {
		const parsed = JSON.parse(json);
		if (Array.isArray(parsed)) {
			items = parsed.map((e: any) => ({
				id: e.id || genId("bg"),
				slug: e.slug || "",
				title: e.title || "",
				name_cn: e.name_cn || "",
				category: e.category || "anime",
				subcategory: e.subcategory,
				status: e.status || 2,
				score: e.score || 0,
				image: e.image || "",
				tags: Array.isArray(e.tags) ? e.tags : [],
				comment: e.comment || "",
				published: e.published || new Date().toISOString().slice(0, 10),
				sha: e.sha,
				_draft: !!e._draft,
				_deleted: !!e._deleted,
			}));
		}
	} catch {}
}

const drafts = setupRepoDrafts({
	pageKey,
	pageName,
	getContent: () => serializeItems(),
	setContent: (v) => deserializeItems(v),
	getPath: () => `${pageKey}-items`,
	getSha: () => null,
	setSha: () => {},
	getOriginalContent: () => originalItemsJson,
	setOriginalContent: () => {},
	getCommitMsg: () => `chore(${pageKey}): 更新${pageName}`,
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
		items = initialItems.map((i) => ({ ...i, id: i.id || genId("bg") }));
	} else {
		collectFromDOM();
	}
	originalItems = deepClone(items);
	originalItemsJson = serializeItems();

	window.addEventListener("edit:sidebarModeChange", handleSidebarModeChange);
	window.addEventListener("edit:sidebarSaveDraft", handleSidebarSaveDraft);
	window.addEventListener("edit:sidebarSubmit", handleSidebarSubmit);
	window.addEventListener("edit:sidebarCancel", handleSidebarCancel);
	window.addEventListener("edit:sidebarAdd", handleSidebarAdd);

	drafts.restoreFromDrafts();

	return () => {
		window.removeEventListener("edit:sidebarModeChange", handleSidebarModeChange);
		window.removeEventListener("edit:sidebarSaveDraft", handleSidebarSaveDraft);
		window.removeEventListener("edit:sidebarSubmit", handleSidebarSubmit);
		window.removeEventListener("edit:sidebarCancel", handleSidebarCancel);
		window.removeEventListener("edit:sidebarAdd", handleSidebarAdd);
	};
});

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
	openAddModal();
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
		const link = el.querySelector("a")?.getAttribute("href") || "";
		const slug = link.replace(/^\/bangumi\/|\/$/g, "").replace(/^\/books\/|\/$/g, "");

		let status = 2;
		const statusEl = el.querySelector("[data-status]");
		if (statusEl) {
			const s = parseInt(statusEl.getAttribute("data-status") || "2");
			if (!isNaN(s)) status = s;
		}

		result.push({
			id: slug || genId("bg"),
			slug,
			title,
			name_cn: title,
			category: customPageName === "书架" ? "book" : "anime",
			status,
			score: 0,
			image,
			tags: [],
			comment: "",
			published: new Date().toISOString().slice(0, 10),
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
		"#bookshelf",
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
		"#bookshelf",
		".bookshelf-container",
	];
	selectors.forEach((sel) => {
		document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
			el.style.display = "";
		});
	});
}

function handleCancel() {
	items = deepClone(originalItems);
	editingIndex = -1;
	activeTab = defaultCategory;
	activeStatusTab = "all";
	drafts.clearDrafts();
	showSSRContent();
}

function openAddModal() {
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

	modalItem = {
		id: genId("bg"),
		slug: "",
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
		_draft: true,
	};
	tagsInput = "";
	modalMode = "add";
}

function openEditModal(index: number) {
	const item = filteredItems[index];
	if (!item) return;
	const realIndex = items.findIndex((i) => i.id === item.id);
	if (realIndex < 0) return;

	editingIndex = realIndex;
	modalItem = deepClone(items[realIndex]);
	tagsInput = items[realIndex].tags.join(", ");
	modalMode = "edit";
}

function closeModal() {
	modalItem = null;
	editingIndex = -1;
}

function saveModal() {
	if (!modalItem) return;
	if (!modalItem.title.trim()) {
		showToast("标题不能为空", "warning");
		return;
	}

	modalItem.tags = tagsInput
		.split(/[,，、\s]+/)
		.map((s) => s.trim())
		.filter((s) => s);

	if (modalMode === "add") {
		items = [modalItem, ...items];
		showToast("已添加，记得点击保存", "info");
	} else {
		if (editingIndex >= 0) {
			items[editingIndex] = { ...modalItem };
			items = [...items];
			showToast("已修改，记得点击保存", "info");
		}
	}

	closeModal();
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

function slugify(text: string): string {
	return (
		text
			.toLowerCase()
			.trim()
			.replace(/[\s]+/g, "-")
			.replace(/[^\w\u4e00-\u9fa5-]/g, "")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "") || "item"
	);
}

function buildBangumiMd(item: BangumiItem): string {
	const lines = ["---"];
	lines.push(`title: "${item.title.replace(/"/g, '\\"')}"`);
	if (item.name_cn && item.name_cn !== item.title) {
		lines.push(`name_cn: "${item.name_cn.replace(/"/g, '\\"')}"`);
	}
	lines.push(`category: ${item.category}`);
	if (item.subcategory) {
		lines.push(`subcategory: ${item.subcategory}`);
	}
	lines.push(`status: ${item.status}`);
	if (item.score) {
		lines.push(`score: ${item.score}`);
	}
	if (item.image) {
		lines.push(`image: "${item.image}"`);
	}
	if (item.tags && item.tags.length > 0) {
		lines.push(`tags:`);
		item.tags.forEach((tag) => {
			lines.push(`  - "${tag.replace(/"/g, '\\"')}"`);
		});
	}
	if (item.comment) {
		lines.push(`comment: "${item.comment.replace(/"/g, '\\"')}"`);
	}
	if (item.published) {
		lines.push(`published: ${item.published}`);
	}
	lines.push("---");
	lines.push("");
	lines.push(item.comment || item.title);
	lines.push("");
	return lines.join("\n");
}

async function submitItems(itemsToSubmit: BangumiItem[]): Promise<boolean> {
	let allOk = true;

	for (let i = 0; i < itemsToSubmit.length; i++) {
		const entry = itemsToSubmit[i];
		if (entry._deleted) {
			if (entry.slug && !entry._draft) {
				const filePath = `src/content/bangumi/${entry.slug}.md`;
				const file = await getRepoFile(filePath, repoConfig);
				if (file && file.sha) {
					const ok = await deleteRepoFile(
						filePath,
						file.sha,
						`chore(${pageKey}): remove ${entry.slug}`,
						repoConfig,
					);
					if (!ok) allOk = false;
				}
			}
			continue;
		}

		const md = buildBangumiMd(entry);
		let slug = entry.slug;

		if (entry._draft || !slug) {
			slug = slugify(entry.title);
			const filePath = `src/content/bangumi/${slug}.md`;
			const ok = await createRepoFile(
				filePath,
				md,
				`chore(${pageKey}): add ${slug}`,
				repoConfig,
			);
			if (!ok) allOk = false;
		} else {
			const filePath = `src/content/bangumi/${slug}.md`;
			let sha = entry.sha;
			if (!sha) {
				const file = await getRepoFile(filePath, repoConfig);
				if (file) sha = file.sha;
			}
			if (sha) {
				const ok = await updateRepoFile(
					filePath,
					md,
					sha,
					`chore(${pageKey}): update ${slug}`,
					repoConfig,
				);
				if (!ok) allOk = false;
			} else {
				const ok = await createRepoFile(
					filePath,
					md,
					`chore(${pageKey}): create ${slug}`,
					repoConfig,
				);
				if (!ok) allOk = false;
			}
		}
	}

	return allOk;
}

function handleSaveDraft() {
	drafts.saveToDrafts();
}

async function handleSubmit() {
	if (modalItem) {
		closeModal();
	}
	if (!hasValidToken()) {
		showToast("GitHub 代理未配置，请联系管理员", "warning");
		return;
	}
	saving = true;
	try {
		const ok = await submitItems(items);
		if (ok) {
			showToast("保存成功！页面将刷新以应用更改", "success");
			drafts.clearDrafts();
			originalItems = deepClone(items);
			originalItemsJson = serializeItems();
			setTimeout(() => window.location.reload(), 1200);
		} else {
			showToast("部分操作失败，请检查 GitHub App 权限配置", "error");
		}
	} catch (err) {
		showToast("保存出错：" + (err as Error).message, "error");
		console.error(err);
	} finally {
		saving = false;
	}
}

registerSubmitHandler(pageKey, async (draft) => {
	if (draft.payload?.type === "repo" && draft.payload.content !== undefined) {
		let parsedItems: BangumiItem[] = [];
		try {
			const parsed = JSON.parse(String(draft.payload.content));
			if (Array.isArray(parsed)) {
				parsedItems = parsed.map((e: any) => ({
					id: e.id || genId("bg"),
					slug: e.slug || "",
					title: e.title || "",
					name_cn: e.name_cn || "",
					category: e.category || "anime",
					subcategory: e.subcategory,
					status: e.status || 2,
					score: e.score || 0,
					image: e.image || "",
					tags: Array.isArray(e.tags) ? e.tags : [],
					comment: e.comment || "",
					published: e.published || new Date().toISOString().slice(0, 10),
					_draft: !!e._draft,
					_deleted: !!e._deleted,
				}));
			}
		} catch {
			return false;
		}
		return await submitItems(parsedItems);
	}
	return false;
});

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		closeModal();
	}
}
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
          >
            <div class="bg-card-actions">
              <button class="bg-action-btn bg-action-edit" onclick={() => openEditModal(i)} title="编辑">
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

  <!-- Modal -->
  {#if modalItem}
    <div class="bg-modal-overlay" onclick={closeModal} onkeydown={handleKeydown} tabindex="0">
      <div class="bg-modal" onclick={(e) => e.stopPropagation()}>
        <div class="bg-modal-header">
          <iconify-icon icon="material-symbols:edit-document-outline-rounded"></iconify-icon>
          <span>{modalMode === "add" ? "添加条目" : "编辑条目"}</span>
          <button class="bg-modal-close" onclick={closeModal}>
            <iconify-icon icon="material-symbols:close-rounded"></iconify-icon>
          </button>
        </div>

        <div class="bg-modal-body">
          <div class="bg-form-grid">
            <div class="bg-form-group">
              <label>标题 *</label>
              <input
                type="text"
                class="bg-input"
                bind:value={modalItem.title}
                placeholder="条目标题"
              />
            </div>
            <div class="bg-form-group">
              <label>中文名称</label>
              <input
                type="text"
                class="bg-input"
                bind:value={modalItem.name_cn}
                placeholder="中文名称（可选）"
              />
            </div>
          </div>

          <div class="bg-form-grid">
            <div class="bg-form-group">
              <label>分类</label>
              <select class="bg-select" bind:value={modalItem.category}>
                {#each Object.entries(categoryMap) as [key, val]}
                  <option value={key}>{val.name}</option>
                {/each}
              </select>
            </div>
            <div class="bg-form-group">
              <label>状态</label>
              <select class="bg-select" bind:value={modalItem.status}>
                {#each Object.entries(statusMap) as [key, val]}
                  <option value={key}>{val.name}</option>
                {/each}
              </select>
            </div>
            <div class="bg-form-group">
              <label>评分 (0-10)</label>
              <input
                type="number"
                class="bg-input"
                bind:value={modalItem.score}
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
              bind:value={modalItem.image}
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
              bind:value={modalItem.comment}
              rows={4}
              placeholder="简单的评价或介绍..."
              spellcheck="false"
            ></textarea>
          </div>

          <div class="bg-form-grid">
            <div class="bg-form-group">
              <label>日期</label>
              <input
                type="date"
                class="bg-input"
                bind:value={modalItem.published}
              />
            </div>
          </div>
        </div>

        <div class="bg-modal-footer">
          <button class="bg-btn bg-btn-cancel" onclick={closeModal}>取消</button>
          <button class="bg-btn bg-btn-save" onclick={saveModal}>保存</button>
        </div>
      </div>
    </div>
  {/if}
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

  /* Modal */
  .bg-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  .bg-modal {
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    background: var(--card-bg, white);
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
  }
  :global(.dark) .bg-modal {
    background: #1a1a2e;
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .bg-modal-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px;
    font-size: 15px;
    font-weight: 600;
    color: hsl(var(--theme-hue, 165), 70%, 45%);
    border-bottom: 1px solid var(--border, rgba(0,0,0,0.08));
  }
  .bg-modal-close {
    margin-left: auto;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--content-meta, #6b7280);
    font-size: 18px;
  }
  .bg-modal-close:hover {
    background: var(--bg-secondary, #f3f4f6);
  }

  .bg-modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .bg-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }
  .bg-form-group {
    margin-bottom: 12px;
  }
  .bg-form-group label {
    display: block;
    font-size: 12px;
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
    padding: 8px 12px;
    border: 1.5px solid var(--border, #d1d5db);
    border-radius: 8px;
    font-size: 13px;
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
    min-height: 80px;
  }

  .bg-modal-footer {
    display: flex;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--border, rgba(0,0,0,0.08));
  }
  .bg-btn {
    flex: 1;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
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
    .bg-form-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
