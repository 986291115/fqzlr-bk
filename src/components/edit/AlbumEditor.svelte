<script lang="ts">
import { onMount } from "svelte";
import {
	showToast,
	deepClone,
	ensureIconify,
	getRepoFile,
	listRepoFiles,
	updateRepoFile,
	createRepoFile,
	deleteRepoFile,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";
import { repoConfig } from "@/config/editConfig";

interface PhotoItem {
	src: string;
	alt?: string;
	caption?: string;
}

interface AlbumItem {
	slug: string;
	title: string;
	subtitle?: string;
	cover?: string;
	date: string;
	location?: string;
	photos: PhotoItem[];
	tags: string[];
	draft?: boolean;
	sha?: string;
	_draft?: boolean;
	_deleted?: boolean;
	_body?: string;
}

let editMode = $state(false);
let saving = $state(false);
let albums = $state<AlbumItem[]>([]);
let originalAlbums = $state<AlbumItem[]>([]);
let editingIndex = $state(-1);
let repoLoaded = $state(false);

const pageKey = "albums";
const pageName = "相册";
const contentDir = "src/content/album";

function parseFrontmatter(content: string): Record<string, any> {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return {};
	const fm = match[1];
	const result: Record<string, any> = {};
	const lines = fm.split("\n");
	let currentKey = "";
	let inArray = false;
	let arrayItems: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed && !inArray) continue;

		if (inArray) {
			if (trimmed.startsWith("- ")) {
				arrayItems.push(trimmed.substring(2).trim().replace(/^['"]|['"]$/g, ""));
				continue;
			} else {
				inArray = false;
				if (currentKey) result[currentKey] = arrayItems;
				arrayItems = [];
			}
		}

		if (!inArray) {
			const colonIdx = trimmed.indexOf(":");
			if (colonIdx <= 0) continue;
			const key = trimmed.substring(0, colonIdx).trim();
			const val = trimmed.substring(colonIdx + 1).trim();

			if (val === "" || val === "[") {
				currentKey = key;
				inArray = true;
				arrayItems = [];
			} else if (val.startsWith("[") && val.endsWith("]")) {
				const inner = val.substring(1, val.length - 1).trim();
				if (inner) {
					result[key] = inner.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
				} else {
					result[key] = [];
				}
			} else {
				const cleanVal = val.replace(/^['"]|['"]$/g, "");
				if (cleanVal === "true") result[key] = true;
				else if (cleanVal === "false") result[key] = false;
				else result[key] = cleanVal;
			}
		}
	}

	if (inArray && currentKey) {
		result[currentKey] = arrayItems;
	}

	return result;
}

function parseAlbum(content: string, slug: string, sha?: string): AlbumItem | null {
	const fm = parseFrontmatter(content);
	if (!fm.title) return null;

	const bodyMatch = content.match(/^---\s*\n[\s\S]*?\n---\n?([\s\S]*)$/);
	const body = bodyMatch ? bodyMatch[1].trim() : "";

	const photos: PhotoItem[] = Array.isArray(fm.photos)
		? fm.photos.map((p: any) => (typeof p === "string" ? { src: p } : p))
		: [];

	return {
		slug,
		title: fm.title,
		subtitle: fm.subtitle || "",
		cover: fm.cover || "",
		date: fm.date ? new Date(fm.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
		location: fm.location || "",
		photos,
		tags: Array.isArray(fm.tags) ? fm.tags : [],
		draft: fm.draft === true,
		sha,
		_body: body,
	};
}

function buildAlbumContent(album: AlbumItem): string {
	let fm = "---\n";
	fm += `title: ${album.title}\n`;
	if (album.subtitle) fm += `subtitle: ${album.subtitle}\n`;
	if (album.cover) fm += `cover: ${album.cover}\n`;
	fm += `date: ${album.date}\n`;
	if (album.location) fm += `location: ${album.location}\n`;
	if (album.tags.length > 0) {
		fm += "tags:\n";
		album.tags.forEach((t) => {
			fm += `  - ${t}\n`;
		});
	}
	if (album.photos.length > 0) {
		fm += "photos:\n";
		album.photos.forEach((p) => {
			fm += `  - ${p.src}\n`;
		});
	}
	if (album.draft) fm += "draft: true\n";
	fm += "---\n\n";
	if (album._body) fm += album._body + "\n";
	return fm;
}

async function loadAlbums() {
	try {
		const files = await listRepoFiles(contentDir);
		const mdFiles = files.filter((f) => f.name.endsWith(".md") || f.name.endsWith(".mdx"));
		const loaded: AlbumItem[] = [];

		for (const file of mdFiles) {
			try {
				const content = await getRepoFile(file.path);
				const slug = file.name.replace(/\.(md|mdx)$/, "");
				const album = parseAlbum(content, slug, file.sha);
				if (album) loaded.push(album);
			} catch (e) {
				console.warn("Failed to load album:", file.path, e);
			}
		}

		loaded.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
		albums = loaded;
		originalAlbums = deepClone(loaded);
		repoLoaded = true;
	} catch (e) {
		console.error("Failed to load albums:", e);
		showToast("加载相册失败", "error");
	}
}

const drafts = setupRepoDrafts({
	pageKey,
	pageName,
	getContent: () => JSON.stringify(albums),
	setContent: (v) => {
		try {
			const parsed = JSON.parse(v);
			if (Array.isArray(parsed)) albums = parsed;
		} catch {}
	},
	getPath: () => `${pageKey}-items`,
	getSha: () => null,
	setSha: () => {},
	getOriginalContent: () => JSON.stringify(originalAlbums),
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

function showSSRContent() {
	const ssr = document.querySelector("[data-album-ssr]");
	const editor = document.querySelector("[data-album-editor]");
	if (ssr) (ssr as HTMLElement).style.display = "";
	if (editor) (editor as HTMLElement).style.display = "none";
}

function hideSSRContent() {
	const ssr = document.querySelector("[data-album-ssr]");
	const editor = document.querySelector("[data-album-editor]");
	if (ssr) (ssr as HTMLElement).style.display = "none";
	if (editor) (editor as HTMLElement).style.display = "";
}

async function enterEditMode() {
	editMode = true;
	hideSSRContent();
	if (!repoLoaded) {
		await loadAlbums();
	}
}

function handleCancel() {
	editMode = false;
	albums = deepClone(originalAlbums);
	drafts.clearDrafts();
	editingIndex = -1;
	showSSRContent();
}

function addAlbum() {
	const newAlbum: AlbumItem = {
		slug: `new-album-${Date.now()}`,
		title: "新相册",
		date: new Date().toISOString().split("T")[0],
		photos: [],
		tags: [],
		_draft: true,
	};
	albums = [newAlbum, ...albums];
	editingIndex = 0;
	drafts.markDirty();
}

function editAlbum(index: number) {
	editingIndex = index;
}

function deleteAlbum(index: number) {
	if (!confirm("确定要删除这个相册吗？")) return;
	const album = albums[index];
	if (album._draft) {
		albums = albums.filter((_, i) => i !== index);
	} else {
		albums[index]._deleted = true;
	}
	drafts.markDirty();
	if (editingIndex === index) editingIndex = -1;
}

function saveAlbum(index: number) {
	editingIndex = -1;
	drafts.markDirty();
}

function updateAlbum(index: number, field: keyof AlbumItem, value: any) {
	(albums[index] as any)[field] = value;
	drafts.markDirty();
}

function updateTags(index: number, tagsStr: string) {
	albums[index].tags = tagsStr
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
	drafts.markDirty();
}

async function handleSave() {
	saving = true;
	try {
		const toCreate = albums.filter((a) => a._draft && !a._deleted);
		const toUpdate = albums.filter((a) => !a._draft && !a._deleted && a.sha);
		const toDelete = albums.filter((a) => a._deleted && !a._draft && a.sha);

		for (const album of toCreate) {
			const path = `${contentDir}/${album.slug}.md`;
			const content = buildAlbumContent(album);
			await createRepoFile(path, content, `feat: add album ${album.title}`);
		}

		for (const album of toUpdate) {
			const path = `${contentDir}/${album.slug}.md`;
			const content = buildAlbumContent(album);
			await updateRepoFile(path, content, album.sha!, `update album ${album.title}`);
		}

		for (const album of toDelete) {
			const path = `${contentDir}/${album.slug}.md`;
			await deleteRepoFile(path, album.sha!, `delete album ${album.title}`);
		}

		showToast("保存成功", "success");
		originalAlbums = deepClone(albums.filter((a) => !a._deleted));
		drafts.clearDrafts();
		editMode = false;
		showSSRContent();
		setTimeout(() => location.reload(), 800);
	} catch (e: any) {
		console.error("Save failed:", e);
		showToast(e?.message || "保存失败", "error");
	} finally {
		saving = false;
	}
}

onMount(() => {
	ensureIconify();
});
</script>

<div class="album-editor-wrap">
	<button class="edit-entry-btn" on:click="{enterEditMode}" title="编辑相册">
		<span class="iconify" data-icon="material-symbols:edit-outline"></span>
	</button>

	<div data-album-editor class="album-editor" style="display:none">
		<div class="editor-toolbar">
			<button class="btn-add" on:click="{addAlbum}">
				<span class="iconify" data-icon="material-symbols:add"></span>
				添加相册
			</button>
			<div class="toolbar-right">
				<button class="btn-cancel" on:click="{handleCancel}">取消</button>
				<button class="btn-save" class:disabled={saving} on:click="{handleSave}">
					{saving ? "保存中..." : "保存"}
				</button>
			</div>
		</div>

		<div class="album-list">
			{#each albums as album, index}
				{#if !album._deleted}
					<div class="album-item">
						{#if editingIndex === index}
							<div class="album-form">
								<div class="form-grid">
									<div class="form-field">
										<label>标题</label>
										<input
											type="text"
											value={album.title}
											on:input={(e) => updateAlbum(index, "title", e.target.value)}
										/>
									</div>
									<div class="form-field">
										<label>日期</label>
										<input
											type="date"
											value={album.date}
											on:input={(e) => updateAlbum(index, "date", e.target.value)}
										/>
									</div>
									<div class="form-field full">
										<label>标签（逗号分隔）</label>
										<input
											type="text"
											value={album.tags.join(", ")}
											on:input={(e) => updateTags(index, e.target.value)}
										/>
									</div>
									<div class="form-field full">
										<label>封面 URL</label>
										<input
											type="text"
											value={album.cover || ""}
											on:input={(e) => updateAlbum(index, "cover", e.target.value)}
										/>
									</div>
									<div class="form-field full">
										<label>照片 URL（每行一张）</label>
										<textarea
											rows={4}
											value={album.photos.map((p) => p.src).join("\n")}
											on:input={(e) => {
												const urls = e.target.value.split("\n").map((u) => u.trim()).filter(Boolean);
												albums[index].photos = urls.map((src) => ({ src }));
												drafts.markDirty();
											}}
										></textarea>
									</div>
								</div>
								<div class="form-actions">
									<button class="btn-done" on:click={() => saveAlbum(index)}>完成</button>
									<button class="btn-del" on:click={() => deleteAlbum(index)}>删除</button>
								</div>
							</div>
						{:else}
							<div class="album-display" on:click={() => editAlbum(index)}>
								<div class="album-info">
									<div class="album-title">{album.title || "(无标题)"}</div>
									<div class="album-meta">
										{album.date} · {album.photos.length} 张照片
										{#if album.tags.length > 0}
											 · {album.tags.join(", ")}
										{/if}
									</div>
								</div>
								<button class="btn-edit" on:click|stopPropagation={() => editAlbum(index)}>
									<span class="iconify" data-icon="material-symbols:edit"></span>
								</button>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
.album-editor-wrap {
	position: relative;
}

.edit-entry-btn {
	position: absolute;
	top: 0;
	right: 0;
	width: 36px;
	height: 36px;
	border-radius: 8px;
	border: none;
	background: var(--btn-regular-bg);
	color: var(--deep-text);
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 18px;
	opacity: 0;
	transition: all 0.2s;
	z-index: 10;
}

.album-editor-wrap:hover .edit-entry-btn {
	opacity: 1;
}

.edit-entry-btn:hover {
	background: var(--btn-plain-bg-hover);
}

.album-editor {
	margin: 20px 0;
}

.editor-toolbar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16px;
	padding: 12px 16px;
	background: var(--btn-regular-bg);
	border-radius: 12px;
}

.btn-add {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 8px 16px;
	border-radius: 8px;
	border: none;
	background: var(--primary);
	color: white;
	font-size: 14px;
	font-weight: 500;
	cursor: pointer;
}

.toolbar-right {
	display: flex;
	gap: 8px;
}

.btn-cancel {
	padding: 8px 16px;
	border-radius: 8px;
	border: 1px solid var(--border-color);
	background: transparent;
	color: var(--deep-text);
	font-size: 14px;
	cursor: pointer;
}

.btn-save {
	padding: 8px 20px;
	border-radius: 8px;
	border: none;
	background: var(--primary);
	color: white;
	font-size: 14px;
	font-weight: 500;
	cursor: pointer;
}

.btn-save:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.album-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.album-item {
	border-radius: 10px;
	overflow: hidden;
	border: 1px solid var(--border-color);
}

.album-display {
	display: flex;
	align-items: center;
	padding: 12px 16px;
	cursor: pointer;
	transition: background 0.15s;
}

.album-display:hover {
	background: var(--btn-plain-bg-hover);
}

.album-info {
	flex: 1;
	min-width: 0;
}

.album-title {
	font-size: 15px;
	font-weight: 600;
	color: var(--deep-text);
	margin-bottom: 2px;
}

.album-meta {
	font-size: 13px;
	color: var(--content-meta);
}

.btn-edit {
	width: 32px;
	height: 32px;
	border: none;
	background: transparent;
	color: var(--content-meta);
	cursor: pointer;
	border-radius: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.btn-edit:hover {
	background: var(--btn-plain-bg-hover);
	color: var(--deep-text);
}

.album-form {
	padding: 16px;
	background: var(--card-bg);
}

.form-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}

.form-field {
	display: flex;
	flex-direction: column;
}

.form-field.full {
	grid-column: 1 / -1;
}

.form-field label {
	font-size: 13px;
	font-weight: 500;
	color: var(--deep-text);
	margin-bottom: 6px;
}

.form-field input,
.form-field textarea {
	width: 100%;
	padding: 8px 12px;
	border: 1px solid var(--border-color);
	border-radius: 8px;
	background: var(--input-bg, #fff);
	color: var(--deep-text);
	font-size: 14px;
	font-family: inherit;
	box-sizing: border-box;
}

.form-field textarea {
	resize: vertical;
	font-family: monospace;
	font-size: 13px;
}

.form-actions {
	display: flex;
	gap: 8px;
	margin-top: 16px;
}

.btn-done {
	padding: 8px 20px;
	border-radius: 8px;
	border: none;
	background: var(--primary);
	color: white;
	font-size: 14px;
	cursor: pointer;
}

.btn-del {
	padding: 8px 16px;
	border-radius: 8px;
	border: 1px solid #ef4444;
	background: transparent;
	color: #ef4444;
	font-size: 14px;
	cursor: pointer;
}

.btn-del:hover {
	background: #fef2f2;
}

:global(.dark) .btn-del:hover {
	background: rgba(239, 68, 68, 0.1);
}

@media (max-width: 640px) {
	.form-grid {
		grid-template-columns: 1fr;
	}
}
</style>
