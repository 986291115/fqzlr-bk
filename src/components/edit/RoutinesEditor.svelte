<script lang="ts">
import { onMount } from "svelte";
import { marked } from "marked";
import {
	hasValidToken,
	showToast,
	ensureIconify,
	getRepoFile,
	genId,
	deepClone,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";

interface RoutineItem {
	id: string;
	name: string;
	time: string;
	icon: string;
	color: string;
	description: string;
	body: string;
	updatedAt: string;
	order: number;
	enabled: boolean;
	_draft?: boolean;
	_deleted?: boolean;
}

let editMode = $state(false);
let saving = $state(false);
let routines = $state<RoutineItem[]>([]);
let originalRoutines = $state<RoutineItem[]>([]);
let editingIndex = $state(-1);
let editPreview = $state("");
let repoLoaded = $state(false);
let fileSha = $state<string | null>(null);
let originalTS = $state<string>("");

const emojiOptions = [
	"📌", "📝", "🎯", "⏰", "💪", "🧘", "📚", "💤",
	"🏃", "🍎", "💧", "☀️", "🌙", "✅", "🚀", "🔥",
	"💡", "🎨", "🎵", "❤️",
];

const pageKey = "routines";
const pageName = "日常规划";

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

function parseRoutinesFromTS(tsContent: string): RoutineItem[] {
	const items = parseArrayFromTS(tsContent, "export const routinesConfig: RoutineItem[] = [");
	return items.map((item: any, index: number) => ({
		id: item.id || `routine-${index}`,
		name: item.name || "",
		time: item.time || "",
		icon: item.icon || "📌",
		color: item.color || "",
		description: item.description || "",
		body: item.body || "",
		updatedAt: item.updatedAt || new Date().toISOString().slice(0, 10),
		order: typeof item.order === "number" ? item.order : index + 1,
		enabled: item.enabled !== false,
	}));
}

function buildRoutineObject(r: RoutineItem): string {
	const obj: any = {
		id: r.id,
		name: r.name,
		time: r.time,
		icon: r.icon,
		color: r.color,
		description: r.description,
		body: r.body,
		updatedAt: r.updatedAt,
		order: r.order,
		enabled: r.enabled !== false,
	};

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

function buildRoutinesConfigTS(
	routineList: RoutineItem[],
	originalContent?: string,
): string {
	const routineEntries = routineList.map((r) => buildRoutineObject(r));
	const routinesArrayContent = routineEntries.join("\n");

	if (originalContent) {
		let result = originalContent;
		result = replaceArrayInTS(
			result,
			"export const routinesConfig: RoutineItem[] = [",
			routinesArrayContent,
		);
		return result;
	}

	return `/**
 * 日常规划页面配置
 * 用于管理日常规划展示的内容
 */

// 日常规划项类型定义
export interface RoutineItem {
	id: string;
	name: string;
	time: string;
	icon: string;
	color: string;
	description: string;
	body: string;
	updatedAt: string;
	order: number;
	enabled: boolean;
}

// 日常规划页面配置
export interface RoutinePageConfig {
	title?: string;
	description?: string;
}

// 日常规划页面配置
export const routinePageConfig: RoutinePageConfig = {
	title: "日常规划",
	description: "记录和规划生活中的各项事务",
};

// 日常规划列表配置
export const routinesConfig: RoutineItem[] = [
${routinesArrayContent}
];

// 获取所有日常规划（按 order 排序，相同 order 按 updatedAt 倒序）
export function getAllRoutines(): RoutineItem[] {
	return [...routinesConfig].sort((a, b) => {
		if (a.order !== b.order) return a.order - b.order;
		return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
	});
}

// 获取启用的日常规划
export function getEnabledRoutines(): RoutineItem[] {
	return getAllRoutines().filter((r) => r.enabled !== false);
}
`;
}

const drafts = setupRepoDrafts({
	pageKey,
	pageName,
	getContent: () =>
		buildRoutinesConfigTS(
			routines.filter((m) => !m._deleted),
			originalTS,
		),
	setContent: (v) => {
		const parsed = parseRoutinesFromTS(v);
		if (parsed.length > 0 || v.includes("routinesConfig")) {
			routines = parsed;
		}
	},
	getPath: () => "src/config/routinesConfig.ts",
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => originalTS,
	setOriginalContent: (v) => (originalTS = v),
	getCommitMsg: (isEdit) =>
		isEdit ? `chore(routines): 更新日常规划` : `chore(routines): 创建日常规划配置`,
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

onMount(() => {
	ensureIconify();
	collectFromDOM();
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

function handleSidebarModeChange(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== pageKey) return;
	if (detail.editing) {
		editMode = true;
		hideSSRContent();
		editingIndex = -1;
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

function htmlToMarkdown(html: string): string {
	if (!html) return "";
	return html
		.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n")
		.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n")
		.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n")
		.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "#### $1\n")
		.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n")
		.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
		.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
		.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
		.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
		.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
		.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
		.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, "$1")
		.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, "$1")
		.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<hr\s*\/?>/gi, "---\n")
		.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "> $1\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.trim();
}

function collectFromDOM() {
	const result: RoutineItem[] = [];
	document.querySelectorAll(".routine-card").forEach((card, index) => {
		const iconEl = card.querySelector(".routine-icon-wrap span");
		const icon = iconEl?.textContent?.trim() || "📌";
		const nameEl = card.querySelector(".routine-title");
		const name = nameEl?.textContent?.trim() || "";
		const timeEl = card.querySelector(".routine-time");
		const time = timeEl?.textContent?.trim() || "";
		const descEl = card.querySelector(".routine-desc");
		const description = descEl?.textContent?.trim() || "";
		const contentEl = card.querySelector(".routine-content");
		const bodyHtml = contentEl?.innerHTML || "";
		const body = htmlToMarkdown(bodyHtml);
		result.push({
			id: genId("rt"),
			name,
			time,
			icon,
			color: "",
			description,
			body,
			updatedAt: new Date().toISOString().slice(0, 10),
			order: index + 1,
			enabled: true,
		});
	});
	routines = result;
	originalRoutines = deepClone(result);
}

async function loadRepoData() {
	const existing = await getRepoFile("src/config/routinesConfig.ts");
	if (existing && existing.content) {
		try {
			const repoRoutines: RoutineItem[] = parseRoutinesFromTS(existing.content);
			originalTS = existing.content;
			fileSha = existing.sha || null;

			const repoMap = new Map(repoRoutines.map((m) => [m.id, m]));
			routines = routines.map((m) => {
				const repoItem = repoMap.get(m.id);
				if (repoItem) {
					return {
						...m,
						enabled: repoItem.enabled ?? m.enabled,
						order: repoItem.order ?? m.order,
						color: repoItem.color ?? m.color,
					};
				}
				return m;
			});

			const existingIds = new Set(routines.map((m) => m.id));
			for (const g of repoRoutines) {
				if (!existingIds.has(g.id)) {
					routines = [...routines, { ...g, id: g.id || genId("rt") }];
					existingIds.add(g.id);
				}
			}

			originalRoutines = deepClone(routines);
		} catch (e) {
			console.error("Failed to parse repo routines:", e);
		}
	} else {
		originalTS = buildRoutinesConfigTS(routines);
	}
	repoLoaded = true;
	drafts.restoreFromDrafts();
}

function hideSSRContent() {
	document.querySelectorAll(".routine-card").forEach((c) => ((c as HTMLElement).style.display = "none"));
	const grids = document.querySelectorAll(".routines-grid");
	grids.forEach((g) => ((g as HTMLElement).style.display = "none"));
	const empty = document.querySelector(".w-full.p-12.text-center");
	if (empty) (empty as HTMLElement).style.display = "none";
	const stats = document.querySelector(".stat-pill")?.parentElement;
	if (stats) (stats as HTMLElement).style.display = "none";
}

function showSSRContent() {
	document.querySelectorAll(".routine-card").forEach((c) => ((c as HTMLElement).style.display = ""));
	const grids = document.querySelectorAll(".routines-grid");
	grids.forEach((g) => ((g as HTMLElement).style.display = ""));
	const empty = document.querySelector(".w-full.p-12.text-center");
	if (empty) (empty as HTMLElement).style.display = "";
	const stats = document.querySelector(".stat-pill")?.parentElement;
	if (stats) (stats as HTMLElement).style.display = "";
}

function handleCancel() {
	editMode = false;
	routines = deepClone(originalRoutines);
	editingIndex = -1;
	drafts.clearDrafts();
	showSSRContent();
}

function startEdit(index: number) {
	editingIndex = index;
	updatePreview(index);
}

function updatePreview(index: number) {
	const r = routines[index];
	if (!r) {
		editPreview = "";
		return;
	}
	try {
		editPreview = marked.parse(r.body || "", {
			gfm: true,
			breaks: true,
		}) as string;
	} catch {
		editPreview = r.body || "";
	}
}

function updateField(
	index: number,
	field: keyof RoutineItem,
	value: string | number | boolean,
) {
	routines[index] = { ...routines[index], [field]: value };
	routines = [...routines];
	if (field === "body") updatePreview(index);
}

function finishEdit(index: number) {
	const r = routines[index];
	if (!r.name.trim()) {
		showToast("名称不能为空", "warning");
		return;
	}
	editingIndex = -1;
	showToast("已修改，记得点击保存", "info");
}

function cancelItemEdit(index: number) {
	const r = routines[index];
	if (r._draft && !r.name.trim()) {
		routines = routines.filter((_, i) => i !== index);
	} else {
		const orig = originalRoutines.find((o) => o.id === r.id && !r._draft);
		if (orig) {
			routines[index] = deepClone(orig);
			routines = [...routines];
		}
	}
	editingIndex = -1;
}

function deleteItem(index: number) {
	const r = routines[index];
	if (!confirm(`确定要删除「${r.name}」吗？`)) return;
	if (r._draft) {
		routines = routines.filter((_, i) => i !== index);
	} else {
		routines[index] = { ...routines[index], _deleted: true };
		routines = [...routines];
	}
	if (editingIndex === index) editingIndex = -1;
	else if (editingIndex > index) editingIndex--;
	showToast("已标记删除，记得点击保存", "info");
}

function moveUp(index: number) {
	if (index <= 0) return;
	const arr = [...routines];
	[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
	const tempOrder = arr[index - 1].order;
	arr[index - 1].order = arr[index].order;
	arr[index].order = tempOrder;
	routines = arr;
	if (editingIndex === index) editingIndex = index - 1;
	else if (editingIndex === index - 1) editingIndex = index;
}

function moveDown(index: number) {
	if (index >= routines.length - 1) return;
	const arr = [...routines];
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
	const tempOrder = arr[index].order;
	arr[index].order = arr[index + 1].order;
	arr[index + 1].order = tempOrder;
	routines = arr;
	if (editingIndex === index) editingIndex = index + 1;
	else if (editingIndex === index + 1) editingIndex = index;
}

function restoreItem(index: number) {
	routines[index] = { ...routines[index], _deleted: false };
	routines = [...routines];
}

function handleAdd() {
	const maxOrder = routines.length > 0 ? Math.max(...routines.map((r) => r.order)) : 0;
	routines = [
		{
			id: genId("rt"),
			name: "",
			time: "",
			icon: "📌",
			color: "",
			description: "",
			body: "",
			updatedAt: new Date().toISOString().slice(0, 10),
			order: maxOrder + 1,
			enabled: true,
			_draft: true,
		},
		...routines,
	];
	editingIndex = 0;
	editPreview = "";
}

function handleSaveDraft() {
	const cleanData = routines.map(({ _draft, _deleted, ...rest }) => ({
		...rest,
		id: rest.id || genId("rt"),
		enabled: rest.enabled !== false,
	}));
	routines = cleanData;
	drafts.saveToDrafts();
}

async function handleSubmit() {
	if (editingIndex >= 0) {
		finishEdit(editingIndex);
		if (editingIndex >= 0) return;
	}
	if (!hasValidToken()) {
		showToast("GitHub 代理未配置，请联系管理员", "warning");
		return;
	}
	saving = true;
	try {
		const cleanData = routines.map(({ _draft, _deleted, ...rest }) => ({
			...rest,
			id: rest.id || genId("rt"),
			enabled: rest.enabled !== false,
		}));
		routines = cleanData;
		drafts.saveToDrafts();
		await drafts.submitDrafts();
	} catch (err) {
		showToast("保存出错：" + (err as Error).message, "error");
		console.error(err);
	} finally {
		saving = false;
	}
}
</script>

{#if editMode}
  <div class="rt-edit-list">
    {#each routines as r, i (i + "-" + r.id)}
      {#if !r._deleted}
        <div
          class="rt-card"
          class:rt-card-draft={r._draft}
          class:rt-card-editing={editingIndex === i}
        >
          {#if editingIndex !== i}
            <div class="rt-card-actions">
              {#if i > 0}
                <button class="rt-action-btn rt-action-move" onclick={() => moveUp(i)} title="上移">
                  <iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
                </button>
              {/if}
              {#if i < routines.filter(x => !x._deleted).length - 1}
                <button class="rt-action-btn rt-action-move" onclick={() => moveDown(i)} title="下移">
                  <iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon>
                </button>
              {/if}
              <button class="rt-action-btn rt-action-edit" onclick={() => startEdit(i)} title="编辑">
                <iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
              </button>
              <button class="rt-action-btn rt-action-delete" onclick={() => deleteItem(i)} title="删除">
                <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
              </button>
            </div>
            <div class="rt-card-display">
              <div class="rt-card-header">
                <div class="rt-icon-wrap"><span>{r.icon || "📌"}</span></div>
                <div class="rt-card-info">
                  <div class="rt-card-title-row">
                    <h3 class="rt-card-name">{r.name || "未命名"}</h3>
                    {#if r.time}<span class="rt-card-time">{r.time}</span>{/if}
                    {#if r._draft}<span class="rt-badge-draft">新增</span>{/if}
                  </div>
                  {#if r.description}<p class="rt-card-desc">{r.description}</p>{/if}
                </div>
              </div>
              {#if r.body}
                <div class="rt-card-body-preview">
                  {@html marked.parse(r.body.slice(0, 300) + (r.body.length > 300 ? "..." : ""), { gfm: true, breaks: true })}
                </div>
              {/if}
            </div>
          {:else}
            <div class="rt-card-form">
              <div class="rt-form-header">
                <iconify-icon icon="material-symbols:edit-document-outline-rounded"></iconify-icon>
                <span>编辑规划</span>
                {#if r._draft}<span class="rt-badge-draft">新增</span>{/if}
              </div>
              <div class="rt-form-row">
                <div class="rt-form-group rt-form-group-icon">
                  <label>图标</label>
                  <div class="rt-icon-picker">
                    <input
                      type="text"
                      class="rt-input rt-input-icon"
                      value={r.icon}
                      oninput={(e) => updateField(i, "icon", (e.target as HTMLInputElement).value)}
                      placeholder="📌"
                      maxlength="4"
                    />
                    <div class="rt-emoji-grid">
                      {#each emojiOptions as emoji}
                        <button
                          type="button"
                          class:rt-emoji-active={r.icon === emoji}
                          onclick={() => updateField(i, "icon", emoji)}
                        >
                          {emoji}
                        </button>
                      {/each}
                    </div>
                  </div>
                </div>
                <div class="rt-form-group">
                  <label>名称 *</label>
                  <input
                    type="text"
                    class="rt-input"
                    value={r.name}
                    oninput={(e) => updateField(i, "name", (e.target as HTMLInputElement).value)}
                    placeholder="规划名称"
                  />
                </div>
                <div class="rt-form-group">
                  <label>时间</label>
                  <input
                    type="text"
                    class="rt-input"
                    value={r.time}
                    oninput={(e) => updateField(i, "time", (e.target as HTMLInputElement).value)}
                    placeholder="如：早上 7:00-8:00"
                  />
                </div>
              </div>
              <div class="rt-form-group">
                <label>描述</label>
                <input
                  type="text"
                  class="rt-input"
                  value={r.description}
                  oninput={(e) => updateField(i, "description", (e.target as HTMLInputElement).value)}
                  placeholder="简短描述"
                />
              </div>
              <div class="rt-form-group">
                <label>颜色</label>
                <input
                  type="text"
                  class="rt-input"
                  value={r.color}
                  oninput={(e) => updateField(i, "color", (e.target as HTMLInputElement).value)}
                  placeholder="如：#22c55e"
                />
              </div>
              <div class="rt-form-group">
                <label>详细内容（Markdown）</label>
                <div class="rt-md-split">
                  <textarea
                    class="rt-md-textarea"
                    value={r.body}
                    oninput={(e) => updateField(i, "body", (e.target as HTMLTextAreaElement).value)}
                    placeholder="规划详细内容，支持 Markdown..."
                    spellcheck="false"
                  ></textarea>
                  <div class="rt-md-preview">{@html editPreview}</div>
                </div>
              </div>
              <div class="rt-form-group">
                <label>更新日期</label>
                <input
                  type="date"
                  class="rt-input rt-input-date"
                  value={r.updatedAt}
                  oninput={(e) => updateField(i, "updatedAt", (e.target as HTMLInputElement).value)}
                />
              </div>
              <div class="rt-form-group">
                <label>排序</label>
                <input
                  type="number"
                  class="rt-input"
                  value={r.order}
                  oninput={(e) => updateField(i, "order", parseInt((e.target as HTMLInputElement).value) || 0)}
                  placeholder="排序值，数字越小越靠前"
                />
              </div>
              <div class="rt-form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onchange={(e) => updateField(i, "enabled", (e.target as HTMLInputElement).checked)}
                  />
                  启用
                </label>
              </div>
              <div class="rt-form-actions">
                <button class="rt-btn rt-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
                <button class="rt-btn rt-btn-save" onclick={() => finishEdit(i)}>完成</button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="rt-card rt-card-deleted">
          <div class="rt-deleted-info">
            <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
            <span>{r.name} 已标记删除</span>
          </div>
          <button class="rt-btn rt-btn-restore" onclick={() => restoreItem(i)}>撤销删除</button>
        </div>
      {/if}
    {/each}
    {#if routines.filter(r => !r._deleted).length === 0}
      <div class="rt-empty">
        <iconify-icon icon="material-symbols:checklist-outline-rounded" style="font-size:48px;opacity:0.3;"></iconify-icon>
        <p>暂无日常规划，点击"添加"创建</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .rt-edit-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .rt-card {
    position: relative;
    border-radius: 16px;
    background: var(--card-bg, white);
    border: 2px solid #000;
    overflow: hidden;
    transition: all 0.2s;
  }
  :global(.dark) .rt-card {
    background: rgba(23, 23, 23, 0.8);
    border-color: #3f3f46;
  }
  .rt-card:hover {
    border-color: var(--primary);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }
  .rt-card-draft {
    border-style: dashed;
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
  }
  .rt-card-editing {
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
    box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }
  .rt-card-deleted {
    opacity: 0.6;
    border-style: dashed;
    border-color: rgba(239, 68, 68, 0.3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
  }

  .rt-card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .rt-card:hover .rt-card-actions {
    opacity: 1;
  }
  .rt-action-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 15px;
    backdrop-filter: blur(8px);
    transition: all 0.15s;
    color: white;
    background: rgba(100, 116, 139, 0.9);
  }
  .rt-action-btn iconify-icon {
    display: flex;
  }
  .rt-action-btn:hover {
    transform: scale(1.1);
    background: rgba(71, 85, 105, 1);
  }
  .rt-action-edit {
    background: rgba(59, 130, 246, 0.9) !important;
  }
  .rt-action-edit:hover {
    background: rgba(37, 99, 235, 1) !important;
  }
  .rt-action-delete {
    background: rgba(239, 68, 68, 0.9) !important;
  }
  .rt-action-delete:hover {
    background: rgba(220, 38, 38, 1) !important;
  }

  .rt-card-display {
    padding: 16px 20px;
  }
  .rt-card-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .rt-icon-wrap {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: var(--btn-plain-bg-hover);
    font-size: 20px;
    flex-shrink: 0;
  }
  :global(.dark) .rt-icon-wrap {
    background: oklch(0.18 0 0);
  }
  .rt-card-info {
    flex: 1;
    min-width: 0;
  }
  .rt-card-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .rt-card-name {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--deep-text);
  }
  .rt-card-time {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 9999px;
    background: var(--btn-plain-bg-hover);
    color: var(--primary);
    font-size: 11px;
    font-weight: 600;
  }
  :global(.dark) .rt-card-time {
    background: oklch(0.18 0 0);
  }
  .rt-badge-draft {
    padding: 1px 8px;
    border-radius: 999px;
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
    font-size: 11px;
    font-weight: 600;
  }
  .rt-card-desc {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--content-meta);
    line-height: 1.5;
  }
  .rt-card-body-preview {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line-divider);
    font-size: 12px;
    color: var(--content-meta);
    line-height: 1.6;
    max-height: 100px;
    overflow: hidden;
  }
  .rt-card-body-preview :global(p) {
    margin: 0.25rem 0;
  }
  .rt-deleted-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #ef4444;
  }

  .rt-card-form {
    padding: 20px;
  }
  .rt-form-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--theme-hue, 165), 70%, 45%);
  }
  .rt-form-row {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }
  .rt-form-group {
    margin-bottom: 10px;
  }
  .rt-form-group label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #4b5563);
    margin-bottom: 4px;
  }
  :global(.dark) .rt-form-group label {
    color: #d1d5db;
  }
  .rt-input {
    width: 100%;
    padding: 7px 10px;
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
  :global(.dark) .rt-input {
    background: #0f0f1a;
    border-color: #374151;
    color: #e5e7eb;
  }
  .rt-input:focus {
    border-color: hsl(var(--theme-hue, 165), 70%, 50%);
    box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }
  .rt-input-icon {
    text-align: center;
    font-size: 18px;
  }
  .rt-icon-picker {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rt-emoji-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .rt-emoji-grid button {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.1s;
    padding: 0;
  }
  .rt-emoji-grid button:hover {
    background: var(--btn-plain-bg-hover);
  }
  .rt-emoji-active {
    background: hsl(var(--theme-hue, 165), 70%, 50%, 0.15) !important;
    border-color: hsl(var(--theme-hue, 165), 70%, 50%) !important;
  }
  .rt-md-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1.5px solid var(--border, #d1d5db);
    border-radius: 8px;
    overflow: hidden;
    min-height: 150px;
  }
  :global(.dark) .rt-md-split {
    border-color: #374151;
  }
  .rt-md-textarea {
    width: 100%;
    padding: 10px;
    border: none;
    resize: vertical;
    font-family: "Cascadia Code", "Fira Code", monospace;
    font-size: 12px;
    line-height: 1.6;
    background: var(--bg-color, #fafafa);
    color: var(--text-color, #1f2937);
    outline: none;
    min-height: 150px;
    box-sizing: border-box;
  }
  :global(.dark) .rt-md-textarea {
    background: #0d0d18;
    color: #e5e7eb;
  }
  .rt-md-preview {
    padding: 10px;
    overflow-y: auto;
    font-size: 12px;
    line-height: 1.6;
    color: var(--deep-text);
    border-left: 1px solid var(--border, #d1d5db);
    background: var(--card-bg, white);
    min-height: 150px;
  }
  :global(.dark) .rt-md-preview {
    border-left-color: #374151;
    background: rgba(23, 23, 23, 0.5);
  }
  .rt-md-preview :global(h1),
  .rt-md-preview :global(h2),
  .rt-md-preview :global(h3) {
    margin: 0.5rem 0 0.25rem;
    font-size: 1em;
  }
  .rt-md-preview :global(p) {
    margin: 0.25rem 0;
  }
  .rt-md-preview :global(code) {
    background: var(--btn-plain-bg-hover);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.85em;
  }
  .rt-md-preview :global(pre) {
    background: var(--btn-plain-bg-hover);
    padding: 0.5rem;
    border-radius: 6px;
    overflow-x: auto;
  }
  .rt-md-preview :global(ul),
  .rt-md-preview :global(ol) {
    padding-left: 1.2em;
    margin: 0.25rem 0;
  }
  .rt-md-preview :global(blockquote) {
    border-left: 3px solid var(--primary);
    padding-left: 0.6rem;
    margin: 0.4rem 0;
    color: var(--content-meta);
  }
  .rt-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .rt-btn {
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
  .rt-btn-cancel {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-color, #374151);
  }
  .rt-btn-cancel:hover {
    background: var(--border, #e5e7eb);
  }
  :global(.dark) .rt-btn-cancel {
    background: #2d2d44;
    color: #d1d5db;
  }
  .rt-btn-save {
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
  }
  .rt-btn-save:hover {
    background: hsl(var(--theme-hue, 165), 75%, 45%);
  }
  .rt-btn-restore {
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid #22c55e;
    background: transparent;
    color: #22c55e;
    transition: all 0.15s;
    font-family: inherit;
  }
  .rt-btn-restore:hover {
    background: #22c55e;
    color: white;
  }
  .rt-empty {
    text-align: center;
    padding: 48px 20px;
    color: var(--content-meta, #9ca3af);
    font-size: 14px;
    border-radius: 16px;
    border: 2px dashed var(--border, rgba(0, 0, 0, 0.1));
  }

  @media (max-width: 640px) {
    .rt-form-row {
      grid-template-columns: 1fr;
    }
    .rt-form-group-icon {
      grid-column: 1;
    }
    .rt-md-split {
      grid-template-columns: 1fr;
    }
    .rt-md-preview {
      border-left: none;
      border-top: 1px solid var(--border, #d1d5db);
    }
  }
</style>
