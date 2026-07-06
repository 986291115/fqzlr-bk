<script lang="ts">
import { onMount } from "svelte";
import {
	showToast,
	genId,
	deepClone,
	ensureIconify,
	getRepoFile,
	updateRepoFile,
	createRepoFile,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";

interface Photo {
	url: string;
	title?: string;
	desc?: string;
	isCover?: boolean;
}

interface AlbumItem {
	id?: string;
	title: string;
	desc?: string;
	date?: string;
	location?: string;
	tags?: string[];
	cover?: string;
	photos: Photo[];
	_draft?: boolean;
}

let editMode = $state(false);
let saving = $state(false);
let albums = $state<AlbumItem[]>([]);
let originalAlbums = $state<AlbumItem[]>([]);
let editingIndex = $state(-1);
let editingPhotosIndex = $state(-1);
let repoLoaded = $state(false);
let selectedPhotos = $state<Set<number>>(new Set());

const pageKey = "album";
const pageName = "相册";

function parseFrontmatter(content: string): Record<string, any> {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return {};
	const yaml = match[1];
	const result: Record<string, any> = {};
	const lines = yaml.split("\n");
	let currentKey = "";
	let currentValue = "";
	let inMultiline = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		if (inMultiline) {
			if (trimmed.startsWith("- ")) {
				if (!Array.isArray(result[currentKey])) {
					result[currentKey] = [];
				}
				result[currentKey].push(trimmed.slice(2).replace(/^['"]|['"]$/g, ""));
			} else if (!trimmed.startsWith(" ") && !trimmed.startsWith("\t")) {
				inMultiline = false;
			}
		}

		if (!inMultiline) {
			const colonIndex = trimmed.indexOf(":");
			if (colonIndex !== -1) {
				currentKey = trimmed.substring(0, colonIndex).trim();
				currentValue = trimmed.substring(colonIndex + 1).trim();
				if (currentValue.startsWith("[") && currentValue.endsWith("]")) {
					try {
						result[currentKey] = JSON.parse(currentValue);
					} catch {
						result[currentKey] = currentValue;
					}
				} else if (currentValue.startsWith("-")) {
					result[currentKey] = [currentValue.slice(2).replace(/^['"]|['"]$/g, "")];
					inMultiline = true;
				} else {
					result[currentKey] = currentValue.replace(/^['"]|['"]$/g, "");
				}
			}
		}
	}

	return result;
}

function buildAlbumMarkdown(album: AlbumItem): string {
	const frontmatter: Record<string, any> = {
		title: album.title,
		desc: album.desc || "",
		date: album.date || "",
		location: album.location || "",
		tags: album.tags || [],
		cover: album.cover || "",
		photos: album.photos.map(p => ({
			url: p.url,
			title: p.title || "",
			desc: p.desc || "",
			isCover: p.isCover || false,
		})),
	};

	let yaml = "---\n";
	for (const [key, value] of Object.entries(frontmatter)) {
		if (Array.isArray(value)) {
			yaml += `${key}:\n`;
			value.forEach(v => {
				yaml += `  - ${v}\n`;
			});
		} else if (typeof value === "object") {
			yaml += `${key}:\n`;
			for (const [k, v] of Object.entries(value)) {
				yaml += `  - ${k}: ${v}\n`;
			}
		} else {
			yaml += `${key}: "${value}"\n`;
		}
	}
	yaml += "---\n\n";

	return yaml;
}

const drafts = setupRepoDrafts({
	pageKey: "album",
	pageName: "相册",
	getContent: () => JSON.stringify(albums),
	setContent: (v) => {
		try {
			albums = JSON.parse(v);
		} catch {
			console.error("Failed to parse album drafts");
		}
	},
	getPath: () => "src/content/album",
	getSha: () => null,
	setSha: () => {},
	getOriginalContent: () => "",
	setOriginalContent: () => {},
	getCommitMsg: (isEdit) =>
		isEdit ? `chore: update albums` : `chore: create albums`,
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
	loadAlbums();

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
		if (!repoLoaded) {
			loadAlbums();
		}
		editMode = true;
		hideSSRGrid();
		editingIndex = -1;
		editingPhotosIndex = -1;
	} else {
		editMode = false;
		showSSRGrid();
	}
}

function handleSidebarSaveDraft(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== pageKey) return;
	drafts.saveToDrafts();
	showToast("已保存草稿", "success");
}

function handleSidebarSubmit(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== pageKey) return;
	handleSave();
}

function handleSidebarCancel(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== pageKey) return;
	handleCancel();
}

function handleSidebarAdd(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== pageKey) return;
	addAlbum();
}

async function loadAlbums() {
	const grid = document.getElementById("album-grid");
	if (!grid) return;

	const albumCards = grid.querySelectorAll(".album-card");
	let hasLoadedFromAPI = false;

	for (const card of albumCards) {
		const link = card.querySelector("a") as HTMLAnchorElement;
		if (!link) continue;

		const albumId = link.href.split("/album/")[1]?.replace("/", "");
		if (!albumId) continue;

		try {
			const filePath = `src/content/album/${albumId}.md`;
			const existing = await getRepoFile(filePath);
			if (existing && existing.content) {
				const frontmatter = parseFrontmatter(existing.content);
				const photos: Photo[] = [];
				if (Array.isArray(frontmatter.photos)) {
					frontmatter.photos.forEach((p: any) => {
						photos.push({
							url: p.url || p,
							title: p.title,
							desc: p.desc,
							isCover: p.isCover,
						});
					});
				}

				const existingAlbumIndex = albums.findIndex(a => a.id === albumId);
				if (existingAlbumIndex >= 0) {
					albums[existingAlbumIndex] = {
						id: albumId,
						title: frontmatter.title || albums[existingAlbumIndex].title,
						desc: frontmatter.desc || albums[existingAlbumIndex].desc,
						date: frontmatter.date || albums[existingAlbumIndex].date,
						location: frontmatter.location || albums[existingAlbumIndex].location,
						tags: frontmatter.tags || albums[existingAlbumIndex].tags || [],
						cover: frontmatter.cover || albums[existingAlbumIndex].cover,
						photos,
					};
				} else {
					albums = [...albums, {
						id: albumId,
						title: frontmatter.title || "",
						desc: frontmatter.desc,
						date: frontmatter.date,
						location: frontmatter.location,
						tags: frontmatter.tags || [],
						cover: frontmatter.cover,
						photos,
					}];
				}
				hasLoadedFromAPI = true;
			}
		} catch (e) {
			console.warn("Failed to load album from API:", albumId, e);
		}
	}

	albums = [...albums];
	originalAlbums = deepClone(albums);
	repoLoaded = true;
	drafts.restoreFromDrafts();
}

function collectFromDOM() {
	const grid = document.getElementById("album-grid");
	if (!grid) return;

	const items: AlbumItem[] = [];
	grid.querySelectorAll(".album-card").forEach((card) => {
		const el = card as HTMLElement;
		const link = el.tagName === "A" ? (el as HTMLAnchorElement) : (el.querySelector("a") as HTMLAnchorElement);
		if (!link) return;

		const title = el.querySelector(".album-card-title")?.textContent?.trim() || "";
		const metaEl = el.querySelector(".album-card-meta");
		const dateSpans = metaEl?.querySelectorAll("span");
		let date = "";
		let location = "";
		if (dateSpans) {
			dateSpans.forEach(span => {
				if (!span.classList.contains("album-card-location")) {
					date = span.textContent?.trim() || "";
				} else {
					location = span.textContent?.trim() || "";
				}
			});
		}
		const img = el.querySelector(".album-card-img") as HTMLImageElement;
		const tags = Array.from(el.querySelectorAll(".album-card-tag-overlay")).map(t => t.textContent?.trim() || "");

		const albumId = link.href.split("/album/")[1]?.replace("/", "");

		items.push({
			id: albumId || genId("al"),
			title,
			desc: "",
			date,
			location,
			tags: tags.length > 0 ? tags : [],
			cover: img?.src || "",
			photos: [],
		});
	});

	if (items.length > 0) {
		if (albums.length === 0) {
			albums = items;
			originalAlbums = deepClone(items);
		} else {
			for (const item of items) {
				const existingIndex = albums.findIndex(a => a.id === item.id);
				if (existingIndex >= 0) {
					if (!albums[existingIndex].title) albums[existingIndex].title = item.title;
					if (!albums[existingIndex].cover) albums[existingIndex].cover = item.cover;
					if (!albums[existingIndex].date) albums[existingIndex].date = item.date;
				} else {
					albums = [...albums, item];
				}
			}
			albums = [...albums];
		}
	}
}

function hideSSRGrid() {
	const grid = document.getElementById("album-grid");
	if (grid) grid.style.display = "none";
}

function showSSRGrid() {
	const grid = document.getElementById("album-grid");
	if (grid) grid.style.display = "";
}

function handleCancel() {
	editMode = false;
	albums = deepClone(originalAlbums);
	drafts.clearDrafts();
	editingIndex = -1;
	editingPhotosIndex = -1;
	selectedPhotos = new Set();
	showSSRGrid();
}

function startEdit(index: number) {
	editingIndex = index;
	editingPhotosIndex = -1;
}

function finishEdit(index: number) {
	const album = albums[index];
	if (!album.title.trim()) {
		showToast("相册名称不能为空", "warning");
		return;
	}
	editingIndex = -1;
	showToast("已修改，记得点击保存", "info");
}

function cancelItemEdit(index: number) {
	const album = albums[index];
	if (album._draft && !album.title.trim()) {
		albums = albums.filter((_, i) => i !== index);
	} else {
		const orig = originalAlbums.find(
			(o) => o.id === album.id && !album._draft,
		);
		if (orig) {
			albums[index] = deepClone(orig);
			albums = [...albums];
		}
	}
	editingIndex = -1;
}

function deleteAlbum(index: number) {
	const album = albums[index];
	if (!confirm(`确定要删除相册「${album.title || "未命名"}」吗？`)) return;
	albums = albums.filter((_, i) => i !== index);
	if (editingIndex === index) editingIndex = -1;
	else if (editingIndex > index) editingIndex--;
	showToast("已删除，记得点击保存", "info");
}

function addAlbum() {
	const newAlbum: AlbumItem = {
		id: genId("al"),
		title: "",
		desc: "",
		date: new Date().toISOString().split("T")[0],
		location: "",
		tags: [],
		cover: "",
		photos: [],
		_draft: true,
	};
	albums = [...albums, newAlbum];
	editingIndex = albums.length - 1;
}

function openPhotos(index: number) {
	editingPhotosIndex = index;
	selectedPhotos = new Set();
}

function closePhotos() {
	editingPhotosIndex = -1;
	selectedPhotos = new Set();
}

function togglePhotoSelection(index: number) {
	if (selectedPhotos.has(index)) {
		selectedPhotos.delete(index);
	} else {
		selectedPhotos.add(index);
	}
	selectedPhotos = new Set(selectedPhotos);
}

function selectAllPhotos() {
	const album = albums[editingPhotosIndex];
	if (!album) return;
	for (let i = 0; i < album.photos.length; i++) {
		selectedPhotos.add(i);
	}
	selectedPhotos = new Set(selectedPhotos);
}

function deselectAllPhotos() {
	selectedPhotos = new Set();
}

function deleteSelectedPhotos() {
	if (selectedPhotos.size === 0) {
		showToast("请先选择要删除的照片", "warning");
		return;
	}
	if (!confirm(`确定要删除选中的 ${selectedPhotos.size} 张照片吗？`)) return;

	const album = albums[editingPhotosIndex];
	if (!album) return;

	album.photos = album.photos.filter((_, i) => !selectedPhotos.has(i));
	if (album.photos.length === 0) {
		album.cover = "";
	}
	albums = [...albums];
	selectedPhotos = new Set();
	showToast(`已删除 ${selectedPhotos.size} 张照片`, "info");
}

function deleteSinglePhoto(index: number) {
	if (!confirm("确定要删除这张照片吗？")) return;

	const album = albums[editingPhotosIndex];
	if (!album) return;

	album.photos.splice(index, 1);
	if (album.photos.length === 0) {
		album.cover = "";
	}
	albums = [...albums];
	showToast("已删除照片", "info");
}

function setCover(index: number) {
	const album = albums[editingPhotosIndex];
	if (!album) return;

	album.photos.forEach((p, i) => {
		p.isCover = i === index;
	});
	album.cover = album.photos[index].url;
	albums = [...albums];
	showToast("已设为封面", "success");
}

function addPhoto() {
	const album = albums[editingPhotosIndex];
	if (!album) return;

	const url = prompt("请输入照片URL：");
	if (url && url.trim()) {
		album.photos.push({
			url: url.trim(),
			title: "",
			desc: "",
			isCover: album.photos.length === 0,
		});
		if (album.photos.length === 1) {
			album.cover = url.trim();
		}
		albums = [...albums];
		showToast("已添加照片", "success");
	}
}

function updateAlbumField(index: number, field: keyof AlbumItem, value: string) {
	albums[index] = { ...albums[index], [field]: value };
	albums = [...albums];
}

async function handleSave() {
	if (editingIndex >= 0) {
		finishEdit(editingIndex);
		if (editingIndex >= 0) return;
	}

	saving = true;
	try {
		const cleanAlbums = albums.map(({ _draft, ...rest }) => ({
			...rest,
			id: rest.id || genId("al"),
		}));

		for (const album of cleanAlbums) {
			const content = buildAlbumMarkdown(album);
			const filePath = `src/content/album/${album.id}.md`;
			const existing = await getRepoFile(filePath);
			if (existing) {
				await updateRepoFile(filePath, content, existing.sha, `chore: update album ${album.title}`);
			} else {
				await createRepoFile(filePath, content, `chore: create album ${album.title}`);
			}
		}

		drafts.saveToDrafts();
		await drafts.submitDrafts();
	} catch (e: any) {
		console.error("Save failed:", e);
		showToast(e?.message || "保存失败", "error");
	} finally {
		saving = false;
	}
}
</script>

{#if editMode && editingPhotosIndex >= 0}
	<div class="album-photos-editor" id="album-photos-editor">
		<div class="photos-editor-header">
			<button class="photos-back-btn" onclick={closePhotos}>
				<iconify-icon icon="material-symbols:arrow-back-rounded"></iconify-icon>
				返回相册列表
			</button>
			<div class="photos-editor-title">
				编辑「{albums[editingPhotosIndex]?.title || "未命名"}」的照片
			</div>
			<div class="photos-editor-actions">
				<button class="photos-action-btn" onclick={addPhoto}>
					<iconify-icon icon="material-symbols:add-photo-alternate-rounded"></iconify-icon>
					添加照片
				</button>
				{#if selectedPhotos.size > 0}
					<button class="photos-action-btn photos-action-btn-danger" onclick={deleteSelectedPhotos}>
						<iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
						删除选中 ({selectedPhotos.size})
					</button>
				{/if}
			</div>
		</div>

		<div class="photos-select-bar">
			<button class="select-bar-btn" onclick={selectAllPhotos}>全选</button>
			<button class="select-bar-btn" onclick={deselectAllPhotos}>取消全选</button>
			<span class="select-bar-count">已选 {selectedPhotos.size} 张</span>
		</div>

		<div class="photos-grid">
			{#each albums[editingPhotosIndex]?.photos as photo, i}
				<div class="photo-item" class:photo-selected={selectedPhotos.has(i)}>
					<div class="photo-checkbox" onclick={(e) => { e.stopPropagation(); togglePhotoSelection(i); }}>
						{#if selectedPhotos.has(i)}
							<iconify-icon icon="material-symbols:check-circle"></iconify-icon>
						{:else}
							<iconify-icon icon="material-symbols:circle-outline"></iconify-icon>
						{/if}
					</div>
					<div class="photo-image-wrap">
						<img src={photo.url} alt={photo.title || ""} loading="lazy" />
						{#if photo.isCover}
							<div class="photo-cover-badge">封面</div>
						{/if}
					</div>
					<div class="photo-actions">
						<button class="photo-action-btn" onclick={() => setCover(i)} title="设为封面">
							<iconify-icon icon="material-symbols:image-aspect-ratio"></iconify-icon>
						</button>
						<button class="photo-action-btn photo-action-btn-danger" onclick={() => deleteSinglePhoto(i)} title="删除">
							<iconify-icon icon="material-symbols:delete-outline"></iconify-icon>
						</button>
					</div>
				</div>
			{/each}

			{#if albums[editingPhotosIndex]?.photos.length === 0}
				<div class="photos-empty-state">
					<iconify-icon icon="material-symbols:photo-library" class="text-4xl mb-2 opacity-40"></iconify-icon>
					<p>暂无照片，点击"添加照片"开始添加</p>
				</div>
			{/if}
		</div>
	</div>
{:else if editMode}
	<div class="edit-albums-grid" id="edit-albums-grid">
		{#each albums as album, i}
			<div
				class="edit-album-card"
				class:edit-album-card-draft={album._draft}
				class:edit-album-card-editing={editingIndex === i}
			>
				{#if editingIndex !== i}
					<div class="card-action-row">
						<button class="action-btn action-edit" onclick={() => startEdit(i)} title="编辑相册信息">
							<iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
						</button>
						<button class="action-btn action-photos" onclick={() => openPhotos(i)} title="管理照片">
							<iconify-icon icon="material-symbols:collections-rounded"></iconify-icon>
						</button>
						<button class="action-btn action-delete" onclick={() => deleteAlbum(i)} title="删除相册">
							<iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
						</button>
					</div>

					<div class="card-display">
						<div class="card-cover-wrap">
							{#if album.cover}
								<img src={album.cover} alt={album.title} class="card-cover" loading="lazy" />
							{:else}
								<div class="card-cover-placeholder">
									<iconify-icon icon="material-symbols:photo-album"></iconify-icon>
								</div>
							{/if}
						</div>
						<div class="card-info">
							<h3 class="card-title">{album.title || "（未命名）"}</h3>
							<p class="card-desc">{album.desc || "暂无描述"}</p>
							<div class="card-meta">
								{#if album.date}
									<span>{album.date}</span>
								{/if}
								{#if album.location}
									<span>{album.location}</span>
								{/if}
								<span>{album.photos.length} 张照片</span>
							</div>
							{#if album.tags && album.tags.length > 0}
								<div class="card-tags">
									{#each album.tags.slice(0, 3) as tag}
										<span class="card-tag">{tag}</span>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<div class="card-edit-form">
						<div class="edit-form-header">
							<iconify-icon icon="material-symbols:edit-document-outline-rounded" class="text-lg"></iconify-icon>
							<span>编辑相册</span>
							{#if album._draft}
								<span class="draft-badge">新增</span>
							{/if}
						</div>
						<div class="form-group">
							<label>相册名称</label>
							<input
								type="text"
								value={album.title}
								oninput={(e) => updateAlbumField(i, "title", (e.target as HTMLInputElement).value)}
								placeholder="相册名称"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>相册描述</label>
							<textarea
								value={album.desc || ""}
								oninput={(e) => updateAlbumField(i, "desc", (e.target as HTMLTextAreaElement).value)}
								placeholder="相册描述"
								class="form-textarea"
								rows={2}
							></textarea>
						</div>
						<div class="form-group">
							<label>日期</label>
							<input
								type="date"
								value={album.date || ""}
								oninput={(e) => updateAlbumField(i, "date", (e.target as HTMLInputElement).value)}
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>地点</label>
							<input
								type="text"
								value={album.location || ""}
								oninput={(e) => updateAlbumField(i, "location", (e.target as HTMLInputElement).value)}
								placeholder="地点"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>标签（用逗号分隔）</label>
							<input
								type="text"
								value={album.tags?.join(", ") || ""}
								oninput={(e) => {
									const tags = (e.target as HTMLInputElement).value.split(",").map(t => t.trim()).filter(Boolean);
									albums[i] = { ...albums[i], tags };
									albums = [...albums];
								}}
								placeholder="标签1, 标签2"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>封面URL</label>
							<input
								type="text"
								value={album.cover || ""}
								oninput={(e) => updateAlbumField(i, "cover", (e.target as HTMLInputElement).value)}
								placeholder="https://example.com/cover.jpg"
								class="form-input"
							/>
						</div>
						<div class="form-actions">
							<button class="form-btn form-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
							<button class="form-btn form-btn-save" onclick={() => finishEdit(i)}>完成</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}

		{#if albums.length === 0}
			<div class="empty-state">
				<iconify-icon icon="material-symbols:photo-library" class="text-4xl mb-2 opacity-40"></iconify-icon>
				<p>暂无相册，点击"添加"开始添加</p>
			</div>
		{/if}
	</div>
{/if}

<style>
	.edit-albums-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
	}

	.edit-album-card {
		position: relative;
		border-radius: 16px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0,0,0,0.08));
		overflow: hidden;
		transition: all 0.2s;
	}
	:global(.dark) .edit-album-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255,255,255,0.08);
	}
	.edit-album-card:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0,0,0,0.08);
	}
	.edit-album-card-draft {
		border-style: dashed;
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
	}
	.edit-album-card-editing {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
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
	.action-edit { background: rgba(59, 130, 246, 1); }
	.action-edit:hover { background: rgba(37, 99, 235, 1); transform: scale(1.1); }
	.action-photos { background: rgba(16, 185, 129, 1); }
	.action-photos:hover { background: rgba(5, 150, 105, 1); transform: scale(1.1); }
	.action-delete { background: rgba(239, 68, 68, 1); }
	.action-delete:hover { background: rgba(220, 38, 38, 1); transform: scale(1.1); }

	.card-display { padding: 0; }
	.card-cover-wrap {
		width: 100%;
		height: 180px;
		overflow: hidden;
		background: var(--btn-regular-bg, #f3f4f6);
		position: relative;
	}
	:global(.dark) .card-cover-wrap { background: rgba(255,255,255,0.05); }
	.card-cover {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.card-cover-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--content-meta, #9ca3af);
		font-size: 48px;
	}
	.card-info { padding: 16px; }
	.card-title {
		margin: 0 0 4px;
		font-size: 16px;
		font-weight: 700;
		color: var(--text-color, #1f2937);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(.dark) .card-title { color: #f0f0f0; }
	.card-desc {
		margin: 0 0 8px;
		font-size: 13px;
		color: var(--text-secondary, #6b7280);
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	:global(.dark) .card-desc { color: #9ca3af; }
	.card-meta {
		display: flex;
		gap: 8px;
		font-size: 11px;
		color: var(--content-meta, #9ca3af);
		margin-bottom: 8px;
	}
	.card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.card-tag {
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--btn-regular-bg, #f3f4f6);
		color: var(--text-secondary, #6b7280);
		font-size: 11px;
	}
	:global(.dark) .card-tag { background: rgba(255,255,255,0.05); color: #9ca3af; }

	.card-edit-form { padding: 20px; }
	.edit-form-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
		font-size: 14px;
		font-weight: 600;
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.draft-badge {
		padding: 1px 8px;
		border-radius: 999px;
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		font-size: 11px;
		font-weight: 600;
	}
	.form-group { margin-bottom: 12px; }
	.form-group label {
		display: block;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary, #4b5563);
		margin-bottom: 4px;
	}
	:global(.dark) .form-group label { color: #d1d5db; }
	.form-input, .form-textarea {
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
	:global(.dark) .form-input, :global(.dark) .form-textarea {
		background: #0f0f1a;
		border-color: #374151;
		color: #e5e7eb;
	}
	.form-input:focus, .form-textarea:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	.form-textarea { resize: vertical; min-height: 50px; }
	.form-actions { display: flex; gap: 8px; margin-top: 16px; }
	.form-btn {
		flex: 1;
		padding: 8px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.form-btn-cancel { background: var(--bg-secondary, #f3f4f6); color: var(--text-color, #374151); }
	.form-btn-cancel:hover { background: var(--border, #e5e7eb); }
	:global(.dark) .form-btn-cancel { background: #2d2d44; color: #d1d5db; }
	.form-btn-save { background: hsl(var(--theme-hue, 165), 70%, 50%); color: white; }
	.form-btn-save:hover { background: hsl(var(--theme-hue, 165), 75%, 45%); }

	.empty-state {
		grid-column: 1 / -1;
		text-align: center;
		padding: 48px 20px;
		color: var(--content-meta, #9ca3af);
		font-size: 14px;
	}

	.album-photos-editor {
		background: var(--bg-color, white);
		border-radius: 16px;
		padding: 20px;
	}
	:global(.dark) .album-photos-editor { background: rgba(23, 23, 23, 0.8); }

	.photos-editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}
	.photos-back-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: 8px;
		border: 1px solid var(--border, #d1d5db);
		background: transparent;
		color: var(--text-color, #1f2937);
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		transition: all 0.2s;
	}
	:global(.dark) .photos-back-btn { border-color: #374151; color: #e5e7eb; }
	.photos-back-btn:hover { background: var(--bg-secondary, #f3f4f6); }
	:global(.dark) .photos-back-btn:hover { background: #2d2d44; }

	.photos-editor-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-color, #1f2937);
	}
	:global(.dark) .photos-editor-title { color: #f0f0f0; }

	.photos-editor-actions {
		display: flex;
		gap: 8px;
	}
	.photos-action-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: 8px;
		border: none;
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		transition: all 0.2s;
	}
	.photos-action-btn:hover { background: hsl(var(--theme-hue, 165), 75%, 45%); }
	.photos-action-btn-danger {
		background: rgba(239, 68, 68, 1);
	}
	.photos-action-btn-danger:hover { background: rgba(220, 38, 38, 1); }

	.photos-select-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: var(--bg-secondary, #f3f4f6);
		border-radius: 8px;
		margin-bottom: 16px;
	}
	:global(.dark) .photos-select-bar { background: rgba(255,255,255,0.05); }
	.select-bar-btn {
		padding: 6px 12px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--text-secondary, #6b7280);
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.2s;
	}
	:global(.dark) .select-bar-btn { color: #9ca3af; }
	.select-bar-btn:hover { background: var(--border, #e5e7eb); }
	:global(.dark) .select-bar-btn:hover { background: #374151; }
	.select-bar-count {
		font-size: 12px;
		color: var(--content-meta, #9ca3af);
		margin-left: auto;
	}

	.photos-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 12px;
	}

	.photo-item {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		border: 2px solid transparent;
		transition: all 0.2s;
	}
	.photo-selected {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
	}
	.photo-checkbox {
		position: absolute;
		top: 8px;
		left: 8px;
		z-index: 10;
		cursor: pointer;
		background: rgba(0,0,0,0.5);
		border-radius: 50%;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.photo-checkbox iconify-icon {
		color: white;
		font-size: 18px;
	}
	.photo-image-wrap {
		width: 100%;
		height: 140px;
		overflow: hidden;
		position: relative;
	}
	.photo-image-wrap img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.photo-cover-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		padding: 2px 8px;
		border-radius: 4px;
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		font-size: 10px;
		font-weight: 600;
	}
	.photo-actions {
		position: absolute;
		bottom: 8px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.photo-item:hover .photo-actions {
		opacity: 1;
	}
	.photo-action-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		border: none;
		background: rgba(0,0,0,0.6);
		color: white;
		cursor: pointer;
		font-size: 14px;
		transition: all 0.15s;
	}
	.photo-action-btn:hover { background: rgba(0,0,0,0.8); transform: scale(1.1); }
	.photo-action-btn-danger { background: rgba(239, 68, 68, 0.8); }
	.photo-action-btn-danger:hover { background: rgba(220, 38, 38, 0.9); }

	.photos-empty-state {
		grid-column: 1 / -1;
		text-align: center;
		padding: 48px 20px;
		color: var(--content-meta, #9ca3af);
		font-size: 14px;
	}
</style>