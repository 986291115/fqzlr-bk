<script lang="ts">
import { onMount } from "svelte";
import EditToast from "@/components/edit/EditToast.svelte";
import {
	setStoredAppId,
	setStoredPrivateKey,
	clearStoredCredentials,
	hasValidCredentials,
	validateCredentials,
	readFileAsText,
	showToast,
	ensureIconify,
	invalidateToken,
	getDraftCount,
	getDraftsByPage,
	removeDraft,
	clearAllDrafts,
	submitAllDrafts,
	onDraftsChanged,
	checkProxyConfigured,
} from "@/utils/editMode";
import { repoConfig } from "@/config/editConfig";

interface PageConfig {
	pageName: string;
	pageKey: string;
	isInlineEdit: boolean;
	match: (path: string) => boolean;
}

const inlineEditPages: PageConfig[] = [
	{ pageName: "网站导航", pageKey: "projects", isInlineEdit: true, match: (p) => p.startsWith("/projects") },
	{ pageName: "关于", pageKey: "about", isInlineEdit: true, match: (p) => p.startsWith("/about") },
	{ pageName: "友链", pageKey: "friends", isInlineEdit: true, match: (p) => p.startsWith("/friends") },
	{ pageName: "朋友圈", pageKey: "pengyou", isInlineEdit: true, match: (p) => p.startsWith("/pengyou") },
	{ pageName: "赞助", pageKey: "sponsor", isInlineEdit: true, match: (p) => p.startsWith("/sponsor") },
	{ pageName: "更新日志", pageKey: "changelog", isInlineEdit: true, match: (p) => p.startsWith("/changelog") },
	{ pageName: "留言板", pageKey: "guestbook", isInlineEdit: true, match: (p) => p.startsWith("/guestbook") },
	{ pageName: "影音游戏", pageKey: "movies-games", isInlineEdit: true, match: (p) => p.startsWith("/movies-games") },
	{ pageName: "日常", pageKey: "routines", isInlineEdit: true, match: (p) => p.startsWith("/life/routines") },
	{ pageName: "足迹", pageKey: "places", isInlineEdit: true, match: (p) => p.startsWith("/life/places") },
	{ pageName: "笔记本", pageKey: "notebooks", isInlineEdit: true, match: (p) => p.startsWith("/life/notebooks") },
	{ pageName: "说说", pageKey: "moments", isInlineEdit: true, match: (p) => p.startsWith("/moments") },
	{ pageName: "读书", pageKey: "books", isInlineEdit: true, match: (p) => p.startsWith("/books") },
	{ pageName: "音乐", pageKey: "music", isInlineEdit: true, match: (p) => p.startsWith("/music") },
	{ pageName: "相册", pageKey: "album", isInlineEdit: true, match: (p) => p.startsWith("/album") },
	{ pageName: "番剧", pageKey: "bangumi", isInlineEdit: true, match: (p) => p.startsWith("/bangumi") },
];

const writeOnlyPaths = [
	/^\/posts\/?$/,
	/^\/categories\//,
	/^\/archive\//,
];

function isPostDetailPage(path: string): boolean {
	return /^\/posts\/.+/.test(path) && !/^\/posts\/?$/.test(path);
}

function isWriteOnlyPage(path: string): boolean {
	return writeOnlyPaths.some((re) => re.test(path));
}

function detectInlinePage(path: string): PageConfig | null {
	for (const config of inlineEditPages) {
		if (config.match(path)) return config;
	}
	return null;
}

function getPostSlug(path: string): string {
	const match = path.match(/^\/posts\/(.+)$/);
	return match ? match[1] : "";
}

let currentPage = $state<{ type: "inline"; config: PageConfig } | { type: "postDetail"; slug: string } | { type: "writeOnly" } | { type: "none" }>({ type: "none" });
let editMode = $state(false);
let authed = $state(false);
let validating = $state(false);
let showHelpModal = $state(false);
let showBatchSubmitModal = $state(false);
let showClearConfirmModal = $state(false);
let saving = $state(false);
let hasChanges = $state(false);
let pageDraftCount = $state(0);
let totalDraftCount = $state(0);
let selectedFileName = $state("");
let keyFileInputEl = $state<HTMLInputElement>();
let unsubscribeDrafts: (() => void) | null = null;

function updatePageConfig() {
	const path = window.location.pathname;
	const prevType = currentPage.type;
	const prevKey = currentPage.type === "inline" ? currentPage.config.pageKey : "";

	if (isPostDetailPage(path)) {
		currentPage = { type: "postDetail", slug: getPostSlug(path) };
	} else if (isWriteOnlyPage(path)) {
		currentPage = { type: "writeOnly" };
	} else {
		const inline = detectInlinePage(path);
		if (inline) {
			currentPage = { type: "inline", config: inline };
		} else {
			currentPage = { type: "none" };
		}
	}

	const newKey = currentPage.type === "inline" ? currentPage.config.pageKey : currentPage.type === "postDetail" ? "posts" : "";
	if (editMode && newKey !== prevKey) {
		editMode = false;
	}

	pageDraftCount = getDraftsByPage(newKey).length;
}

onMount(async () => {
	ensureIconify();
	updatePageConfig();

	const proxyOk = await checkProxyConfigured();
	authed = proxyOk || hasValidCredentials();

	totalDraftCount = getDraftCount();
	const curKey = currentPage.type === "inline" ? currentPage.config.pageKey : "";
	pageDraftCount = getDraftsByPage(curKey).length;

	unsubscribeDrafts = onDraftsChanged(() => {
		totalDraftCount = getDraftCount();
		const k = currentPage.type === "inline" ? currentPage.config.pageKey : "";
		pageDraftCount = getDraftsByPage(k).length;
	});

	window.addEventListener("popstate", updatePageConfig);
	document.addEventListener("swup:contentReplaced", updatePageConfig);
	document.addEventListener("astro:page-load", updatePageConfig);
	document.addEventListener("astro:after-swap", updatePageConfig);

	window.addEventListener("edit:modeChange", (e) => {
		const detail = (e as CustomEvent).detail;
		const k = currentPage.type === "inline" ? currentPage.config.pageKey : "";
		if (detail?.pageKey === k || detail?.pageKey === undefined) {
			editMode = detail.editing;
		}
	});

	window.addEventListener("edit:hasChanges", (e) => {
		const detail = (e as CustomEvent).detail;
		const k = currentPage.type === "inline" ? currentPage.config.pageKey : "";
		if (detail?.pageKey === k) {
			hasChanges = detail.hasChanges;
		}
	});

	return () => {
		window.removeEventListener("popstate", updatePageConfig);
		document.removeEventListener("swup:contentReplaced", updatePageConfig);
		document.removeEventListener("astro:page-load", updatePageConfig);
		document.removeEventListener("astro:after-swap", updatePageConfig);
		if (unsubscribeDrafts) unsubscribeDrafts();
	};
});

function showEditButton(): boolean {
	return currentPage.type === "inline" || currentPage.type === "postDetail";
}

function showWriteButton(): boolean {
	return currentPage.type === "writeOnly" || currentPage.type === "postDetail";
}

function currentPageKey(): string {
	if (currentPage.type === "inline") return currentPage.config.pageKey;
	if (currentPage.type === "postDetail") return "posts";
	return "";
}

function currentPageName(): string {
	if (currentPage.type === "inline") return currentPage.config.pageName;
	if (currentPage.type === "postDetail") return "文章";
	return "";
}

function handleEditClick() {
	if (currentPage.type === "postDetail") {
		window.location.href = `/write/?path=${encodeURIComponent(currentPage.slug)}`;
		return;
	}
	if (currentPage.type === "inline") {
		if (editMode) {
			handleCancel();
		} else {
			enterEditMode();
		}
	}
}

function enterEditMode() {
	editMode = true;
	window.dispatchEvent(
		new CustomEvent("edit:sidebarModeChange", {
			detail: { editing: true, pageKey: currentPageKey() },
		}),
	);
}

function handleCancel() {
	if (hasChanges && !confirm("你有未保存的更改，确定要取消吗？所有修改将丢失。")) {
		return;
	}
	editMode = false;
	window.dispatchEvent(
		new CustomEvent("edit:sidebarCancel", {
			detail: { pageKey: currentPageKey() },
		}),
	);
	showToast("已取消编辑", "info");
}

function handleSaveDraft() {
	window.dispatchEvent(
		new CustomEvent("edit:sidebarSaveDraft", {
			detail: { pageKey: currentPageKey() },
		}),
	);
}

function handleSubmit() {
	if (!authed) {
		showToast("请先导入 GitHub App 私钥", "warning");
		triggerKeyImport();
		return;
	}
	if (!hasChanges && pageDraftCount === 0) {
		showToast("没有需要提交的更改", "info");
		return;
	}
	window.dispatchEvent(
		new CustomEvent("edit:sidebarSubmit", {
			detail: { pageKey: currentPageKey() },
		}),
	);
}

function handleBatchSubmit() {
	if (!authed) {
		showToast("请先导入 GitHub App 私钥", "warning");
		triggerKeyImport();
		return;
	}
	if (totalDraftCount === 0) {
		showToast("暂存区是空的，先保存一些草稿吧", "info");
		return;
	}
	showBatchSubmitModal = true;
	document.body.style.overflow = "hidden";
}

function handleClearDrafts() {
	if (totalDraftCount === 0) {
		showToast("没有草稿可清除", "info");
		return;
	}
	showClearConfirmModal = true;
	document.body.style.overflow = "hidden";
}

function confirmClearDrafts() {
	clearAllDrafts();
	showClearConfirmModal = false;
	document.body.style.overflow = "";
	showToast("已清除所有草稿", "success");
}

function closeClearModal() {
	showClearConfirmModal = false;
	document.body.style.overflow = "";
}

async function confirmBatchSubmit() {
	saving = true;
	try {
		const result = await submitAllDrafts();
		if (result.failed === 0) {
			showToast(`批量提交成功！共 ${result.success} 项`, "success");
		} else {
			showToast(`提交完成：成功 ${result.success}，失败 ${result.failed}`, "warning");
		}
		if (result.submittedPageKeys.has(currentPageKey())) {
			setTimeout(() => window.location.reload(), 1200);
		}
	} finally {
		saving = false;
	}
}

function closeBatchModal() {
	showBatchSubmitModal = false;
	document.body.style.overflow = "";
}

function handleAdd() {
	window.dispatchEvent(
		new CustomEvent("edit:sidebarAdd", {
			detail: { pageKey: currentPageKey() },
		}),
	);
}

function triggerKeyImport() {
	keyFileInputEl?.click();
}

async function handleKeyFileSelect(e: Event) {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) {
		input.value = "";
		return;
	}
	try {
		const pem = await readFileAsText(file);
		const appId = repoConfig.appId;
		if (!appId) {
			showToast("请先配置 PUBLIC_GITHUB_APP_ID 环境变量", "error");
			input.value = "";
			return;
		}
		validating = true;
		showToast("正在验证私钥...", "info");
		const result = await validateCredentials(appId, pem);
		if (result.ok) {
			setStoredAppId(appId);
			setStoredPrivateKey(pem);
			authed = true;
			selectedFileName = file.name;
			showToast("私钥导入成功！", "success");
		} else {
			showToast(result.error || "私钥验证失败", "error");
		}
	} catch {
		showToast("读取私钥文件失败", "error");
	} finally {
		validating = false;
		input.value = "";
	}
}

function handleLogout() {
	if (!confirm("确定要清除已保存的私钥吗？清除后需要重新导入才能提交。")) return;
	clearStoredCredentials();
	invalidateToken();
	authed = false;
	showToast("已清除私钥", "info");
}

function openHelpModal() {
	showHelpModal = true;
	document.body.style.overflow = "hidden";
}

function closeHelpModal() {
	showHelpModal = false;
	document.body.style.overflow = "";
}
</script>

<EditToast />

<div class="write-section">
	<div class="section-title">
		<span class="title-bar"></span>
		<span class="title-text">写作</span>
	</div>

	{#if showEditButton()}
		{#if !editMode || currentPage.type === "postDetail"}
			<button class="write-btn write-btn-outline" onclick={handleEditClick}>
				<iconify-icon icon="material-symbols:edit-rounded"></iconify-icon>
				<span class="btn-text">
					{currentPage.type === "postDetail" ? "编辑当前文章" : "编辑当前" + currentPageName()}
				</span>
			</button>
		{:else}
			<div class="edit-toolbar-row">
				<button class="tb-btn tb-btn-cancel" onclick={handleCancel} title="取消编辑">
					<iconify-icon icon="material-symbols:close-rounded"></iconify-icon>
					<span class="tb-text">取消</span>
				</button>
				<button class="tb-btn tb-btn-draft" onclick={handleSaveDraft} disabled={!hasChanges} title="保存草稿">
					<iconify-icon icon="material-symbols:save-outline-rounded"></iconify-icon>
					<span class="tb-text">草稿</span>
					{#if pageDraftCount > 0}
						<span class="tb-badge draft-badge">{pageDraftCount}</span>
					{/if}
				</button>
				{#if authed}
					<button class="tb-btn tb-btn-key tb-btn-key-ok" onclick={triggerKeyImport} title="已导入私钥，点击重新导入">
						<iconify-icon icon="material-symbols:vpn-key-rounded"></iconify-icon>
						<span class="tb-text">已认证</span>
					</button>
				{:else}
					<button class="tb-btn tb-btn-key tb-btn-key-err" onclick={triggerKeyImport} title="点击导入 GitHub App 私钥">
						<iconify-icon icon="material-symbols:key-rounded"></iconify-icon>
						<span class="tb-text">密钥</span>
					</button>
				{/if}
				<button class="tb-btn tb-btn-add" onclick={handleAdd} title="添加新项">
					<iconify-icon icon="material-symbols:add-rounded"></iconify-icon>
					<span class="tb-text">添加</span>
				</button>
				<button class="tb-btn tb-btn-submit" onclick={handleSubmit} disabled={saving || (!hasChanges && pageDraftCount === 0)} title="提交">
					{#if saving}
						<iconify-icon icon="material-symbols:progress-activity-rounded" class="animate-spin"></iconify-icon>
					{:else}
						<iconify-icon icon="material-symbols:send-rounded"></iconify-icon>
					{/if}
					<span class="tb-text">提交</span>
				</button>
			</div>
			<div class="edit-toolbar-row">
				<button class="tb-btn tb-btn-batch" onclick={handleBatchSubmit} title="批量提交">
					<iconify-icon icon="material-symbols:cloud-upload-rounded"></iconify-icon>
					<span class="tb-text">批量提交</span>
					{#if totalDraftCount > 0}
						<span class="tb-badge batch-badge">{totalDraftCount}</span>
					{/if}
				</button>
				<button class="tb-btn tb-btn-clear" onclick={handleClearDrafts} disabled={totalDraftCount === 0} title="清除全部草稿">
					<iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
					<span class="tb-text">清除</span>
					{#if totalDraftCount > 0}
						<span class="tb-badge clear-badge">{totalDraftCount}</span>
					{/if}
				</button>
				<button class="tb-btn tb-btn-help" onclick={openHelpModal} title="使用帮助">
					<iconify-icon icon="material-symbols:help-outline-rounded"></iconify-icon>
					<span class="tb-text">帮助</span>
				</button>
			</div>
		{/if}
	{/if}

	{#if showWriteButton()}
		<a href="/write/" class="write-btn write-btn-filled" data-no-swup>
			<iconify-icon icon="material-symbols:add-rounded"></iconify-icon>
			<span class="btn-text">写新文章</span>
		</a>
	{/if}

	<input
		type="file"
		accept=".pem,application/x-pem-file,text/plain"
		bind:this={keyFileInputEl}
		onchange={handleKeyFileSelect}
		style="display:none"
	/>
</div>

{#if showBatchSubmitModal}
	<div class="modal-overlay" onclick={closeBatchModal}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>
					<iconify-icon icon="material-symbols:cloud-upload-rounded" class="mr-2 text-lg"></iconify-icon>
					批量提交到 GitHub
				</h3>
				<button class="modal-close" onclick={closeBatchModal}>
					<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
				</button>
			</div>
			<div class="modal-body">
				<p class="modal-desc">
					以下所有更改将一次性提交到 GitHub 仓库。提交成功后将自动从暂存区移除。
				</p>
				<div class="draft-list">
					{#each getDraftsByPage(currentPageKey()) as draft (draft.id)}
						<div class="draft-item">
							<div class="draft-info">
								<span class="draft-page">{currentPageName()}</span>
								<span class="draft-desc">{draft.description}</span>
							</div>
							<button class="draft-remove" onclick={() => removeDraft(draft.id)} title="移除">
								<iconify-icon icon="material-symbols:close-rounded" class="text-sm"></iconify-icon>
							</button>
						</div>
					{/each}
				</div>
			</div>
			<div class="modal-footer">
				<button class="modal-btn modal-btn-cancel" onclick={closeBatchModal}>关闭</button>
				{#if totalDraftCount > 0}
					<button class="modal-btn modal-btn-ok" onclick={confirmBatchSubmit} disabled={saving}>
						{#if saving}
							<iconify-icon icon="material-symbols:progress-activity-rounded" class="mr-1 text-sm animate-spin"></iconify-icon>
							提交中...
						{:else}
							<iconify-icon icon="material-symbols:send-rounded" class="mr-1 text-sm"></iconify-icon>
							确认提交（{totalDraftCount}项）
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if showClearConfirmModal}
	<div class="modal-overlay" onclick={closeClearModal}>
		<div class="modal-card modal-sm" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>
					<iconify-icon icon="material-symbols:delete-outline-rounded" class="mr-2 text-lg"></iconify-icon>
					清除所有草稿
				</h3>
				<button class="modal-close" onclick={closeClearModal}>
					<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
				</button>
			</div>
			<div class="modal-body">
				<p>确定要清除所有草稿吗？此操作不可恢复。</p>
				<p>当前共有 <strong>{totalDraftCount}</strong> 条草稿将被删除。</p>
			</div>
			<div class="modal-footer">
				<button class="modal-btn modal-btn-cancel" onclick={closeClearModal}>取消</button>
				<button class="modal-btn modal-btn-danger" onclick={confirmClearDrafts}>
					<iconify-icon icon="material-symbols:delete-rounded" class="text-sm"></iconify-icon>
					确认清除
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showHelpModal}
	<div class="modal-overlay" onclick={closeHelpModal}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>
					<iconify-icon icon="material-symbols:help-outline-rounded" class="mr-2 text-lg"></iconify-icon>
					在线编辑使用帮助
				</h3>
				<button class="modal-close" onclick={closeHelpModal}>
					<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
				</button>
			</div>
			<div class="modal-body help-body">
				<h4>📝 工作流程</h4>
				<ol>
					<li><strong>编辑内容</strong>：修改你想要的内容</li>
					<li><strong>保存草稿</strong>：点击「草稿」按钮，更改会暂存到浏览器本地</li>
					<li><strong>继续编辑其他页面</strong>：可以编辑多个页面，每个页面保存草稿</li>
					<li><strong>导入密钥</strong>：点击「密钥」选择 .pem 私钥文件</li>
					<li><strong>批量提交</strong>：点击「批量提交」一次性将所有更改推送到 GitHub</li>
				</ol>
				<h4>🔑 认证方式</h4>
				<p>本系统使用 <strong>GitHub App 私钥认证</strong>，在浏览器端完成签名，私钥仅保存在本地浏览器。</p>
				<h4>💾 草稿暂存</h4>
				<p>所有编辑内容先保存为草稿，存在浏览器的 localStorage 中。不会提交到 GitHub，直到你点击「提交」或「批量提交」。</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.write-section {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 18px;
		font-weight: 700;
		color: var(--text-color, #1f2937);
		margin-top: 4px;
	}

	.title-bar {
		width: 4px;
		height: 20px;
		background: var(--text-color, #1f2937);
		border-radius: 2px;
	}

	.title-text {
		line-height: 1;
	}

	.write-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px 16px;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
		line-height: 1;
		text-decoration: none;
		width: 100%;
		box-sizing: border-box;
		border: none;
	}

	.write-btn iconify-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		vertical-align: middle;
		line-height: 0;
		font-size: 18px;
	}

	.write-btn-outline {
		border: 1.5px solid var(--text-color, #1f2937);
		background: transparent;
		color: var(--text-color, #1f2937);
	}

	.write-btn-outline:hover {
		background: var(--text-color, #1f2937);
		color: var(--bg-color, white);
	}

	:global(.dark) .write-btn-outline {
		border-color: rgba(255, 255, 255, 0.9);
		color: rgba(255, 255, 255, 0.9);
	}

	:global(.dark) .write-btn-outline:hover {
		background: rgba(255, 255, 255, 0.9);
		color: rgba(0, 0, 0, 0.9);
	}

	.write-btn-filled {
		background: var(--text-color, #1f2937);
		color: var(--bg-color, white);
	}

	.write-btn-filled:hover {
		opacity: 0.85;
	}

	:global(.dark) .write-btn-filled {
		background: rgba(255, 255, 255, 0.95);
		color: rgba(0, 0, 0, 0.9);
	}

	.edit-toolbar-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.tb-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 6px 10px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid transparent;
		background: transparent;
		white-space: nowrap;
		position: relative;
		height: 32px;
		box-sizing: border-box;
		line-height: 1;
		flex: 1;
		min-width: 0;
	}

	.tb-btn iconify-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		vertical-align: middle;
		line-height: 0;
		font-size: 14px;
	}

	.tb-btn-cancel {
		border-color: rgba(0, 0, 0, 0.15);
		color: rgba(0, 0, 0, 0.6);
	}
	.tb-btn-cancel:hover {
		border-color: rgba(0, 0, 0, 0.9);
		color: white;
		background: rgba(0, 0, 0, 0.9);
	}
	:global(.dark) .tb-btn-cancel {
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.6);
	}
	:global(.dark) .tb-btn-cancel:hover {
		border-color: rgba(255, 255, 255, 0.9);
		background: rgba(255, 255, 255, 0.9);
		color: rgba(0, 0, 0, 0.9);
	}

	.tb-btn-draft {
		border-color: rgba(59, 130, 246, 0.3);
		color: #2563eb;
		background: rgba(59, 130, 246, 0.08);
	}
	.tb-btn-draft:hover:not(:disabled) {
		border-color: #2563eb;
		background: rgba(59, 130, 246, 0.15);
	}
	.tb-btn-draft:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	:global(.dark) .tb-btn-draft {
		border-color: rgba(96, 165, 250, 0.3);
		color: #60a5fa;
		background: rgba(96, 165, 250, 0.1);
	}
	:global(.dark) .tb-btn-draft:hover:not(:disabled) {
		border-color: #60a5fa;
		background: rgba(96, 165, 250, 0.2);
	}

	.tb-btn-key-ok {
		border-color: #22c55e !important;
		color: #16a34a !important;
		background: rgba(34, 197, 94, 0.1) !important;
	}
	.tb-btn-key-err {
		border-color: #f59e0b !important;
		color: #d97706 !important;
		background: rgba(245, 158, 11, 0.12) !important;
	}
	:global(.dark) .tb-btn-key-ok {
		border-color: #4ade80 !important;
		color: #4ade80 !important;
		background: rgba(74, 222, 128, 0.15) !important;
	}
	:global(.dark) .tb-btn-key-err {
		border-color: #fbbf24 !important;
		color: #fbbf24 !important;
		background: rgba(251, 191, 36, 0.15) !important;
	}

	.tb-btn-add {
		border-color: rgba(34, 197, 94, 0.3);
		color: #16a34a;
		background: rgba(34, 197, 94, 0.08);
	}
	.tb-btn-add:hover {
		border-color: #22c55e;
		background: rgba(34, 197, 94, 0.15);
	}
	:global(.dark) .tb-btn-add {
		border-color: rgba(74, 222, 128, 0.3);
		color: #4ade80;
		background: rgba(74, 222, 128, 0.1);
	}
	:global(.dark) .tb-btn-add:hover {
		border-color: #4ade80;
		background: rgba(74, 222, 128, 0.2);
	}

	.tb-btn-submit {
		border: 1px solid hsl(var(--theme-hue, 165), 70%, 50%);
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		font-weight: 600;
	}
	.tb-btn-submit:hover:not(:disabled) {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
		border-color: hsl(var(--theme-hue, 165), 75%, 45%);
	}
	.tb-btn-submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tb-btn-batch {
		border-color: rgba(139, 92, 246, 0.3);
		color: #7c3aed;
		background: rgba(139, 92, 246, 0.08);
	}
	.tb-btn-batch:hover {
		border-color: #7c3aed;
		background: rgba(139, 92, 246, 0.15);
	}
	:global(.dark) .tb-btn-batch {
		border-color: rgba(167, 139, 250, 0.3);
		color: #a78bfa;
		background: rgba(167, 139, 250, 0.1);
	}
	:global(.dark) .tb-btn-batch:hover {
		border-color: #a78bfa;
		background: rgba(167, 139, 250, 0.2);
	}

	.tb-btn-clear {
		border-color: rgba(239, 68, 68, 0.3);
		color: #dc2626;
		background: rgba(239, 68, 68, 0.08);
	}
	.tb-btn-clear:hover:not(:disabled) {
		border-color: #dc2626;
		background: rgba(239, 68, 68, 0.15);
	}
	.tb-btn-clear:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	:global(.dark) .tb-btn-clear {
		border-color: rgba(248, 113, 113, 0.3);
		color: #f87171;
		background: rgba(248, 113, 113, 0.1);
	}
	:global(.dark) .tb-btn-clear:hover:not(:disabled) {
		border-color: #f87171;
		background: rgba(248, 113, 113, 0.2);
	}

	.tb-btn-help {
		border-color: rgba(0, 0, 0, 0.1);
		color: rgba(0, 0, 0, 0.5);
	}
	.tb-btn-help:hover {
		border-color: rgba(0, 0, 0, 0.3);
		color: rgba(0, 0, 0, 0.8);
		background: rgba(0, 0, 0, 0.05);
	}
	:global(.dark) .tb-btn-help {
		border-color: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.5);
	}
	:global(.dark) .tb-btn-help:hover {
		border-color: rgba(255, 255, 255, 0.3);
		color: rgba(255, 255, 255, 0.9);
		background: rgba(255, 255, 255, 0.08);
	}

	.tb-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 8px;
		color: white;
		font-size: 10px;
		font-weight: 700;
		margin-left: 2px;
	}
	.draft-badge { background: #2563eb; }
	.batch-badge { background: #7c3aed; }
	.clear-badge { background: #dc2626; }

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	.animate-spin {
		animation: spin 1s linear infinite;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		z-index: 9998;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		animation: fadeIn 0.2s ease;
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.modal-card {
		background: #ffffff;
		border-radius: 16px;
		width: 100%;
		max-width: 480px;
		max-height: calc(100vh - 40px);
		overflow-y: auto;
		box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
		animation: slideUp 0.25s ease;
		border: 1px solid rgba(0, 0, 0, 0.08);
		color: #1a1a2e;
	}
	@keyframes slideUp {
		from { transform: translateY(20px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
	:global(.dark) .modal-card {
		background: #1e1e32;
		border-color: rgba(255, 255, 255, 0.1);
		color: #f0f0f0;
	}

	.modal-sm { max-width: 380px; }

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 22px 14px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}
	:global(.dark) .modal-header {
		border-bottom-color: rgba(255, 255, 255, 0.08);
	}
	.modal-header h3 {
		margin: 0;
		font-size: 17px;
		font-weight: 700;
		display: flex;
		align-items: center;
	}

	.modal-close {
		width: 34px;
		height: 34px;
		border-radius: 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #888;
		transition: all 0.15s;
		font-size: 14px;
	}
	.modal-close:hover {
		background: rgba(0, 0, 0, 0.08);
		color: #333;
	}
	:global(.dark) .modal-close:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.modal-body {
		padding: 18px 22px;
		font-size: 14px;
		line-height: 1.65;
		color: #444;
	}
	:global(.dark) .modal-body {
		color: #c0c0d0;
	}

	.modal-desc {
		margin: 0 0 18px;
		padding: 12px 14px;
		background: hsl(var(--theme-hue, 165), 70%, 50%, 0.08);
		border-radius: 10px;
		color: hsl(var(--theme-hue, 165), 70%, 35%);
		font-size: 13px;
		border-left: 3px solid hsl(var(--theme-hue, 165), 70%, 50%);
	}
	:global(.dark) .modal-desc {
		color: hsl(var(--theme-hue, 165), 70%, 65%);
		background: hsl(var(--theme-hue, 165), 70%, 50%, 0.12);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 14px 22px 18px;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
	}
	:global(.dark) .modal-footer {
		border-top-color: rgba(255, 255, 255, 0.06);
	}

	.modal-btn {
		display: inline-flex;
		align-items: center;
		padding: 9px 18px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		border: 1px solid transparent;
	}

	.modal-btn-cancel {
		background: transparent;
		border-color: rgba(0, 0, 0, 0.15);
		color: #555;
	}
	.modal-btn-cancel:hover {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.3);
	}
	:global(.dark) .modal-btn-cancel {
		border-color: rgba(255, 255, 255, 0.15);
		color: #bbb;
	}
	:global(.dark) .modal-btn-cancel:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.modal-btn-ok {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
	}
	.modal-btn-ok:hover:not(:disabled) {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
		border-color: hsl(var(--theme-hue, 165), 75%, 45%);
	}
	.modal-btn-ok:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.modal-btn-danger {
		background: #dc2626;
		color: white;
		border-color: #dc2626;
	}
	.modal-btn-danger:hover:not(:disabled) {
		background: #b91c1c;
		border-color: #b91c1c;
	}
	:global(.dark) .modal-btn-danger {
		background: #ef4444;
		border-color: #ef4444;
	}
	:global(.dark) .modal-btn-danger:hover:not(:disabled) {
		background: #dc2626;
		border-color: #dc2626;
	}

	.draft-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 300px;
		overflow-y: auto;
	}

	.draft-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.03);
		border: 1px solid rgba(0, 0, 0, 0.06);
	}
	:global(.dark) .draft-item {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.08);
	}

	.draft-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.draft-page {
		font-size: 12px;
		color: #888;
	}
	.draft-desc {
		font-size: 13px;
		font-weight: 500;
	}
	.draft-remove {
		background: none;
		border: none;
		color: #999;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}
	.draft-remove:hover {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
	}

	.help-body h4 {
		margin: 16px 0 8px;
		font-size: 14px;
		font-weight: 700;
		color: hsl(var(--theme-hue, 165), 70%, 40%);
	}
	.help-body h4:first-child { margin-top: 0; }
	:global(.dark) .help-body h4 {
		color: hsl(var(--theme-hue, 165), 70%, 65%);
	}
	.help-body p { margin: 0 0 8px; }
	.help-body ol, .help-body ul {
		margin: 0 0 12px;
		padding-left: 22px;
	}
	.help-body li { margin-bottom: 4px; font-size: 13px; }
	.help-body strong {
		color: hsl(var(--theme-hue, 165), 70%, 40%);
	}
	:global(.dark) .help-body strong {
		color: hsl(var(--theme-hue, 165), 70%, 65%);
	}

	.mr-1 { margin-right: 0.25rem; }
	.mr-2 { margin-right: 0.5rem; }
	.text-sm { font-size: 0.875rem; }
	.text-lg { font-size: 1.125rem; }
	.text-xl { font-size: 1.25rem; }
</style>
