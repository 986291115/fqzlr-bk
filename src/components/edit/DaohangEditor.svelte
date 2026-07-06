<script lang="ts">
import { onMount } from "svelte";
import {
	showToast,
	genId,
	deepClone,
	ensureIconify,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";

interface DaohangItem {
	id?: string;
	name: string;
	url: string;
	description: string;
	category: string;
	icon?: string;
	order?: number;
	enabled: boolean;
	_draft?: boolean;
}

let editMode = $state(false);
let saving = $state(false);
let items = $state<DaohangItem[]>([]);
let originalItems = $state<DaohangItem[]>([]);
let editingIndex = $state(-1);
let activeTab = $state("all");
let fileSha = $state<string | null>(null);

const drafts = setupRepoDrafts({
	pageKey: "daohang",
	pageName: "导航",
	getContent: () => JSON.stringify(items, null, 2),
	setContent: (v) => (items = JSON.parse(v)),
	getPath: () => "public/daohang.json",
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => JSON.stringify(originalItems, null, 2),
	setOriginalContent: (v) => (originalItems = JSON.parse(v)),
	getCommitMsg: (isEdit) =>
		isEdit ? `chore: update daohang` : `chore: create daohang`,
	onSubmitted: () => {
		setTimeout(() => window.location.reload(), 1200);
	},
});

let hasChanges = $derived(drafts.hasLocalChanges());

$effect(() => {
	window.dispatchEvent(
		new CustomEvent("edit:hasChanges", {
			detail: { pageKey: "daohang", hasChanges },
		}),
	);
});

onMount(() => {
	ensureIconify();
	collectFromDOM();
	drafts.restoreFromDrafts();

	// 监听侧边栏编辑按钮事件
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

function handleSidebarModeChange(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "daohang") return;
	if (detail.editing) {
		editMode = true;
		hideSSRGrid();
		editingIndex = -1;
		activeTab = "all";
	} else {
		editMode = false;
		showSSRGrid();
	}
}

function handleSidebarSaveDraft(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "daohang") return;
	handleSaveDraft();
}

function handleSidebarSubmit(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "daohang") return;
	handleSubmit();
}

function handleSidebarCancel(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "daohang") return;
	handleCancel();
}

function handleSidebarAdd(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "daohang") return;
	handleAdd();
}

function collectFromDOM() {
	const allSection = document.querySelector('[data-tools-section="all"]');
	if (!allSection) return;
	const cards = allSection.querySelectorAll(".tools-card");
	const collected: DaohangItem[] = [];
	cards.forEach((el) => {
		const card = el as HTMLElement;
		const link = card.querySelector("a") || card;
		const href = card.getAttribute("href") || link.getAttribute("href") || "";
		const name = card.querySelector("h3")?.textContent?.trim() || "";
		const desc = card.querySelector(".tools-card-desc")?.textContent?.trim() || "";
		const category = card.dataset.category || "";
		const iconEl = card.querySelector("img") as HTMLImageElement | null;
		const icon = iconEl?.src || "";
		collected.push({
			id: genId("dh"),
			name,
			url: href,
			description: desc,
			category,
			icon,
			order: collected.length,
			enabled: true,
		});
	});
	if (collected.length > 0) {
		items = collected;
		originalItems = deepClone(collected);
	}
}

const enabledItems = $derived(items.filter((i) => i.enabled !== false));
const allCategories = $derived([
	...new Set(items.map((i) => i.category).filter(Boolean)),
]);
const enabledCategories = $derived([
	...new Set(enabledItems.map((i) => i.category).filter(Boolean)),
]);
const categories = $derived(editMode ? allCategories : enabledCategories);
const categoryCounts = $derived.by(() => {
	const counts: Record<string, number> = {};
	const source = editMode ? items : enabledItems;
	for (const item of source) {
		counts[item.category] = (counts[item.category] || 0) + 1;
	}
	return counts;
});
const sourceItems = $derived(editMode ? items : enabledItems);
const displayItems = $derived(
	activeTab === "all"
		? sourceItems
		: sourceItems.filter((i) => i.category === activeTab),
);
const groupedItems = $derived.by(() => {
	const groups: Record<string, DaohangItem[]> = {};
	if (activeTab === "all" && !editMode) {
		for (const cat of enabledCategories) {
			groups[cat] = enabledItems.filter((i) => i.category === cat);
		}
	}
	return groups;
});

function handleModeChange(e: CustomEvent) {
	editMode = e.detail.editing;
	if (editMode) {
		hideSSRGrid();
		editingIndex = -1;
		activeTab = "all";
	} else {
		showSSRGrid();
	}
}

function hideSSRGrid() {
	const grid = document.getElementById("daohang-grid");
	if (grid) grid.style.display = "none";
}

function showSSRGrid() {
	const grid = document.getElementById("daohang-grid");
	if (grid) grid.style.display = "";
}

function handleCancel() {
	editMode = false;
	items = deepClone(originalItems);
	drafts.clearDrafts();
	editingIndex = -1;
	activeTab = "all";
	showSSRGrid();
}

function switchTab(tab: string) {
	activeTab = tab;
}

function moveUp(index: number) {
	if (index <= 0) return;
	const item = displayItems[index];
	const prevItem = displayItems[index - 1];
	const globalIdx = items.indexOf(item);
	const prevGlobalIdx = items.indexOf(prevItem);
	if (globalIdx < 0 || prevGlobalIdx < 0) return;
	const arr = [...items];
	[arr[prevGlobalIdx], arr[globalIdx]] = [arr[globalIdx], arr[prevGlobalIdx]];
	items = arr;
	if (editingIndex === globalIdx) editingIndex = prevGlobalIdx;
	else if (editingIndex === prevGlobalIdx) editingIndex = globalIdx;
}

function moveDown(index: number) {
	if (index >= displayItems.length - 1) return;
	const item = displayItems[index];
	const nextItem = displayItems[index + 1];
	const globalIdx = items.indexOf(item);
	const nextGlobalIdx = items.indexOf(nextItem);
	if (globalIdx < 0 || nextGlobalIdx < 0) return;
	const arr = [...items];
	[arr[globalIdx], arr[nextGlobalIdx]] = [arr[nextGlobalIdx], arr[globalIdx]];
	items = arr;
	if (editingIndex === globalIdx) editingIndex = nextGlobalIdx;
	else if (editingIndex === nextGlobalIdx) editingIndex = globalIdx;
}

function startEdit(index: number) {
	const item = displayItems[index];
	editingIndex = items.indexOf(item);
}

function finishEdit(index: number) {
	const item = items[index];
	if (!item.name.trim()) {
		showToast("名称不能为空", "warning");
		return;
	}
	if (!item.url.trim()) {
		showToast("链接不能为空", "warning");
		return;
	}
	editingIndex = -1;
	showToast("已修改，记得点击保存", "info");
}

function cancelItemEdit(index: number) {
	const item = items[index];
	if (item._draft && !item.name.trim()) {
		items = items.filter((_, i) => i !== index);
	} else {
		const orig = originalItems.find(
			(o) => (o.id || o.url) === (item.id || item.url) && !item._draft,
		);
		if (orig) {
			items[index] = deepClone(orig);
			items = [...items];
		}
	}
	editingIndex = -1;
}

function deleteItem(index: number) {
	const item = displayItems[index];
	const globalIdx = items.indexOf(item);
	if (!confirm(`确定要删除「${item.name || "该条目"}」吗？`)) return;
	items = items.filter((_, i) => i !== globalIdx);
	if (editingIndex === globalIdx) editingIndex = -1;
	else if (editingIndex > globalIdx) editingIndex--;
	showToast("已删除，记得点击保存", "info");
}

function handleAdd() {
	const defaultCategory = categories[0] || "";
	const newItem: DaohangItem = {
		id: genId("dh"),
		name: "",
		url: "",
		description: "",
		category: defaultCategory,
		icon: "",
		order: items.length,
		enabled: true,
		_draft: true,
	};
	items = [...items, newItem];
	editingIndex = items.length - 1;
	activeTab = "all";
}

function handleSaveDraft() {
	const cleanData = items.map(({ _draft, ...rest }) => ({
		...rest,
		id: rest.id || genId("dh"),
		enabled: rest.enabled !== false,
	}));
	items = cleanData;
	drafts.saveToDrafts();
}

async function handleSubmit() {
	if (editingIndex >= 0) {
		finishEdit(editingIndex);
		if (editingIndex >= 0) return;
	}
	saving = true;
	try {
		const cleanData = items.map(({ _draft, ...rest }) => ({
			...rest,
			id: rest.id || genId("dh"),
			enabled: rest.enabled !== false,
		}));
		items = cleanData;
		await drafts.submitDrafts();
	} finally {
		saving = false;
	}
}

function updateField(
	index: number,
	field: keyof DaohangItem,
	value: string | boolean,
) {
	items[index] = { ...items[index], [field]: value } as DaohangItem;
	items = [...items];
}

function getHostname(url: string) {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

function isHttpIcon(icon?: string) {
	return icon && icon.startsWith("http");
}
</script>

<!-- Tab 分类导航（仅编辑模式显示） -->
{#if editMode && categories.length > 1}
	<div class="daohang-tab-wrapper">
		<div class="daohang-tab-pill">
			<button
				class="daohang-tab-btn"
				class:daohang-tab-btn-active={activeTab === "all"}
				class:daohang-tab-btn-inactive={activeTab !== "all"}
				onclick={() => switchTab("all")}
			>
				全部
				<span class="daohang-tab-badge">{sourceItems.length}</span>
			</button>
			{#each categories as cat}
				<button
					class="daohang-tab-btn"
					class:daohang-tab-btn-active={activeTab === cat}
					class:daohang-tab-btn-inactive={activeTab !== cat}
					onclick={() => switchTab(cat)}
				>
					{cat}
					<span class="daohang-tab-badge">{categoryCounts[cat] || 0}</span>
				</button>
			{/each}
		</div>
	</div>
{/if}

<!-- 编辑模式：可编辑网格 -->
{#if editMode}
	<div class="edit-daohang-grid" id="edit-daohang-grid">
		{#each displayItems as item, i (i + "-" + (item.id || item.url))}
			{@const globalIdx = items.indexOf(item)}
			<div
				class="edit-daohang-card"
				class:edit-daohang-card-draft={item._draft}
				class:edit-daohang-card-editing={editingIndex === globalIdx}
				class:edit-daohang-card-disabled={item.enabled === false}
			>
				{#if editingIndex !== globalIdx}
					<div class="card-action-row">
						{#if i > 0}
							<button class="action-btn action-move" onclick={() => moveUp(i)} title="上移">
								<iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
							</button>
						{/if}
						{#if i < displayItems.length - 1}
							<button class="action-btn action-move" onclick={() => moveDown(i)} title="下移">
								<iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon>
							</button>
						{/if}
						<button class="action-btn action-edit" onclick={() => startEdit(i)} title="编辑">
							<iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
						</button>
						<button class="action-btn action-delete" onclick={() => deleteItem(i)} title="删除">
							<iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
						</button>
					</div>

					<div class="card-display">
						{#if item.category}
							<span class="card-category-badge">{item.category}</span>
						{/if}
						{#if item.enabled === false}
							<span class="card-disabled-badge">已禁用</span>
						{/if}
						<div class="card-icon-wrap">
							{#if isHttpIcon(item.icon)}
								<img
									src={item.icon}
									alt={item.name}
									class="card-icon-img"
									loading="lazy"
									onerror={(e) => ((e.target as HTMLImageElement).style.opacity = '0')}
								/>
							{:else if item.icon}
								<iconify-icon icon={item.icon} class="card-icon-iconify"></iconify-icon>
							{:else}
								<div class="card-icon-placeholder">
									<iconify-icon icon="material-symbols:link-rounded"></iconify-icon>
								</div>
							{/if}
						</div>
						<div class="card-info">
							<h3 class="card-title">{item.name || "（未命名）"}</h3>
							<p class="card-desc">{item.description || "暂无描述"}</p>
							<p class="card-url">{getHostname(item.url)}</p>
						</div>
					</div>
				{:else}
					<div class="card-edit-form">
						<div class="edit-form-header">
							<iconify-icon icon="material-symbols:edit-document-outline-rounded" class="text-lg"></iconify-icon>
							<span>编辑导航</span>
							{#if item._draft}
								<span class="draft-badge">新增</span>
							{/if}
						</div>
						<div class="form-group">
							<label>名称</label>
							<input
								type="text"
								value={item.name}
								oninput={(e) => updateField(globalIdx, "name", (e.target as HTMLInputElement).value)}
								placeholder="站点名称"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>链接 (URL)</label>
							<input
								type="text"
								value={item.url}
								oninput={(e) => updateField(globalIdx, "url", (e.target as HTMLInputElement).value)}
								placeholder="https://example.com"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>图标 URL</label>
							<input
								type="text"
								value={item.icon || ""}
								oninput={(e) => updateField(globalIdx, "icon", (e.target as HTMLInputElement).value)}
								placeholder="https://example.com/favicon.png 或 iconify 图标名"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>描述</label>
							<textarea
								value={item.description}
								oninput={(e) => updateField(globalIdx, "description", (e.target as HTMLTextAreaElement).value)}
								placeholder="站点描述"
								class="form-textarea"
								rows={2}
							></textarea>
						</div>
						<div class="form-group">
							<label>分类</label>
							<input
								type="text"
								value={item.category}
								oninput={(e) => updateField(globalIdx, "category", (e.target as HTMLInputElement).value)}
								placeholder="分类名称"
								list={`category-list-${globalIdx}`}
								class="form-input"
							/>
							<datalist id={`category-list-${globalIdx}`}>
								{#each allCategories as cat}
									<option value={cat}>{cat}</option>
								{/each}
							</datalist>
						</div>
						<div class="form-group form-group-checkbox">
							<label class="checkbox-label">
								<input
									type="checkbox"
									checked={item.enabled !== false}
									onchange={(e) => updateField(globalIdx, "enabled", (e.target as HTMLInputElement).checked)}
									class="form-checkbox"
								/>
								<span>启用</span>
							</label>
						</div>
						<div class="form-actions">
							<button class="form-btn form-btn-cancel" onclick={() => cancelItemEdit(globalIdx)}>取消</button>
							<button class="form-btn form-btn-save" onclick={() => finishEdit(globalIdx)}>完成</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}

		{#if items.length === 0}
			<div class="empty-state">
				<iconify-icon icon="material-symbols:bookmark-outline-rounded" class="text-4xl mb-2 opacity-40"></iconify-icon>
				<p>暂无导航，点击"添加"开始添加</p>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Tab 分类导航 */
	.daohang-tab-wrapper {
		margin-bottom: 16px;
	}
	.daohang-tab-pill {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		padding: 4px;
		border-radius: 12px;
		background: var(--bg-secondary, #f3f4f6);
		width: fit-content;
	}
	:global(.dark) .daohang-tab-pill {
		background: rgba(255, 255, 255, 0.05);
	}
	.daohang-tab-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		transition: all 0.15s;
		background: transparent;
		color: var(--text-secondary, #6b7280);
	}
	:global(.dark) .daohang-tab-btn {
		color: #9ca3af;
	}
	.daohang-tab-btn:hover {
		color: var(--text-color, #1f2937);
		background: var(--card-bg, white);
	}
	:global(.dark) .daohang-tab-btn:hover {
		color: #e5e7eb;
		background: rgba(255, 255, 255, 0.08);
	}
	.daohang-tab-btn-active {
		background: var(--card-bg, white) !important;
		color: var(--text-color, #1f2937) !important;
		font-weight: 600;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	:global(.dark) .daohang-tab-btn-active {
		background: rgba(255, 255, 255, 0.12) !important;
		color: #f0f0f0 !important;
	}
	.daohang-tab-badge {
		padding: 1px 7px;
		border-radius: 999px;
		font-size: 11px;
		background: var(--border, #e5e7eb);
		color: var(--text-secondary, #6b7280);
	}
	:global(.dark) .daohang-tab-badge {
		background: rgba(255, 255, 255, 0.1);
		color: #9ca3af;
	}
	.daohang-tab-btn-active .daohang-tab-badge {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
	}

	/* 编辑模式网格 */
	.edit-daohang-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
	}

	.edit-daohang-card {
		position: relative;
		border-radius: 16px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
		overflow: hidden;
		transition: all 0.2s;
	}
	:global(.dark) .edit-daohang-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255, 255, 255, 0.08);
	}
	.edit-daohang-card:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
	}
	.edit-daohang-card-draft {
		border-style: dashed;
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
	}
	.edit-daohang-card-editing {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	.edit-daohang-card-disabled {
		opacity: 0.55;
	}

	.card-action-row {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		gap: 4px;
		z-index: 10;
		opacity: 1;
		transition: opacity 0.2s;
	}
	.edit-daohang-card:hover .card-action-row {
		opacity: 1;
	}
	.action-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		font-size: 16px;
		backdrop-filter: blur(8px);
		transition: all 0.15s;
		color: white;
	}
	.action-btn iconify-icon { display: flex; }
	.action-move { background: rgba(100, 116, 139, 0.85); }
	.action-move:hover { background: rgba(71, 85, 105, 0.95); transform: scale(1.1); }
	.action-edit { background: rgba(59, 130, 246, 0.85); }
	.action-edit:hover { background: rgba(37, 99, 235, 0.95); transform: scale(1.1); }
	.action-delete { background: rgba(239, 68, 68, 0.85); }
	.action-delete:hover { background: rgba(220, 38, 38, 0.95); transform: scale(1.1); }

	.card-display { padding: 20px; cursor: default; }
	.card-category-badge {
		display: inline-block;
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
		margin-bottom: 12px;
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.12);
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.card-disabled-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 500;
		margin-bottom: 12px;
		margin-left: 6px;
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}
	.card-icon-wrap {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		overflow: hidden;
		margin-bottom: 12px;
		background: var(--btn-regular-bg, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	:global(.dark) .card-icon-wrap { background: rgba(255, 255, 255, 0.05); }
	.card-icon-img { width: 100%; height: 100%; object-fit: contain; }
	.card-icon-iconify { font-size: 24px; color: var(--text-secondary, #6b7280); }
	:global(.dark) .card-icon-iconify { color: #9ca3af; }
	.card-icon-placeholder {
		width: 100%; height: 100%;
		display: flex; align-items: center; justify-content: center;
		color: var(--content-meta, #9ca3af); font-size: 22px;
	}
	.card-title {
		margin: 0 0 4px; font-size: 15px; font-weight: 700;
		color: var(--text-color, #1f2937);
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
	:global(.dark) .card-title { color: #f0f0f0; }
	.card-desc {
		margin: 0 0 6px; font-size: 13px;
		color: var(--text-secondary, #6b7280); line-height: 1.5;
		display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
	}
	:global(.dark) .card-desc { color: #9ca3af; }
	.card-url {
		margin: 0; font-size: 11px; color: var(--content-meta, #9ca3af);
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}

	.card-edit-form { padding: 20px; }
	.edit-form-header {
		display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
		font-size: 14px; font-weight: 600; color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.draft-badge {
		padding: 1px 8px; border-radius: 999px;
		background: hsl(var(--theme-hue, 165), 70%, 50%); color: white;
		font-size: 11px; font-weight: 600;
	}
	.form-group { margin-bottom: 12px; }
	.form-group label {
		display: block; font-size: 12px; font-weight: 600;
		color: var(--text-secondary, #4b5563); margin-bottom: 4px;
	}
	:global(.dark) .form-group label { color: #d1d5db; }
	.form-input, .form-textarea, .form-select {
		width: 100%; padding: 8px 12px;
		border: 1.5px solid var(--border, #d1d5db); border-radius: 8px;
		font-size: 13px; background: var(--bg-color, white);
		color: var(--text-color, #1f2937); outline: none;
		transition: border-color 0.2s; box-sizing: border-box; font-family: inherit;
	}
	:global(.dark) .form-input, :global(.dark) .form-textarea, :global(.dark) .form-select {
		background: #0f0f1a; border-color: #374151; color: #e5e7eb;
	}
	.form-input:focus, .form-textarea:focus, .form-select:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	.form-textarea { resize: vertical; min-height: 50px; }
	.form-group-checkbox { margin-bottom: 16px; }
	.checkbox-label {
		display: flex !important; align-items: center; gap: 8px;
		cursor: pointer; font-weight: 500 !important;
	}
	.form-checkbox {
		width: 16px; height: 16px;
		accent-color: hsl(var(--theme-hue, 165), 70%, 50%); cursor: pointer;
	}
	.form-actions { display: flex; gap: 8px; margin-top: 16px; }
	.form-btn {
		flex: 1; padding: 8px; border-radius: 8px; font-size: 13px;
		font-weight: 600; cursor: pointer; transition: all 0.15s;
		border: none; display: flex; align-items: center; justify-content: center;
	}
	.form-btn-cancel { background: var(--bg-secondary, #f3f4f6); color: var(--text-color, #374151); }
	.form-btn-cancel:hover { background: var(--border, #e5e7eb); }
	:global(.dark) .form-btn-cancel { background: #2d2d44; color: #d1d5db; }
	.form-btn-save { background: hsl(var(--theme-hue, 165), 70%, 50%); color: white; }
	.form-btn-save:hover { background: hsl(var(--theme-hue, 165), 75%, 45%); }

	.empty-state {
		grid-column: 1 / -1; text-align: center; padding: 48px 20px;
		color: var(--content-meta, #9ca3af); font-size: 14px;
	}
</style>