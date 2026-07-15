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

interface FriendItem {
	id?: string;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags?: string[];
	weight?: number;
	enabled?: boolean;
	_draft?: boolean;
}

let editMode = $state(false);
let saving = $state(false);
let friends = $state<FriendItem[]>([]);
let originalFriends = $state<FriendItem[]>([]);
let editingIndex = $state(-1);
let repoLoaded = $state(false);
let fileSha = $state<string | null>(null);
let originalTS = $state<string>("");

// 从 TypeScript 配置文件中解析友链数组
function parseFriendsFromTS(tsContent: string): FriendItem[] {
	tsContent = tsContent.replace(/\r\n/g, "\n");
	const startMarker = "export const friendsConfig: FriendLink[] = [";
	const startIdx = tsContent.indexOf(startMarker);
	if (startIdx === -1) return [];
	let bracketStart = startIdx + startMarker.length;
	let depth = 1;
	let idx = bracketStart;
	while (idx < tsContent.length && depth > 0) {
		if (tsContent[idx] === "[") depth++;
		else if (tsContent[idx] === "]") depth--;
		if (depth > 0) idx++;
	}
	let arrayStr = tsContent.substring(bracketStart, idx).trim();
	arrayStr = stripLineComments(arrayStr);
	arrayStr = arrayStr.replace(/,(\s*[\]\}])/g, "$1");
	arrayStr = arrayStr.replace(/,(\s*)$/, "$1");
	arrayStr = arrayStr.replace(/^(\s*)(\w+)\s*:/gm, '$1"$2":');
	try {
		return JSON.parse(`[${arrayStr}]`);
	} catch (e) {
		console.error("Failed to parse friends from TS:", e);
		return [];
	}
}

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

function buildFriendsConfigTS(
	friends: FriendItem[],
	originalContent?: string,
): string {
	const entries = friends.map((f) => {
		const obj = {
			title: f.title,
			imgurl: f.imgurl,
			desc: f.desc,
			siteurl: f.siteurl,
			tags: f.tags || ["Blog"],
			weight: f.weight ?? 10,
			enabled: f.enabled !== false,
		};
		const json = JSON.stringify(obj, null, 2)
			.split("\n")
			.map((line, i, arr) =>
				i === arr.length - 1 ? `\t\t${line},` : `\t\t${line}`,
			)
			.join("\n");
		return json;
	});
	const newArrayContent = `[\n${entries.join("\n")}\n]`;

	if (originalContent) {
		const startMarker = "export const friendsConfig: FriendLink[] = [";
		const startIdx = originalContent.indexOf(startMarker);
		if (startIdx !== -1) {
			let bracketStart = startIdx + startMarker.length;
			let depth = 1;
			let idx = bracketStart;
			while (idx < originalContent.length && depth > 0) {
				if (originalContent[idx] === "[") depth++;
				else if (originalContent[idx] === "]") depth--;
				if (depth > 0) idx++;
			}
			const innerContent = entries.join("\n");
			return (
				originalContent.substring(0, bracketStart) +
				"\n" +
				innerContent +
				"\n\t]" +
				originalContent.substring(idx + 1)
			);
		}
	}

	return `import type { FriendLink, FriendsPageConfig } from "../types/config";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	title: "",
	description: "",
	showCustomContent: true,
	showComment: true,
	randomizeSort: false,
	applyLink: "https://github.com/fqzlr/fqzl-bk/issues/new?template=friend-link.yml",
	siteInfo: {
		name: "fqzlr",
		desc: "坐而言不如起而行.",
		url: "https://fqzlr.com/",
		avatar: "https://fqzlr.com/avatar.png",
		email: "",
	},
	notes: [
		{ title: "互换原则", content: "请先将本站添加到您的友链页面，确认后会添加您的友链" },
		{ title: "链接维护", content: "友链网站长期无法访问或内容违规，将会被移除" },
		{ title: "内容要求", content: "内容积极向上，不含有任何含色情/反动/暴力等违法违规内容" },
		{ title: "站点要求", content: "支持 HTTPS，以原创内容为主，能够正常访问且有持续更新" },
	],
};

// 友链配置
export const friendsConfig: FriendLink[] = ${newArrayContent};

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);
	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}
	return friends.sort((a, b) => b.weight - a.weight);
};
`;
}

const typeColors: Record<string, { bg: string; text: string }> = {
	Blog: { bg: "#3b82f6", text: "#ffffff" },
	Docs: { bg: "#f59e0b", text: "#ffffff" },
};

const drafts = setupRepoDrafts({
	pageKey: "friends",
	pageName: "友链",
	getContent: () => buildFriendsConfigTS(friends, originalTS),
	setContent: (v) => {
		const parsed = parseFriendsFromTS(v);
		if (parsed.length > 0 || v.includes("friendsConfig")) {
			friends = parsed;
		}
	},
	getPath: () => "src/config/friendsConfig.ts",
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => originalTS,
	setOriginalContent: (v) => (originalTS = v),
	getCommitMsg: (isEdit) =>
		isEdit ? `chore: update friends` : `chore: create friends`,
	onSubmitted: () => {
		setTimeout(() => window.location.reload(), 1200);
	},
});

let hasChanges = $derived(drafts.hasLocalChanges());

$effect(() => {
	window.dispatchEvent(
		new CustomEvent("edit:hasChanges", {
			detail: { pageKey: "friends", hasChanges },
		}),
	);
});

onMount(() => {
	ensureIconify();
	collectFromDOM();
	loadRepoData();

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
	if (detail?.pageKey !== "friends") return;
	if (detail.editing) {
		editMode = true;
		hideSSRGrid();
		editingIndex = -1;
	} else {
		editMode = false;
		showSSRGrid();
	}
}

function handleSidebarSaveDraft(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "friends") return;
	handleSaveDraft();
}

function handleSidebarSubmit(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "friends") return;
	handleSubmit();
}

function handleSidebarCancel(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "friends") return;
	handleCancel();
}

function handleSidebarAdd(e: Event) {
	const detail = (e as CustomEvent).detail;
	if (detail?.pageKey !== "friends") return;
	handleAdd();
}

async function loadRepoData() {
	const existing = await getRepoFile("src/config/friendsConfig.ts");
	if (existing && existing.content) {
		try {
			const repoItems: FriendItem[] = parseFriendsFromTS(existing.content);
			originalTS = existing.content;
			const repoMap = new Map(
				repoItems.map((f) => [f.siteurl.replace(/\/$/, ""), f]),
			);
			friends = friends.map((f) => {
				const key = f.siteurl.replace(/\/$/, "");
				const repoItem = repoMap.get(key);
				if (repoItem) {
					return {
						...f,
						weight: repoItem.weight ?? f.weight,
						enabled: repoItem.enabled ?? f.enabled,
					};
				}
				return f;
			});
			const existingUrls = new Set(
				friends.map((f) => f.siteurl.replace(/\/$/, "")),
			);
			for (const g of repoItems) {
				const url = g.siteurl.replace(/\/$/, "");
				if (!existingUrls.has(url)) {
					friends = [...friends, { ...g, id: g.id || genId("fr") }];
					existingUrls.add(url);
				}
			}
			originalFriends = deepClone(friends);
		} catch (e) {
			console.error("Failed to parse repo friends:", e);
		}
	} else {
		originalTS = buildFriendsConfigTS(friends);
	}
	repoLoaded = true;
	drafts.restoreFromDrafts();
}

// 适配当前项目的友链 DOM 结构
function collectFromDOM() {
	const grid = document.getElementById("friends-grid");
	if (!grid) return;
	const items: FriendItem[] = [];
	grid.querySelectorAll(".friend-card").forEach((el) => {
		const card = el as HTMLElement;
		// 当前项目的友链卡片是直接 <a> 标签
		const link = card.tagName === "A" ? (card as HTMLAnchorElement) : card.querySelector("a") as HTMLAnchorElement | null;
		if (!link) return;
		// 获取标题 - 在 .font-bold 或 .friend-card-title 中
		const title =
			card.querySelector(".font-bold")?.textContent?.trim() ||
			card.querySelector(".friend-card-title")?.textContent?.trim() ||
			"";
		// 获取描述 - 在 .text-sm 或 .friend-card-desc 中
		const desc =
			card.querySelector(".text-sm.text-neutral-500")?.textContent?.trim() ||
			card.querySelector(".line-clamp-1")?.textContent?.trim() ||
			card.querySelector(".friend-card-desc")?.textContent?.trim() ||
			"";
		// 获取头像
		const img = card.querySelector("img") as HTMLImageElement | null;
		// 获取标签
		const tagEls = card.querySelectorAll(".text-\\[0\\.65rem\\]");
		const tags = Array.from(tagEls).map(t => t.textContent?.trim() || "").filter(Boolean);
		items.push({
			id: card.dataset.friendId || link.href,
			title,
			imgurl: img?.src || "",
			desc,
			siteurl: link.href,
			tags: tags.length > 0 ? tags : ["Blog"],
			weight: 10,
			enabled: true,
		});
	});
	friends = items;
	const ts = buildFriendsConfigTS(items);
	originalTS = ts;
	originalFriends = deepClone(items);
}

function handleModeChange(e: CustomEvent) {
	editMode = e.detail.editing;
	if (editMode) {
		hideSSRGrid();
		editingIndex = -1;
	} else {
		showSSRGrid();
	}
}

function hideSSRGrid() {
	const grid = document.getElementById("friends-grid");
	if (grid) grid.style.display = "none";
}

function showSSRGrid() {
	const grid = document.getElementById("friends-grid");
	if (grid) grid.style.display = "";
}

function handleCancel() {
	editMode = false;
	friends = deepClone(originalFriends);
	drafts.clearDrafts();
	editingIndex = -1;
	showSSRGrid();
}

function moveUp(index: number) {
	if (index <= 0) return;
	const arr = [...friends];
	[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
	friends = arr;
	if (editingIndex === index) editingIndex = index - 1;
	else if (editingIndex === index - 1) editingIndex = index;
}

function moveDown(index: number) {
	if (index >= friends.length - 1) return;
	const arr = [...friends];
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
	friends = arr;
	if (editingIndex === index) editingIndex = index + 1;
	else if (editingIndex === index + 1) editingIndex = index;
}

function startEdit(index: number) {
	editingIndex = index;
}

function finishEdit(index: number) {
	const f = friends[index];
	if (!f.title.trim()) {
		showToast("名称不能为空", "warning");
		return;
	}
	if (!f.siteurl.trim()) {
		showToast("链接不能为空", "warning");
		return;
	}
	editingIndex = -1;
	showToast("已修改，记得点击保存", "info");
}

function cancelItemEdit(index: number) {
	const f = friends[index];
	if (f._draft && !f.title.trim()) {
		friends = friends.filter((_, i) => i !== index);
	} else {
		const orig = originalFriends.find(
			(o) => (o.id || o.siteurl) === (f.id || f.siteurl) && !f._draft,
		);
		if (orig) {
			friends[index] = deepClone(orig);
			friends = [...friends];
		}
	}
	editingIndex = -1;
}

function deleteItem(index: number) {
	const f = friends[index];
	if (!confirm(`确定要删除「${f.title || "该条目"}」吗？`)) return;
	friends = friends.filter((_, i) => i !== index);
	if (editingIndex === index) editingIndex = -1;
	else if (editingIndex > index) editingIndex--;
	showToast("已删除，记得点击保存", "info");
}

function handleAdd() {
	const newFriend: FriendItem = {
		id: genId("fr"),
		title: "",
		imgurl: "",
		desc: "",
		siteurl: "",
		tags: ["Blog"],
		weight: 10,
		enabled: true,
		_draft: true,
	};
	friends = [...friends, newFriend];
	editingIndex = friends.length - 1;
}

function handleSaveDraft() {
	const cleanData = friends.map(({ _draft, ...rest }) => ({
		...rest,
		id: rest.id || genId("fr"),
		weight: rest.weight ?? 10,
		enabled: rest.enabled !== false,
	}));
	friends = cleanData;
	drafts.saveToDrafts();
}

async function handleSubmit() {
	if (editingIndex >= 0) {
		finishEdit(editingIndex);
		if (editingIndex >= 0) return;
	}
	saving = true;
	try {
		const cleanData = friends.map(({ _draft, ...rest }) => ({
			...rest,
			id: rest.id || genId("fr"),
			weight: rest.weight ?? 10,
			enabled: rest.enabled !== false,
		}));
		friends = cleanData;
		drafts.saveToDrafts();
		await drafts.submitDrafts();
	} finally {
		saving = false;
	}
}

function updateField(index: number, field: keyof FriendItem, value: string) {
	friends[index] = { ...friends[index], [field]: value };
	friends = [...friends];
}

function getTagColor(tag: string) {
	return typeColors[tag] || typeColors.Blog;
}
</script>


<!-- 编辑模式：可编辑网格 -->
{#if editMode}
	<div class="edit-friends-grid" id="edit-friends-grid">
		{#each friends as friend, i (i + "-" + (friend.id || friend.siteurl))}
			<div
				class="edit-friend-card"
				class:edit-friend-card-draft={friend._draft}
				class:edit-friend-card-editing={editingIndex === i}
			>
				{#if editingIndex !== i}
					<div class="card-action-row">
						{#if i > 0}
							<button class="action-btn action-move" onclick={() => moveUp(i)} title="上移">
								<iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
							</button>
						{/if}
						{#if i < friends.length - 1}
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
						<span
							class="card-type-badge"
							style={`background-color:${getTagColor(friend.tags?.[0] || "Blog").bg};color:${getTagColor(friend.tags?.[0] || "Blog").text}`}
						>
							{friend.tags?.[0] || "Blog"}
						</span>
						<div class="card-avatar-wrap">
							{#if friend.imgurl}
								<img src={friend.imgurl} alt={friend.title} class="card-avatar" loading="lazy" onerror={(e) => ((e.target as HTMLImageElement).style.opacity = '0')} />
							{:else}
								<div class="card-avatar-placeholder">
									<iconify-icon icon="material-symbols:person-outline"></iconify-icon>
								</div>
							{/if}
						</div>
						<div class="card-info">
							<h3 class="card-title">{friend.title || "（未命名）"}</h3>
							<p class="card-desc">{friend.desc || "暂无描述"}</p>
							<p class="card-url">{friend.siteurl}</p>
						</div>
					</div>
				{:else}
					<div class="card-edit-form">
						<div class="edit-form-header">
							<iconify-icon icon="material-symbols:edit-document-outline-rounded" class="text-lg"></iconify-icon>
							<span>编辑友链</span>
							{#if friend._draft}
								<span class="draft-badge">新增</span>
							{/if}
						</div>
						<div class="form-group">
							<label>名称</label>
							<input
								type="text"
								value={friend.title}
								oninput={(e) => updateField(i, "title", (e.target as HTMLInputElement).value)}
								placeholder="站点名称"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>头像URL</label>
							<input
								type="text"
								value={friend.imgurl}
								oninput={(e) => updateField(i, "imgurl", (e.target as HTMLInputElement).value)}
								placeholder="https://example.com/avatar.png"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>链接</label>
							<input
								type="text"
								value={friend.siteurl}
								oninput={(e) => updateField(i, "siteurl", (e.target as HTMLInputElement).value)}
								placeholder="https://example.com"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>描述</label>
							<textarea
								value={friend.desc}
								oninput={(e) => updateField(i, "desc", (e.target as HTMLTextAreaElement).value)}
								placeholder="站点描述"
								class="form-textarea"
								rows={2}
							></textarea>
						</div>
						<div class="form-group">
							<label>类型</label>
							<select
								value={friend.tags?.[0] || "Blog"}
								onchange={(e) => {
									friends[i] = { ...friends[i], tags: [(e.target as HTMLSelectElement).value] };
									friends = [...friends];
								}}
								class="form-select"
							>
								<option value="Blog">Blog</option>
								<option value="Docs">Docs</option>
							</select>
						</div>
						<div class="form-actions">
							<button class="form-btn form-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
							<button class="form-btn form-btn-save" onclick={() => finishEdit(i)}>完成</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}

		{#if friends.length === 0}
			<div class="empty-state">
				<iconify-icon icon="material-symbols:link-off-rounded" class="text-4xl mb-2 opacity-40"></iconify-icon>
				<p>暂无友链，点击"添加"开始添加</p>
			</div>
		{/if}
	</div>
{/if}

<style>
	.edit-friends-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
	}

	.edit-friend-card {
		position: relative;
		border-radius: 16px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0,0,0,0.08));
		overflow: hidden;
		transition: all 0.2s;
	}
	:global(.dark) .edit-friend-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255,255,255,0.08);
	}
	.edit-friend-card:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0,0,0,0.08);
	}
	.edit-friend-card-draft {
		border-style: dashed;
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
	}
	.edit-friend-card-editing {
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
		opacity: 1;
		transition: opacity 0.2s;
	}
	.edit-friend-card:hover .card-action-row {
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
	.action-move { background: rgba(100, 116, 139, 1); }
	.action-move:hover { background: rgba(71, 85, 105, 1); transform: scale(1.1); }
	.action-edit { background: rgba(59, 130, 246, 1); }
	.action-edit:hover { background: rgba(37, 99, 235, 1); transform: scale(1.1); }
	.action-delete { background: rgba(239, 68, 68, 1); }
	.action-delete:hover { background: rgba(220, 38, 38, 1); transform: scale(1.1); }

	.card-display { padding: 20px; cursor: default; }
	.card-type-badge {
		display: inline-block; padding: 2px 10px; border-radius: 999px;
		font-size: 11px; font-weight: 600; margin-bottom: 12px;
	}
	.card-avatar-wrap {
		width: 48px; height: 48px; border-radius: 12px; overflow: hidden;
		margin-bottom: 12px; background: var(--btn-regular-bg, #f3f4f6);
		display: flex; align-items: center; justify-content: center;
	}
	:global(.dark) .card-avatar-wrap { background: rgba(255,255,255,0.05); }
	.card-avatar { width: 100%; height: 100%; object-fit: cover; }
	.card-avatar-placeholder {
		width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
		color: var(--content-meta, #9ca3af); font-size: 24px;
	}
	.card-title {
		margin: 0 0 4px; font-size: 15px; font-weight: 700;
		color: var(--text-color, #1f2937); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
	:global(.dark) .card-title { color: #f0f0f0; }
	.card-desc {
		margin: 0 0 6px; font-size: 13px; color: var(--text-secondary, #6b7280);
		line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
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