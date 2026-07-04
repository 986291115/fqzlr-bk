<script lang="ts">
import { onMount } from "svelte";
import EditToast from "./EditToast.svelte";
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

interface NotebookItem {
	id: string;
	folderName: string;
	name: string;
	cover: string;
	summary: string;
	tags: string[];
	entries: number;
	updatedAt: string;
	sha?: string;
	_draft?: boolean;
	_deleted?: boolean;
}

let editMode = $state(false);
let saving = $state(false);
let notebooks = $state<NotebookItem[]>([]);
let originalNotebooks = $state<NotebookItem[]>([]);
let originalNotebooksJson = $state("");
let editingIndex = $state(-1);
let modalItem = $state<NotebookItem | null>(null);
let modalMode = $state<"add" | "edit">("add");
let tagsInput = $state("");

const pageKey = "notebooks";
const pageName = "笔记本";

function serializeNotebooks(): string {
	return JSON.stringify(
		notebooks.map((n) => ({
			id: n.id,
			folderName: n.folderName,
			name: n.name,
			cover: n.cover,
			summary: n.summary,
			tags: n.tags,
			entries: n.entries,
			updatedAt: n.updatedAt,
			_draft: n._draft,
			_deleted: n._deleted,
		})),
	);
}

function deserializeNotebooks(json: string) {
	try {
		const parsed = JSON.parse(json);
		if (Array.isArray(parsed)) {
			notebooks = parsed.map((e: any) => ({
				id: e.id || genId("nb"),
				folderName: e.folderName || "",
				name: e.name || "未命名笔记本",
				cover: e.cover || "",
				summary: e.summary || "",
				tags: Array.isArray(e.tags) ? e.tags : [],
				entries: e.entries || 0,
				updatedAt: e.updatedAt || new Date().toISOString().slice(0, 10),
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
	getContent: () => serializeNotebooks(),
	setContent: (v) => deserializeNotebooks(v),
	getPath: () => "notebooks-items",
	getSha: () => null,
	setSha: () => {},
	getOriginalContent: () => originalNotebooksJson,
	setOriginalContent: () => {},
	getCommitMsg: () => "chore(notebooks): 更新笔记本",
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
	originalNotebooksJson = serializeNotebooks();

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
	const grid = document.querySelector(".diary-grid, [data-notebooks-grid]");
	if (!grid) return;

	const result: NotebookItem[] = [];
	const cards = grid.querySelectorAll(".diary-notebook, [data-notebook-item]");

	cards.forEach((el) => {
		const name = el.querySelector(".diary-cover-name, h3, .notebook-name")?.textContent?.trim() || "未命名";
		const summary = el.querySelector(".diary-cover-desc, .notebook-summary")?.textContent?.trim() || "";
		const img = el.querySelector(".diary-cover-img, img") as HTMLImageElement | null;
		const cover = img?.src || "";
		const link = el.querySelector("a")?.getAttribute("href") || "";
		const folderMatch = link.match(/\/life\/notebooks\/([^/]+)\//);
		const folderName = folderMatch ? folderMatch[1] : name.toLowerCase().replace(/\s+/g, "-");
		const entriesText = el.querySelector(".diary-cover-meta, .entries-count")?.textContent?.trim() || "";
		const entriesMatch = entriesText.match(/(\d+)/);
		const entries = entriesMatch ? parseInt(entriesMatch[1]) : 0;
		const dateText = el.querySelector(".diary-notebook-footer span, .updated-at")?.textContent?.trim() || "";

		result.push({
			id: folderName || genId("nb"),
			folderName,
			name,
			cover,
			summary,
			tags: [],
			entries,
			updatedAt: dateText || new Date().toISOString().slice(0, 10),
		});
	});

	if (result.length > 0) {
		notebooks = result;
		originalNotebooks = deepClone(result);
	}
}

function hideSSRContent() {
	const selectors = [
		".diary-grid",
		".diary-empty",
		"[data-notebooks-grid]",
	];
	selectors.forEach((sel) => {
		document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
			el.style.display = "none";
		});
	});
}

function showSSRContent() {
	const selectors = [
		".diary-grid",
		".diary-empty",
		"[data-notebooks-grid]",
	];
	selectors.forEach((sel) => {
		document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
			el.style.display = "";
		});
	});
}

function handleCancel() {
	notebooks = deepClone(originalNotebooks);
	editingIndex = -1;
	drafts.clearDrafts();
	showSSRContent();
}

function openAddModal() {
	const today = new Date().toISOString().slice(0, 10);
	modalItem = {
		id: genId("nb"),
		folderName: "",
		name: "",
		cover: "",
		summary: "",
		tags: [],
		entries: 0,
		updatedAt: today,
		_draft: true,
	};
	tagsInput = "";
	modalMode = "add";
}

function openEditModal(index: number) {
	const item = notebooks.filter((n) => !n._deleted)[index];
	if (!item) return;
	const realIndex = notebooks.findIndex((n) => n.id === item.id);
	if (realIndex < 0) return;

	editingIndex = realIndex;
	modalItem = deepClone(notebooks[realIndex]);
	tagsInput = notebooks[realIndex].tags.join(", ");
	modalMode = "edit";
}

function closeModal() {
	modalItem = null;
	editingIndex = -1;
}

function saveModal() {
	if (!modalItem) return;
	if (!modalItem.name.trim()) {
		showToast("笔记本名称不能为空", "warning");
		return;
	}

	modalItem.tags = tagsInput
		.split(/[,，、\s]+/)
		.map((s) => s.trim())
		.filter((s) => s);

	if (!modalItem.folderName) {
		modalItem.folderName = slugify(modalItem.name);
	}

	if (modalMode === "add") {
		notebooks = [modalItem, ...notebooks];
		showToast("已添加，记得点击保存", "info");
	} else {
		if (editingIndex >= 0) {
			notebooks[editingIndex] = { ...modalItem };
			notebooks = [...notebooks];
			showToast("已修改，记得点击保存", "info");
		}
	}

	closeModal();
}

function deleteItem(index: number) {
	const item = notebooks.filter((n) => !n._deleted)[index];
	if (!item) return;
	const realIndex = notebooks.findIndex((n) => n.id === item.id);
	if (realIndex < 0) return;

	if (!confirm(`确定要删除「${item.name}」吗？`)) return;

	if (item._draft) {
		notebooks = notebooks.filter((_, i) => i !== realIndex);
	} else {
		notebooks[realIndex] = { ...notebooks[realIndex], _deleted: true };
		notebooks = [...notebooks];
	}

	showToast("已标记删除，记得点击保存", "info");
}

function restoreItem(index: number) {
	const realIndex = notebooks.findIndex(
		(n) => n.id === notebooks.filter((x) => !x._deleted)[index]?.id,
	);
	if (realIndex < 0) return;
	notebooks[realIndex] = { ...notebooks[realIndex], _deleted: false };
	notebooks = [...notebooks];
}

function slugify(text: string): string {
	return (
		text
			.toLowerCase()
			.trim()
			.replace(/[\s]+/g, "-")
			.replace(/[^\w\u4e00-\u9fa5-]/g, "")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "") || "notebook"
	);
}

function buildNotebookJson(item: NotebookItem): string {
	const data = {
		name: item.name,
		cover: item.cover,
		summary: item.summary,
		tags: item.tags,
	};
	return JSON.stringify(data, null, 2) + "\n";
}

async function submitNotebooks(items: NotebookItem[]): Promise<boolean> {
	let allOk = true;

	for (let i = 0; i < items.length; i++) {
		const entry = items[i];
		const folderName = entry.folderName || slugify(entry.name);
		const indexPath = `src/content/life/notebooks/${folderName}/_index.json`;

		if (entry._deleted) {
			if (!entry._draft && entry.folderName) {
				const file = await getRepoFile(indexPath, repoConfig);
				if (file && file.sha) {
					const ok = await deleteRepoFile(
						indexPath,
						file.sha,
						`chore(notebooks): remove ${folderName}`,
						repoConfig,
					);
					if (!ok) allOk = false;
				}
			}
			continue;
		}

		const jsonContent = buildNotebookJson(entry);

		if (entry._draft || !entry.folderName) {
			const ok = await createRepoFile(
				indexPath,
				jsonContent,
				`chore(notebooks): add ${folderName}`,
				repoConfig,
			);
			if (!ok) allOk = false;
		} else {
			let sha = entry.sha;
			if (!sha) {
				const file = await getRepoFile(indexPath, repoConfig);
				if (file) sha = file.sha;
			}
			if (sha) {
				const ok = await updateRepoFile(
					indexPath,
					jsonContent,
					sha,
					`chore(notebooks): update ${folderName}`,
					repoConfig,
				);
				if (!ok) allOk = false;
			} else {
				const ok = await createRepoFile(
					indexPath,
					jsonContent,
					`chore(notebooks): create ${folderName}`,
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
		const ok = await submitNotebooks(notebooks);
		if (ok) {
			showToast("保存成功！页面将刷新以应用更改", "success");
			drafts.clearDrafts();
			originalNotebooks = deepClone(notebooks);
			originalNotebooksJson = serializeNotebooks();
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
		let parsedItems: NotebookItem[] = [];
		try {
			const parsed = JSON.parse(String(draft.payload.content));
			if (Array.isArray(parsed)) {
				parsedItems = parsed.map((e: any) => ({
					id: e.id || genId("nb"),
					folderName: e.folderName || "",
					name: e.name || "未命名笔记本",
					cover: e.cover || "",
					summary: e.summary || "",
					tags: Array.isArray(e.tags) ? e.tags : [],
					entries: e.entries || 0,
					updatedAt: e.updatedAt || new Date().toISOString().slice(0, 10),
					_draft: !!e._draft,
					_deleted: !!e._deleted,
				}));
			}
		} catch {
			return false;
		}
		return await submitNotebooks(parsedItems);
	}
	return false;
});

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		closeModal();
	}
}

function getGridCols(count: number) {
	if (count <= 1) return 1;
	if (count === 2) return 2;
	return 3;
}
</script>

<EditToast />

{#if editMode}
  <div class="nb-editor">
    <div class="nb-grid">
      {#each notebooks.filter(n => !n._deleted) as item, i (i + "-" + item.id)}
        <div
          class="nb-card"
          class:nb-card-draft={item._draft}
          class:nb-card-deleted={item._deleted}
        >
          <div class="nb-card-actions">
            <button class="nb-action-btn nb-action-edit" onclick={() => openEditModal(i)} title="编辑">
              <iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
            </button>
            <button class="nb-action-btn nb-action-delete" onclick={() => deleteItem(i)} title="删除">
              <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
            </button>
          </div>

          <div class="nb-card-cover">
            {#if item.cover}
              <img src={item.cover} alt={item.name} loading="lazy" />
            {:else}
              <div class="nb-card-cover-placeholder">
                <span class="nb-cover-emoji">📔</span>
              </div>
            {/if}
          </div>

          <div class="nb-card-body">
            <div class="nb-card-tags">
              <span class="nb-tag">笔记</span>
              <span class="nb-meta">{item.entries} 篇</span>
            </div>
            <h3 class="nb-card-name">{item.name || "未命名笔记本"}</h3>
            <p class="nb-card-summary">{item.summary || "暂无描述"}</p>
          </div>

          <div class="nb-card-footer">
            <span class="nb-date">{item.updatedAt}</span>
            <iconify-icon icon="material-symbols:chevron-right-rounded"></iconify-icon>
          </div>

          {#if item._draft}
            <span class="nb-draft-badge">新增</span>
          {/if}
        </div>
      {/each}
    </div>

    {#if notebooks.filter(n => !n._deleted).length === 0}
      <div class="nb-empty">
        <iconify-icon icon="material-symbols:menu-book-outline" style="font-size:48px;opacity:0.3;"></iconify-icon>
        <p>暂无笔记本，点击"添加"创建第一个</p>
      </div>
    {/if}
  </div>

  <!-- Modal -->
  {#if modalItem}
    <div class="nb-modal-overlay" onclick={closeModal} onkeydown={handleKeydown} tabindex="0">
      <div class="nb-modal" onclick={(e) => e.stopPropagation()}>
        <div class="nb-modal-header">
          <iconify-icon icon="material-symbols:edit-document-outline-rounded"></iconify-icon>
          <span>{modalMode === "add" ? "添加笔记本" : "编辑笔记本"}</span>
          <button class="nb-modal-close" onclick={closeModal}>
            <iconify-icon icon="material-symbols:close-rounded"></iconify-icon>
          </button>
        </div>

        <div class="nb-modal-body">
          <div class="nb-form-group">
            <label>名称 *</label>
            <input
              type="text"
              class="nb-input"
              bind:value={modalItem.name}
              placeholder="笔记本名称"
            />
          </div>

          <div class="nb-form-group">
            <label>封面图 URL</label>
            <input
              type="text"
              class="nb-input"
              bind:value={modalItem.cover}
              placeholder="https://example.com/cover.jpg"
            />
          </div>

          <div class="nb-form-group">
            <label>描述</label>
            <textarea
              class="nb-textarea"
              bind:value={modalItem.summary}
              rows={3}
              placeholder="简单描述一下这个笔记本..."
              spellcheck="false"
            ></textarea>
          </div>

          <div class="nb-form-group">
            <label>标签（逗号分隔）</label>
            <input
              type="text"
              class="nb-input"
              bind:value={tagsInput}
              placeholder="生活, 学习, 工作"
            />
          </div>

          <div class="nb-form-grid">
            <div class="nb-form-group">
              <label>条目数</label>
              <input
                type="number"
                class="nb-input"
                bind:value={modalItem.entries}
                min="0"
              />
            </div>
            <div class="nb-form-group">
              <label>更新日期</label>
              <input
                type="date"
                class="nb-input"
                bind:value={modalItem.updatedAt}
              />
            </div>
          </div>
        </div>

        <div class="nb-modal-footer">
          <button class="nb-btn nb-btn-cancel" onclick={closeModal}>取消</button>
          <button class="nb-btn nb-btn-save" onclick={saveModal}>保存</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .nb-editor {
    padding: 1rem 0;
  }

  .nb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.5rem;
  }

  .nb-card {
    position: relative;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl, 16px);
    overflow: hidden;
    background: var(--card-bg, white);
    border: 1px solid var(--line-divider, rgba(0,0,0,0.08));
    transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.2s;
  }
  :global(.dark) .nb-card {
    background: rgba(23, 23, 23, 0.8);
    border-color: rgba(255,255,255,0.08);
  }
  .nb-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
  }
  .nb-card-draft {
    border-style: dashed;
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
  }
  .nb-card-deleted {
    opacity: 0.5;
  }

  .nb-card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .nb-card:hover .nb-card-actions {
    opacity: 1;
  }
  .nb-action-btn {
    width: 28px;
    height: 28px;
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
  .nb-action-btn iconify-icon {
    display: flex;
  }
  .nb-action-edit { background: rgba(59, 130, 246, 0.9); }
  .nb-action-edit:hover { background: rgba(37, 99, 235, 1); }
  .nb-action-delete { background: rgba(239, 68, 68, 0.9); }
  .nb-action-delete:hover { background: rgba(220, 38, 38, 1); }

  .nb-card-cover {
    position: relative;
    aspect-ratio: 2 / 1;
    overflow: hidden;
    background: linear-gradient(135deg, var(--card-bg) 0%, color-mix(in srgb, var(--primary) 8%, var(--card-bg)) 100%);
  }
  .nb-card-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s ease;
  }
  .nb-card:hover .nb-card-cover img {
    transform: scale(1.06);
  }
  .nb-card-cover-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--card-bg) 0%, color-mix(in srgb, var(--primary) 12%, var(--card-bg)) 100%);
  }
  .nb-cover-emoji {
    font-size: 3.5rem;
    opacity: 0.35;
    transition: all 0.3s ease;
  }
  .nb-card:hover .nb-cover-emoji {
    opacity: 0.55;
    transform: scale(1.1);
  }

  .nb-card-body {
    padding: 1.25rem 1.25rem 0.75rem;
    flex: 1;
  }
  .nb-card-tags {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .nb-tag {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 500;
    background: color-mix(in srgb, var(--primary) 20%, transparent);
    color: var(--primary);
  }
  .nb-meta {
    font-size: 12px;
    color: var(--content-meta, #9ca3af);
  }
  .nb-card-name {
    margin: 0 0 6px;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-color, #1f2937);
    line-height: 1.3;
  }
  :global(.dark) .nb-card-name {
    color: #e5e7eb;
  }
  .nb-card:hover .nb-card-name {
    color: var(--primary);
  }
  .nb-card-summary {
    margin: 0;
    font-size: 14px;
    color: var(--content-meta, #6b7280);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  :global(.dark) .nb-card-summary {
    color: #9ca3af;
  }

  .nb-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid var(--line-divider, rgba(0,0,0,0.08));
    color: var(--content-meta, #9ca3af);
    font-size: 12px;
  }

  .nb-draft-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 8px;
    border-radius: 999px;
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
    font-size: 11px;
    font-weight: 600;
    z-index: 10;
  }

  .nb-empty {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--content-meta, #9ca3af);
    font-size: 0.875rem;
  }

  /* Modal */
  .nb-modal-overlay {
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
  .nb-modal {
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    background: var(--card-bg, white);
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
  }
  :global(.dark) .nb-modal {
    background: #1a1a2e;
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .nb-modal-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px;
    font-size: 15px;
    font-weight: 600;
    color: hsl(var(--theme-hue, 165), 70%, 45%);
    border-bottom: 1px solid var(--border, rgba(0,0,0,0.08));
  }
  .nb-modal-close {
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
  .nb-modal-close:hover {
    background: var(--bg-secondary, #f3f4f6);
  }

  .nb-modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .nb-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .nb-form-group {
    margin-bottom: 12px;
  }
  .nb-form-group label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #4b5563);
    margin-bottom: 4px;
  }
  :global(.dark) .nb-form-group label {
    color: #d1d5db;
  }
  .nb-input,
  .nb-textarea {
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
  :global(.dark) .nb-input,
  :global(.dark) .nb-textarea {
    background: #0f0f1a;
    border-color: #374151;
    color: #e5e7eb;
  }
  .nb-input:focus,
  .nb-textarea:focus {
    border-color: hsl(var(--theme-hue, 165), 70%, 50%);
    box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }
  .nb-textarea {
    resize: vertical;
    min-height: 60px;
  }

  .nb-modal-footer {
    display: flex;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--border, rgba(0,0,0,0.08));
  }
  .nb-btn {
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
  .nb-btn-cancel {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-color, #374151);
  }
  .nb-btn-cancel:hover {
    background: var(--border, #e5e7eb);
  }
  :global(.dark) .nb-btn-cancel {
    background: #2d2d44;
    color: #d1d5db;
  }
  :global(.dark) .nb-btn-cancel:hover {
    background: #3d3d55;
  }
  .nb-btn-save {
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
  }
  .nb-btn-save:hover {
    background: hsl(var(--theme-hue, 165), 75%, 45%);
  }

  @media (max-width: 640px) {
    .nb-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    .nb-form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
