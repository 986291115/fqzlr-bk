<script lang="ts">
import { onMount } from "svelte";
import {
	showToast,
	genId,
	deepClone,
	ensureIconify,
	getRepoFile,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";

interface PengyouRSSItem {
	id?: string;
	name: string;
	url: string;
	enabled?: boolean;
	_draft?: boolean;
}

let editMode = $state(false);
let saving = $state(false);
let rssSources = $state<PengyouRSSItem[]>([]);
let originalSources = $state<PengyouRSSItem[]>([]);
let editingIndex = $state(-1);
let repoLoaded = $state(false);
let fileSha = $state<string | null>(null);
let originalTS = $state<string>("");

function tsObjectLiteralToJSON(src: string): string {
	let out = "";
	let i = 0;
	const len = src.length;
	let inString: false | "'" | '"' | "`" = false;
	let inLineComment = false;
	let inBlockComment = false;

	const isUnquotedKeyChar = (c: string) => /[A-Za-z0-9_$]/.test(c);

	while (i < len) {
		const c = src[i];
		const c2 = src[i + 1] || "";

		if (inLineComment) {
			out += c;
			if (c === "\n") inLineComment = false;
			i++;
			continue;
		}
		if (inBlockComment) {
			out += c;
			if (c === "*" && c2 === "/") {
				out += "/";
				i += 2;
				inBlockComment = false;
				continue;
			}
			i++;
			continue;
		}
		if (inString) {
			out += c;
			if (c === "\\" && i + 1 < len) {
				out += src[i + 1];
				i += 2;
				continue;
			}
			if (c === inString) inString = false;
			i++;
			continue;
		}

		if (c === "/" && c2 === "/") {
			inLineComment = true;
			out += "//";
			i += 2;
			continue;
		}
		if (c === "/" && c2 === "*") {
			inBlockComment = true;
			out += "/*";
			i += 2;
			continue;
		}
		if (c === "'" || c === '"' || c === "`") {
			inString = c;
			out += '"';
			i++;
			while (i < len) {
				const ch = src[i];
				if (ch === "\\") {
					const next = src[i + 1] || "";
					if (next === "'" || next === '"') out += '"';
					else if (next === "n") out += "\\n";
					else if (next === "t") out += "\\t";
					else if (next === "r") out += "\\r";
					else out += "\\" + next;
					i += 2;
					continue;
				}
				if (ch === c) {
					out += '"';
					inString = false;
					i++;
					break;
				}
				if (ch === '"') {
					out += '\\"';
					i++;
					continue;
				}
				out += ch;
				i++;
			}
			continue;
		}

		if (isUnquotedKeyChar(c)) {
			let j = i;
			while (j < len && isUnquotedKeyChar(src[j])) j++;
			const word = src.substring(i, j);
			let k = j;
			while (k < len && /\s/.test(src[k])) k++;
			if (src[k] === ":") {
				out += '"' + word + '"';
				i = j;
				continue;
			} else {
				out += word;
				i = j;
				continue;
			}
		}

		out += c;
		i++;
	}

	out = out.replace(/,(\s*\n\s*[}\]])/g, "$1");
	return out;
}

function parseRSSFromTS(tsContent: string): PengyouRSSItem[] {
	tsContent = tsContent.replace(/\r\n/g, "\n");

	const rssMarkerRegex = /rss:\s*\[\s*\n/;
	const rssMatch = tsContent.match(rssMarkerRegex);
	if (!rssMatch || rssMatch.index === undefined) return [];

	const rssStartIdx = rssMatch.index + rssMatch[0].indexOf("[");

	const dataMarkerRegex = /\n\s*\]\s*,?\s*\n\s*data:\s*\[/;
	const dataMatch = tsContent.substring(rssStartIdx).match(dataMarkerRegex);
	if (!dataMatch || dataMatch.index === undefined) return [];

	const closeBracketIdx = dataMatch[0].indexOf("]");
	const dataStartIdx = rssStartIdx + dataMatch.index + closeBracketIdx + 1;

	let rssStr = tsContent.substring(rssStartIdx, dataStartIdx).trim();
	rssStr = rssStr.replace(/,$/, "");

	try {
		const jsonStr = tsObjectLiteralToJSON(rssStr);
		const parsed = JSON.parse(jsonStr);
		if (Array.isArray(parsed)) {
			return parsed.map((item: any) => ({
				id: item.id || genId("py"),
				name: item.name || "",
				url: item.url || "",
				enabled: item.enabled !== false,
			}));
		}
	} catch (e) {
		console.error("Failed to parse RSS from TS:", e);
	}
	return [];
}

function buildPengyouConfigTS(
	sources: PengyouRSSItem[],
	originalContent?: string,
): string {
	const entries = sources.map((s) => {
		const obj = {
			name: s.name,
			url: s.url,
			enabled: s.enabled !== false,
		};
		const json = JSON.stringify(obj, null, 2)
			.split("\n")
			.map((line, i, arr) =>
				i === arr.length - 1 ? `\t\t${line},` : `\t\t${line}`,
			)
			.join("\n");
		return json;
	});
	const newRSSContent = `[\n${entries.join("\n")}\n\t]`;

	if (originalContent) {
		const rssMarkerRegex = /rss:\s*\[\s*\n/;
		const rssMatch = originalContent.match(rssMarkerRegex);
		const dataMarkerRegex = /\n\s*\]\s*,?\s*\n\s*data:\s*\[/;

		if (rssMatch && rssMatch.index !== undefined) {
			const start = rssMatch.index + rssMatch[0].indexOf("[");
			const dataMatch = originalContent.substring(start).match(dataMarkerRegex);
			if (dataMatch && dataMatch.index !== undefined) {
				const closeBracketIdx = dataMatch[0].indexOf("]");
				const dataStartIdx = start + dataMatch.index + closeBracketIdx + 1;
				return (
					originalContent.substring(0, start) +
					newRSSContent +
					originalContent.substring(dataStartIdx)
				);
			}
		}
	}

	return `export interface PengyouItem {
	title: string;
	author: string;
	date: string;
	link: string;
	content: string;
}

export interface PengyouConfig {
	api?: string;
	rss: {
		name: string;
		url: string;
		enabled?: boolean;
	}[];
	data: PengyouItem[];
}

export const pengyouConfig: PengyouConfig = {
	api: '',
	rss: ${newRSSContent},
	data: [
		{
			title: "示例文章",
			author: "示例作者",
			date: "2025-01-01",
			link: "https://example.com",
			content: "这是示例内容"
		}
	]
};
`;
}

const drafts = setupRepoDrafts({
	pageKey: "pengyou",
	pageName: "朋友圈",
	getContent: () => buildPengyouConfigTS(rssSources, originalTS),
	setContent: (v) => {
		const parsed = parseRSSFromTS(v);
		if (parsed.length > 0 || v.includes("rss:")) {
			rssSources = parsed;
		}
	},
	getPath: () => "src/config/pengyouConfig.ts",
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => originalTS,
	setOriginalContent: (v) => (originalTS = v),
	getCommitMsg: (isEdit) =>
		isEdit ? `chore: update pengyou rss` : `chore: create pengyou rss`,
	onSubmitted: () => {
		setTimeout(() => window.location.reload(), 1200);
	},
});

let hasChanges = $derived(drafts.hasLocalChanges());

$effect(() => {
	window.dispatchEvent(
		new CustomEvent("edit:hasChanges", {
			detail: { pageKey: "pengyou", hasChanges },
		}),
	);
});

onMount(() => {
	ensureIconify();
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
	if (detail?.pageKey !== "pengyou") return;
	if (detail.editing) {
		editMode = true;
		hideSSRFeed();
		editingIndex = -1;
	} else {
		editMode = false;
		showSSRFeed();
	}
}

function handleSidebarSaveDraft(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "pengyou") return;
	handleSaveDraft();
}

function handleSidebarSubmit(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "pengyou") return;
	handleSubmit();
}

function handleSidebarCancel(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "pengyou") return;
	handleCancel();
}

function handleSidebarAdd(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "pengyou") return;
	handleAdd();
}

async function loadRepoData() {
	const existing = await getRepoFile("src/config/pengyouConfig.ts");
	if (existing && existing.content) {
		try {
			const repoItems: PengyouRSSItem[] = parseRSSFromTS(existing.content);
			originalTS = existing.content;
			rssSources = repoItems.length > 0 ? repoItems : [{
				id: genId("py"),
				name: "",
				url: "",
				enabled: true,
			}];
			originalSources = deepClone(rssSources);
		} catch (e) {
			console.error("Failed to parse repo pengyou config:", e);
			rssSources = [{
				id: genId("py"),
				name: "",
				url: "",
				enabled: true,
			}];
		}
	} else {
		rssSources = [{
			id: genId("py"),
			name: "",
			url: "",
			enabled: true,
		}];
		originalTS = buildPengyouConfigTS(rssSources);
	}
	repoLoaded = true;
	drafts.restoreFromDrafts();
}

function hideSSRFeed() {
	const feed = document.getElementById("pengyou-feed");
	if (feed) feed.style.display = "none";
}

function showSSRFeed() {
	const feed = document.getElementById("pengyou-feed");
	if (feed) feed.style.display = "";
}

function handleCancel() {
	editMode = false;
	rssSources = deepClone(originalSources);
	drafts.clearDrafts();
	editingIndex = -1;
	showSSRFeed();
}

function moveUp(index: number) {
	if (index <= 0) return;
	const arr = [...rssSources];
	[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
	rssSources = arr;
	if (editingIndex === index) editingIndex = index - 1;
	else if (editingIndex === index - 1) editingIndex = index;
}

function moveDown(index: number) {
	if (index >= rssSources.length - 1) return;
	const arr = [...rssSources];
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
	rssSources = arr;
	if (editingIndex === index) editingIndex = index + 1;
	else if (editingIndex === index + 1) editingIndex = index;
}

function startEdit(index: number) {
	editingIndex = index;
}

function finishEdit(index: number) {
	const s = rssSources[index];
	if (!s.name.trim()) {
		showToast("名称不能为空", "warning");
		return;
	}
	if (!s.url.trim()) {
		showToast("RSS 链接不能为空", "warning");
		return;
	}
	editingIndex = -1;
	showToast("已修改，记得点击保存", "info");
}

function cancelItemEdit(index: number) {
	const s = rssSources[index];
	if (s._draft && !s.name.trim()) {
		rssSources = rssSources.filter((_, i) => i !== index);
	} else {
		const orig = originalSources.find(
			(o) => (o.id || o.url) === (s.id || s.url) && !s._draft,
		);
		if (orig) {
			rssSources[index] = deepClone(orig);
			rssSources = [...rssSources];
		}
	}
	editingIndex = -1;
}

function deleteItem(index: number) {
	const s = rssSources[index];
	if (!confirm(`确定要删除「${s.name || "该 RSS 源"}」吗？`)) return;
	rssSources = rssSources.filter((_, i) => i !== index);
	if (editingIndex === index) editingIndex = -1;
	else if (editingIndex > index) editingIndex--;
	showToast("已删除，记得点击保存", "info");
}

function handleAdd() {
	const newSource: PengyouRSSItem = {
		id: genId("py"),
		name: "",
		url: "",
		enabled: true,
		_draft: true,
	};
	rssSources = [...rssSources, newSource];
	editingIndex = rssSources.length - 1;
}

function handleSaveDraft() {
	const cleanData = rssSources.map(({ _draft, ...rest }) => ({
		...rest,
		id: rest.id || genId("py"),
		enabled: rest.enabled !== false,
	}));
	rssSources = cleanData;
	drafts.saveToDrafts();
}

async function handleSubmit() {
	if (editingIndex >= 0) {
		finishEdit(editingIndex);
		if (editingIndex >= 0) return;
	}
	saving = true;
	try {
		const cleanData = rssSources.map(({ _draft, ...rest }) => ({
			...rest,
			id: rest.id || genId("py"),
			enabled: rest.enabled !== false,
		}));
		rssSources = cleanData;
		drafts.saveToDrafts();
		await drafts.submitDrafts();
	} finally {
		saving = false;
	}
}

function updateField(index: number, field: keyof PengyouRSSItem, value: string | boolean) {
	rssSources[index] = { ...rssSources[index], [field]: value };
	rssSources = [...rssSources];
}
</script>


{#if editMode}
	<div class="edit-pengyou-grid" id="edit-pengyou-grid">
		{#each rssSources as source, i (i + "-" + (source.id || source.url))}
			<div
				class="edit-pengyou-card"
				class:edit-pengyou-card-draft={source._draft}
				class:edit-pengyou-card-editing={editingIndex === i}
			>
				{#if editingIndex !== i}
					<div class="card-action-row">
						{#if i > 0}
							<button class="action-btn action-move" onclick={() => moveUp(i)} title="上移">
								<iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
							</button>
						{/if}
						{#if i < rssSources.length - 1}
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
						<div class="card-status-badge" class:card-status-disabled={!source.enabled}>
							{source.enabled ? '启用' : '禁用'}
						</div>
						<h3 class="card-title">{source.name || "（未命名）"}</h3>
						<p class="card-url">{source.url || "暂无链接"}</p>
					</div>
				{:else}
					<div class="card-edit-form">
						<div class="edit-form-header">
							<iconify-icon icon="material-symbols:rss-feed-rounded" class="text-lg"></iconify-icon>
							<span>编辑 RSS 源</span>
							{#if source._draft}
								<span class="draft-badge">新增</span>
							{/if}
						</div>
						<div class="form-group">
							<label>名称</label>
							<input
								type="text"
								value={source.name}
								oninput={(e) => updateField(i, "name", (e.target as HTMLInputElement).value)}
								placeholder="博客名称"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>RSS 链接</label>
							<input
								type="text"
								value={source.url}
								oninput={(e) => updateField(i, "url", (e.target as HTMLInputElement).value)}
								placeholder="https://example.com/feed"
								class="form-input"
							/>
						</div>
						<div class="form-group form-group-checkbox">
							<label>
								<input
									type="checkbox"
									checked={source.enabled !== false}
									onchange={(e) => updateField(i, "enabled", (e.target as HTMLInputElement).checked)}
								/>
								<span>启用</span>
							</label>
						</div>
						<div class="form-actions">
							<button class="form-btn form-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
							<button class="form-btn form-btn-save" onclick={() => finishEdit(i)}>完成</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}

		{#if rssSources.length === 0}
			<div class="empty-state">
				<iconify-icon icon="material-symbols:rss-feed-off-rounded" class="text-4xl mb-2 opacity-40"></iconify-icon>
				<p>暂无 RSS 源，点击"添加"开始添加</p>
			</div>
		{/if}
	</div>
{/if}

<style>
	.edit-pengyou-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
	}

	.edit-pengyou-card {
		position: relative;
		border-radius: 16px;
		background: var(--card-bg, white);
		border: 2px solid #000;
		overflow: hidden;
		transition: all 0.2s;
	}
	:global(.dark) .edit-pengyou-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: #3f3f46;
	}
	.edit-pengyou-card:hover {
		border-color: var(--primary);
		transform: translateY(-2px);
		box-shadow: 0 4px 24px rgba(0,0,0,0.1);
	}
	:global(.dark) .edit-pengyou-card:hover {
		border-color: #fff;
		box-shadow: 0 4px 24px rgba(255,255,255,0.08);
	}
	.edit-pengyou-card-draft {
		border-style: dashed;
		border-color: var(--primary);
	}
	.edit-pengyou-card-editing {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}

	.card-action-row {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		gap: 4px;
		z-index: 10;
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
	.action-move { background: rgba(100, 116, 139, 1); }
	.action-move:hover { background: rgba(71, 85, 105, 1); transform: scale(1.1); }
	.action-edit { background: rgba(59, 130, 246, 1); }
	.action-edit:hover { background: rgba(37, 99, 235, 1); transform: scale(1.1); }
	.action-delete { background: rgba(239, 68, 68, 1); }
	.action-delete:hover { background: rgba(220, 38, 38, 1); transform: scale(1.1); }

	.card-display { padding: 20px; cursor: default; }
	.card-status-badge {
		display: inline-block; padding: 2px 10px; border-radius: 999px;
		font-size: 11px; font-weight: 600; margin-bottom: 12px;
		background: #22c55e; color: white;
	}
	.card-status-disabled {
		background: #9ca3af;
	}
	.card-title {
		margin: 0 0 8px; font-size: 15px; font-weight: 700;
		color: var(--text-color, #1f2937);
	}
	:global(.dark) .card-title { color: #f0f0f0; }
	.card-url {
		margin: 0; font-size: 12px; color: var(--content-meta, #9ca3af);
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
	.form-group-checkbox label {
		display: flex; align-items: center; gap: 8px;
		cursor: pointer;
	}
	.form-group-checkbox input {
		width: 16px; height: 16px;
	}
	.form-input {
		width: 100%; padding: 8px 12px;
		border: 1.5px solid var(--border, #d1d5db); border-radius: 8px;
		font-size: 13px; background: var(--bg-color, white);
		color: var(--text-color, #1f2937); outline: none;
		transition: border-color 0.2s; box-sizing: border-box; font-family: inherit;
	}
	:global(.dark) .form-input {
		background: #0f0f1a; border-color: #374151; color: #e5e7eb;
	}
	.form-input:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
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