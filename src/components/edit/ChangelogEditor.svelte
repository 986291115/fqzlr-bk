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

type ChangelogType = "feature" | "improvement" | "fix" | "removal";

interface ChangelogItem {
	id: string;
	version: string;
	date: string;
	time?: string;
	type: ChangelogType;
	description: string;
	body?: string;
	enabled?: boolean;
	_draft?: boolean;
	_deleted?: boolean;
}

const typeOptions = [
	{
		value: "feature",
		label: "新功能",
		icon: "material-symbols:rocket-launch",
		color: "#3b82f6",
	},
	{
		value: "improvement",
		label: "改进",
		icon: "material-symbols:build",
		color: "#f59e0b",
	},
	{
		value: "fix",
		label: "修复",
		icon: "material-symbols:bug-report",
		color: "#22c55e",
	},
	{
		value: "removal",
		label: "移除",
		icon: "material-symbols:delete",
		color: "#ef4444",
	},
];

let editMode = $state(false);
let saving = $state(false);
let changelogs = $state<ChangelogItem[]>([]);
let originalChangelogs = $state<ChangelogItem[]>([]);
let editingIndex = $state(-1);
let editPreview = $state("");
let repoLoaded = $state(false);
let fileSha = $state<string | null>(null);
let originalTS = $state<string>("");

const pageKey = "changelog";
const pageName = "更新日志";

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

function parseChangelogFromTS(tsContent: string): ChangelogItem[] {
	const items = parseArrayFromTS(tsContent, "export const changelogConfig: ChangelogItem[] = [");
	return items.map((item: any, index: number) => ({
		id: item.id || `changelog-${index}`,
		version: item.version || "",
		date: item.date || new Date().toISOString().slice(0, 10),
		time: item.time || "",
		type: (item.type as ChangelogType) || "improvement",
		description: item.description || "",
		body: item.body || "",
		enabled: item.enabled !== false,
	}));
}

function buildChangelogObject(c: ChangelogItem): string {
	const obj: any = {
		id: c.id,
		version: c.version,
		date: c.date,
	};
	if (c.time) obj.time = c.time;
	obj.type = c.type;
	obj.description = c.description;
	if (c.body) obj.body = c.body;
	obj.enabled = c.enabled !== false;

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

function buildChangelogConfigTS(
	changelogList: ChangelogItem[],
	originalContent?: string,
): string {
	const changelogEntries = changelogList.map((c) => buildChangelogObject(c));
	const changelogArrayContent = changelogEntries.join("\n");

	if (originalContent) {
		let result = originalContent;
		result = replaceArrayInTS(
			result,
			"export const changelogConfig: ChangelogItem[] = [",
			changelogArrayContent,
		);
		return result;
	}

	return `/**
 * 更新日志配置
 * 用于管理网站更新日志内容
 */

export type ChangelogType = "feature" | "improvement" | "fix" | "removal";

export interface ChangelogItem {
	id: string;
	version: string;
	date: string;
	time?: string;
	type: ChangelogType;
	description: string;
	body?: string;
	enabled?: boolean;
}

export interface ChangelogPageConfig {
	title?: string;
	description?: string;
}

export const changelogPageConfig: ChangelogPageConfig = {
	title: "更新日志",
	description: "记录网站的每一次迭代与成长",
};

export const changelogConfig: ChangelogItem[] = [
${changelogArrayContent}
];

export function getEnabledChangelog(): ChangelogItem[] {
	const enabled = changelogConfig.filter((c) => c.enabled !== false);
	return enabled.sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);
}
`;
}

const drafts = setupRepoDrafts({
	pageKey,
	pageName,
	getContent: () =>
		buildChangelogConfigTS(
			changelogs.filter((m) => !m._deleted),
			originalTS,
		),
	setContent: (v) => {
		const parsed = parseChangelogFromTS(v);
		if (parsed.length > 0 || v.includes("changelogConfig")) {
			changelogs = parsed;
		}
	},
	getPath: () => "src/config/changelogConfig.ts",
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => originalTS,
	setOriginalContent: (v) => (originalTS = v),
	getCommitMsg: (isEdit) =>
		isEdit ? `chore(changelog): 更新日志` : `chore(changelog): 创建更新日志配置`,
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

function collectFromDOM() {
	const timeline = document.getElementById("cl-timeline");
	if (!timeline) return;
	const result: ChangelogItem[] = [];
	timeline.querySelectorAll<HTMLElement>(".cl-entry").forEach((el) => {
		const id = el.dataset.id || "";
		const type = (el.dataset.type as ChangelogType) || "improvement";
		const version =
			el.querySelector(".cl-entry-version")?.textContent?.trim() || "";
		const timeEl = el.querySelector("time");
		const date = (timeEl?.getAttribute("datetime") || "").slice(0, 10);
		const description =
			el.querySelector(".cl-entry-text")?.textContent?.trim() || "";
		result.push({
			id: id || genId("cl"),
			version,
			date,
			type,
			description,
			body: description,
			enabled: true,
		});
	});
	changelogs = result;
	originalChangelogs = deepClone(result);
}

async function loadRepoData() {
	const existing = await getRepoFile("src/config/changelogConfig.ts");
	if (existing && existing.content) {
		try {
			const repoChangelogs: ChangelogItem[] = parseChangelogFromTS(existing.content);
			originalTS = existing.content;
			fileSha = existing.sha || null;

			const repoMap = new Map(repoChangelogs.map((m) => [m.id, m]));
			changelogs = changelogs.map((m) => {
				const repoItem = repoMap.get(m.id);
				if (repoItem) {
					return {
						...m,
						enabled: repoItem.enabled ?? m.enabled,
						body: repoItem.body ?? m.body,
						time: repoItem.time ?? m.time,
					};
				}
				return m;
			});

			const existingIds = new Set(changelogs.map((m) => m.id));
			for (const g of repoChangelogs) {
				if (!existingIds.has(g.id)) {
					changelogs = [...changelogs, { ...g, id: g.id || genId("cl") }];
					existingIds.add(g.id);
				}
			}

			originalChangelogs = deepClone(changelogs);
		} catch (e) {
			console.error("Failed to parse repo changelog:", e);
		}
	} else {
		originalTS = buildChangelogConfigTS(changelogs);
	}
	repoLoaded = true;
	drafts.restoreFromDrafts();
}

function hideSSRContent() {
	const timeline = document.getElementById("cl-timeline");
	const filterBar = document.getElementById("cl-filter-bar");
	if (timeline) (timeline as HTMLElement).style.display = "none";
	if (filterBar) (filterBar as HTMLElement).style.display = "none";
}

function showSSRContent() {
	const timeline = document.getElementById("cl-timeline");
	const filterBar = document.getElementById("cl-filter-bar");
	if (timeline) (timeline as HTMLElement).style.display = "";
	if (filterBar) (filterBar as HTMLElement).style.display = "";
}

function handleCancel() {
	editMode = false;
	changelogs = deepClone(originalChangelogs);
	editingIndex = -1;
	drafts.clearDrafts();
	showSSRContent();
}

function getTypeInfo(type: string) {
	return typeOptions.find((t) => t.value === type) || typeOptions[1];
}

function startEdit(index: number) {
	editingIndex = index;
	updatePreview(index);
}

function updatePreview(index: number) {
	const c = changelogs[index];
	if (!c) {
		editPreview = "";
		return;
	}
	try {
		editPreview = marked.parse(c.body || "", {
			gfm: true,
			breaks: true,
		}) as string;
	} catch {
		editPreview = c.body || "";
	}
}

function updateField(
	index: number,
	field: keyof ChangelogItem,
	value: string | string[] | boolean,
) {
	changelogs[index] = { ...changelogs[index], [field]: value };
	changelogs = [...changelogs];
	if (field === "body") {
		updatePreview(index);
	}
}

function finishEdit(index: number) {
	const c = changelogs[index];
	if (!c.version.trim()) {
		showToast("版本号不能为空", "warning");
		return;
	}
	if (!c.description.trim()) {
		showToast("更新简述不能为空", "warning");
		return;
	}
	editingIndex = -1;
	showToast("已修改，记得点击保存", "info");
}

function cancelItemEdit(index: number) {
	const c = changelogs[index];
	if (c._draft && !c.version.trim()) {
		changelogs = changelogs.filter((_, i) => i !== index);
	} else {
		const orig = originalChangelogs.find((o) => o.id === c.id && !c._draft);
		if (orig) {
			changelogs[index] = deepClone(orig);
			changelogs = [...changelogs];
		}
	}
	editingIndex = -1;
}

function deleteItem(index: number) {
	const c = changelogs[index];
	if (!confirm(`确定要删除「${c.version || "该条目"}」吗？`)) return;
	if (c._draft) {
		changelogs = changelogs.filter((_, i) => i !== index);
	} else {
		changelogs[index] = { ...changelogs[index], _deleted: true };
		changelogs = [...changelogs];
	}

	if (editingIndex === index) editingIndex = -1;
	else if (editingIndex > index) editingIndex--;
	showToast("已标记删除，记得点击保存", "info");
}

function moveUp(index: number) {
	if (index <= 0) return;
	const arr = [...changelogs];
	[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
	changelogs = arr;

	if (editingIndex === index) editingIndex = index - 1;
	else if (editingIndex === index - 1) editingIndex = index;
}

function moveDown(index: number) {
	if (index >= changelogs.length - 1) return;
	const arr = [...changelogs];
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
	changelogs = arr;

	if (editingIndex === index) editingIndex = index + 1;
	else if (editingIndex === index + 1) editingIndex = index;
}

function restoreItem(index: number) {
	changelogs[index] = { ...changelogs[index], _deleted: false };
	changelogs = [...changelogs];
}

function handleAdd() {
	const today = new Date().toISOString().slice(0, 10);
	const newEntry: ChangelogItem = {
		id: genId("cl"),
		version: "",
		date: today,
		time: "",
		type: "improvement",
		description: "",
		body: "",
		enabled: true,
		_draft: true,
	};
	changelogs = [newEntry, ...changelogs];
	editingIndex = 0;
	editPreview = "";
}

function handleSaveDraft() {
	const cleanData = changelogs.map(({ _draft, _deleted, ...rest }) => ({
		...rest,
		id: rest.id || genId("cl"),
		enabled: rest.enabled !== false,
	}));
	changelogs = cleanData;
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
		const cleanData = changelogs.map(({ _draft, _deleted, ...rest }) => ({
			...rest,
			id: rest.id || genId("cl"),
			enabled: rest.enabled !== false,
		}));
		changelogs = cleanData;
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
  <div class="cl-edit-list">
    {#each changelogs as entry, i (i + "-" + entry.id)}
      {#if !entry._deleted}
        <div
          class="cl-edit-card"
          class:cl-edit-card-draft={entry._draft}
          class:cl-edit-card-editing={editingIndex === i}
        >
          {#if editingIndex !== i}
            <div class="cl-card-actions">
              {#if i > 0}
                <button class="cl-action-btn cl-action-move" onclick={() => moveUp(i)} title="上移">
                  <iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
                </button>
              {/if}
              {#if i < changelogs.filter(e => !e._deleted).length - 1}
                <button class="cl-action-btn cl-action-move" onclick={() => moveDown(i)} title="下移">
                  <iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon>
                </button>
              {/if}
              <button class="cl-action-btn cl-action-edit" onclick={() => startEdit(i)} title="编辑">
                <iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
              </button>
              <button class="cl-action-btn cl-action-delete" onclick={() => deleteItem(i)} title="删除">
                <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
              </button>
            </div>

            <div class="cl-card-display">
              <div class="cl-card-meta">
                <span class="cl-type-badge" style={`background:${getTypeInfo(entry.type).color}20;color:${getTypeInfo(entry.type).color};border-color:${getTypeInfo(entry.type).color}40`}>
                  <iconify-icon icon={getTypeInfo(entry.type).icon} width="14"></iconify-icon>
                  {getTypeInfo(entry.type).label}
                </span>
                <span class="cl-card-date">{entry.date}</span>
                <span class="cl-card-version">{entry.version || "（未设置版本号）"}</span>
                {#if entry._draft}
                  <span class="cl-draft-badge">新增</span>
                {/if}
              </div>
              <p class="cl-card-desc">{entry.description || "（无描述）"}</p>
              {#if entry.body}
                <div class="cl-card-body-preview">{@html marked.parse(entry.body.slice(0, 200) + (entry.body.length > 200 ? "..." : ""), { gfm: true, breaks: true })}</div>
              {/if}
            </div>
          {:else}
            <div class="cl-card-edit-form">
              <div class="cl-form-header">
                <iconify-icon icon="material-symbols:edit-document-outline-rounded"></iconify-icon>
                <span>编辑更新日志</span>
                {#if entry._draft}
                  <span class="cl-draft-badge">新增</span>
                {/if}
              </div>
              <div class="cl-form-grid">
                <div class="cl-form-group">
                  <label>版本号</label>
                  <input type="text" class="cl-input" value={entry.version} oninput={(e) => updateField(i, "version", (e.target as HTMLInputElement).value)} placeholder="如 v1.2.0" />
                </div>
                <div class="cl-form-group">
                  <label>类型</label>
                  <select class="cl-select" value={entry.type} onchange={(e) => updateField(i, "type", (e.target as HTMLSelectElement).value)}>
                    {#each typeOptions as opt}
                      <option value={opt.value}>{opt.label}</option>
                    {/each}
                  </select>
                </div>
                <div class="cl-form-group">
                  <label>日期</label>
                  <input type="date" class="cl-input" value={entry.date} oninput={(e) => updateField(i, "date", (e.target as HTMLInputElement).value)} />
                </div>
              </div>
              <div class="cl-form-group">
                <label>更新简述</label>
                <input type="text" class="cl-input" value={entry.description} oninput={(e) => updateField(i, "description", (e.target as HTMLInputElement).value)} placeholder="一句话描述这次更新" />
              </div>
              <div class="cl-form-group">
                <label>时间（可选）</label>
                <input type="text" class="cl-input" value={entry.time || ""} oninput={(e) => updateField(i, "time", (e.target as HTMLInputElement).value)} placeholder="如 22:00" />
              </div>
              <div class="cl-form-group">
                <label>详细内容（Markdown）</label>
                <div class="cl-md-split">
                  <textarea
                    class="cl-md-textarea"
                    value={entry.body || ""}
                    oninput={(e) => updateField(i, "body", (e.target as HTMLTextAreaElement).value)}
                    placeholder="详细的更新说明，支持 Markdown..."
                    spellcheck="false"
                  ></textarea>
                  <div class="cl-md-preview">{@html editPreview}</div>
                </div>
              </div>
              <div class="cl-form-actions">
                <button class="cl-btn cl-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
                <button class="cl-btn cl-btn-save" onclick={() => finishEdit(i)}>完成</button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="cl-edit-card cl-edit-card-deleted">
          <div class="cl-deleted-info">
            <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
            <span>{entry.version} 已标记删除</span>
          </div>
          <button class="cl-btn cl-btn-restore" onclick={() => restoreItem(i)}>撤销删除</button>
        </div>
      {/if}
    {/each}

    {#if changelogs.filter(e => !e._deleted).length === 0}
      <div class="cl-empty-state">
        <iconify-icon icon="material-symbols:history-toggle-off-rounded" style="font-size:48px;opacity:0.3;"></iconify-icon>
        <p>暂无更新日志，点击"添加"创建第一条</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .cl-edit-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .cl-edit-card {
    position: relative;
    border-radius: 16px;
    background: var(--card-bg, white);
    border: 1px solid var(--border, rgba(0,0,0,0.08));
    overflow: hidden;
    transition: all 0.2s;
  }
  :global(.dark) .cl-edit-card {
    background: rgba(23, 23, 23, 0.8);
    border-color: rgba(255,255,255,0.08);
  }
  .cl-edit-card:hover {
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
  }
  .cl-edit-card-draft {
    border-style: dashed;
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
  }
  .cl-edit-card-editing {
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
    box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }
  .cl-edit-card-deleted {
    opacity: 0.6;
    border-style: dashed;
    border-color: rgba(239, 68, 68, 0.3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
  }

  .cl-card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .cl-edit-card:hover .cl-card-actions {
    opacity: 1;
  }
  .cl-action-btn {
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
  .cl-action-btn iconify-icon {
    display: flex;
  }
  .cl-action-move {
    background: rgba(100, 116, 139, 0.9);
  }
  .cl-action-move:hover {
    background: rgba(71, 85, 105, 1);
    transform: scale(1.1);
  }
  .cl-action-edit {
    background: rgba(59, 130, 246, 0.9);
  }
  .cl-action-edit:hover {
    background: rgba(37, 99, 235, 1);
    transform: scale(1.1);
  }
  .cl-action-delete {
    background: rgba(239, 68, 68, 0.9);
  }
  .cl-action-delete:hover {
    background: rgba(220, 38, 38, 1);
    transform: scale(1.1);
  }

  .cl-card-display {
    padding: 16px 20px;
  }
  .cl-card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .cl-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid;
  }
  .cl-card-date {
    font-size: 12px;
    color: var(--content-meta, #9ca3af);
  }
  .cl-card-version {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--deep-text);
    background: var(--btn-plain-bg-hover);
    padding: 1px 8px;
    border-radius: 4px;
  }
  :global(.dark) .cl-card-version {
    background: oklch(0.20 0 0);
  }
  .cl-draft-badge {
    padding: 1px 8px;
    border-radius: 999px;
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
    font-size: 11px;
    font-weight: 600;
  }
  .cl-card-desc {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--deep-text);
    line-height: 1.5;
  }
  .cl-card-body-preview {
    font-size: 12px;
    color: var(--content-meta, #6b7280);
    line-height: 1.6;
    max-height: 60px;
    overflow: hidden;
  }
  :global(.dark) .cl-card-body-preview {
    color: #9ca3af;
  }
  .cl-card-body-preview :global(p) {
    margin: 0.25rem 0;
  }
  .cl-card-body-preview :global(ul),
  .cl-card-body-preview :global(ol) {
    margin: 0.25rem 0;
    padding-left: 1.2em;
  }

  .cl-deleted-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #ef4444;
  }

  .cl-card-edit-form {
    padding: 20px;
  }
  .cl-form-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--theme-hue, 165), 70%, 45%);
  }
  .cl-form-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }
  .cl-form-group {
    margin-bottom: 12px;
  }
  .cl-form-group label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #4b5563);
    margin-bottom: 4px;
  }
  :global(.dark) .cl-form-group label {
    color: #d1d5db;
  }
  .cl-input,
  .cl-select {
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
  :global(.dark) .cl-input,
  :global(.dark) .cl-select {
    background: #0f0f1a;
    border-color: #374151;
    color: #e5e7eb;
  }
  .cl-input:focus,
  .cl-select:focus {
    border-color: hsl(var(--theme-hue, 165), 70%, 50%);
    box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }

  .cl-md-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1.5px solid var(--border, #d1d5db);
    border-radius: 8px;
    overflow: hidden;
    min-height: 200px;
  }
  :global(.dark) .cl-md-split {
    border-color: #374151;
  }
  .cl-md-textarea {
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
    min-height: 200px;
    box-sizing: border-box;
  }
  :global(.dark) .cl-md-textarea {
    background: #0d0d18;
    color: #e5e7eb;
  }
  .cl-md-preview {
    padding: 10px;
    overflow-y: auto;
    font-size: 12px;
    line-height: 1.6;
    color: var(--deep-text);
    border-left: 1px solid var(--border, #d1d5db);
    background: var(--card-bg, white);
    min-height: 200px;
  }
  :global(.dark) .cl-md-preview {
    border-left-color: #374151;
    background: rgba(23, 23, 23, 0.5);
  }
  .cl-md-preview :global(h1),
  .cl-md-preview :global(h2),
  .cl-md-preview :global(h3) {
    margin: 0.5rem 0 0.25rem;
    font-size: 1em;
  }
  .cl-md-preview :global(p) {
    margin: 0.25rem 0;
  }
  .cl-md-preview :global(code) {
    background: var(--btn-plain-bg-hover);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.85em;
  }
  .cl-md-preview :global(pre) {
    background: var(--btn-plain-bg-hover);
    padding: 0.5rem;
    border-radius: 6px;
    overflow-x: auto;
  }
  .cl-md-preview :global(ul),
  .cl-md-preview :global(ol) {
    padding-left: 1.2em;
    margin: 0.25rem 0;
  }
  .cl-md-preview :global(blockquote) {
    border-left: 3px solid var(--primary);
    padding-left: 0.6rem;
    margin: 0.4rem 0;
    color: var(--content-meta);
  }

  .cl-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .cl-btn {
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
  .cl-btn-cancel {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-color, #374151);
  }
  .cl-btn-cancel:hover {
    background: var(--border, #e5e7eb);
  }
  :global(.dark) .cl-btn-cancel {
    background: #2d2d44;
    color: #d1d5db;
  }
  :global(.dark) .cl-btn-cancel:hover {
    background: #3d3d55;
  }
  .cl-btn-save {
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
  }
  .cl-btn-save:hover {
    background: hsl(var(--theme-hue, 165), 75%, 45%);
  }
  .cl-btn-restore {
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
  .cl-btn-restore:hover {
    background: #22c55e;
    color: white;
  }

  .cl-empty-state {
    text-align: center;
    padding: 48px 20px;
    color: var(--content-meta, #9ca3af);
    font-size: 14px;
  }

  @media (max-width: 640px) {
    .cl-form-grid {
      grid-template-columns: 1fr;
    }
    .cl-md-split {
      grid-template-columns: 1fr;
    }
    .cl-md-preview {
      border-left: none;
      border-top: 1px solid var(--border, #d1d5db);
    }
  }
</style>
