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
import { profileConfig } from "@/config";

interface MomentItem {
	id: string;
	author: string;
	avatar?: string;
	pinned: boolean;
	published: string;
	images: string[];
	tags: string[];
	location?: string;
	device?: string;
	body: string;
	enabled?: boolean;
	_draft?: boolean;
	_deleted?: boolean;
}

interface MomentsCover {
	cover_image: string;
	cover_avatar: string;
	cover_name: string;
	cover_bio: string;
}

let editMode = $state(false);
let saving = $state(false);
let moments = $state<MomentItem[]>([]);
let originalMoments = $state<MomentItem[]>([]);
let editingIndex = $state(-1);
let editPreview = $state("");
let imagesInput = $state("");
let tagsInput = $state("");
let coverImage = $state("");
let coverAvatar = $state("");
let coverName = $state("");
let coverBio = $state("");
let showAvatarInput = $state(false);
let avatarInputRef: HTMLInputElement | null = null;
let repoLoaded = $state(false);
let fileSha = $state<string | null>(null);
let originalTS = $state<string>("");

const pageKey = "moments";
const pageName = "说说";

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

function parseObjectFromTS(tsContent: string, startMarker: string): any | null {
	tsContent = tsContent.replace(/\r\n/g, "\n");
	const startIdx = tsContent.indexOf(startMarker);
	if (startIdx === -1) return null;
	let braceStart = tsContent.indexOf("{", startIdx);
	if (braceStart === -1) return null;
	let depth = 1;
	let idx = braceStart + 1;
	while (idx < tsContent.length && depth > 0) {
		if (tsContent[idx] === "{") depth++;
		else if (tsContent[idx] === "}") depth--;
		if (depth > 0) idx++;
	}
	let objStr = tsContent.substring(braceStart, idx + 1).trim();
	objStr = stripLineComments(objStr);
	objStr = objStr.replace(/,(\s*[\]\}])/g, "$1");
	objStr = objStr.replace(/,(\s*)$/, "$1");
	objStr = objStr.replace(/^(\s*)(\w+)\s*:/gm, '$1"$2":');
	try {
		return JSON.parse(objStr);
	} catch (e) {
		console.error("Failed to parse object from TS:", e);
		return null;
	}
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

function parseMomentsFromTS(tsContent: string): MomentItem[] {
	const items = parseArrayFromTS(tsContent, "export const momentsConfig: MomentItem[] = [");
	return items.map((item: any, index: number) => ({
		id: item.id || `moment-${index}`,
		author: item.author || "",
		avatar: item.avatar || "",
		pinned: !!item.pinned,
		published: item.published || new Date().toISOString().slice(0, 10),
		images: Array.isArray(item.images) ? item.images : [],
		tags: Array.isArray(item.tags) ? item.tags : [],
		location: item.location || "",
		device: item.device || "",
		body: item.body || "",
		enabled: item.enabled !== false,
	}));
}

function parseMomentsCoverFromTS(tsContent: string): MomentsCover | null {
	const obj = parseObjectFromTS(tsContent, "export const momentsCover: MomentsCover = {");
	if (!obj) return null;
	return {
		cover_image: obj.cover_image || "",
		cover_avatar: obj.cover_avatar || "",
		cover_name: obj.cover_name || "",
		cover_bio: obj.cover_bio || "",
	};
}

function buildMomentObject(m: MomentItem): string {
	const obj: any = {
		id: m.id,
		author: m.author,
	};
	if (m.avatar) obj.avatar = m.avatar;
	obj.pinned = m.pinned;
	obj.published = m.published;
	obj.images = m.images;
	obj.tags = m.tags;
	if (m.location) obj.location = m.location;
	if (m.device) obj.device = m.device;
	obj.body = m.body;
	obj.enabled = m.enabled !== false;

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

function replaceObjectInTS(
	originalContent: string,
	startMarker: string,
	newObjectContent: string,
): string {
	const startIdx = originalContent.indexOf(startMarker);
	if (startIdx === -1) return originalContent;
	let braceStart = originalContent.indexOf("{", startIdx);
	if (braceStart === -1) return originalContent;
	let depth = 1;
	let idx = braceStart + 1;
	while (idx < originalContent.length && depth > 0) {
		if (originalContent[idx] === "{") depth++;
		else if (originalContent[idx] === "}") depth--;
		if (depth > 0) idx++;
	}
	return (
		originalContent.substring(0, braceStart + 1) +
		"\n" +
		newObjectContent +
		"\n}" +
		originalContent.substring(idx + 1)
	);
}

function buildMomentsConfigTS(
	momentsList: MomentItem[],
	cover: MomentsCover,
	originalContent?: string,
): string {
	const momentEntries = momentsList.map((m) => buildMomentObject(m));
	const momentsArrayContent = momentEntries.join("\n");

	const coverObj = {
		cover_image: cover.cover_image,
		cover_avatar: cover.cover_avatar,
		cover_name: cover.cover_name,
		cover_bio: cover.cover_bio,
	};
	const coverJson = JSON.stringify(coverObj, null, 2)
		.split("\n")
		.map((line) => `\t${line}`)
		.join("\n");

	if (originalContent) {
		let result = originalContent;
		result = replaceArrayInTS(
			result,
			"export const momentsConfig: MomentItem[] = [",
			momentsArrayContent,
		);
		result = replaceObjectInTS(
			result,
			"export const momentsCover: MomentsCover = {",
			coverJson,
		);
		return result;
	}

	return `/**
 * 说说/动态页面配置
 * 用于管理首页说说展示的内容
 */

// 说说项类型定义
export interface MomentItem {
	id: string;
	author: string;
	avatar?: string;
	pinned: boolean;
	published: string;
	images: string[];
	tags: string[];
	location?: string;
	device?: string;
	body: string;
	enabled?: boolean;
}

// 说说封面配置
export interface MomentsCover {
	cover_image: string;
	cover_avatar: string;
	cover_name: string;
	cover_bio: string;
}

// 说说页面配置
export interface MomentsPageConfig {
	title?: string;
	description?: string;
	showComment?: boolean;
	randomizeSort?: boolean;
}

// 说说封面配置
export const momentsCover: MomentsCover = {
${coverJson}
};

// 说说列表配置
export const momentsConfig: MomentItem[] = [
${momentsArrayContent}
];

// 说说页面配置
export const momentsPageConfig: MomentsPageConfig = {
	title: "动态",
	description: "记录生活中的点点滴滴",
	showComment: true,
	randomizeSort: false,
};

// 获取启用的说说（按时间倒序，置顶优先）
export function getEnabledMoments(): MomentItem[] {
	const enabled = momentsConfig.filter((m) => m.enabled !== false);
	const pinned = enabled
		.filter((m) => m.pinned)
		.sort(
			(a, b) =>
				new Date(b.published).getTime() - new Date(a.published).getTime(),
		);
	const normal = enabled
		.filter((m) => !m.pinned)
		.sort(
			(a, b) =>
				new Date(b.published).getTime() - new Date(a.published).getTime(),
		);
	return [...pinned, ...normal];
}
`;
}

const drafts = setupRepoDrafts({
	pageKey,
	pageName,
	getContent: () =>
		buildMomentsConfigTS(
			moments.filter((m) => !m._deleted),
			{ cover_image: coverImage, cover_avatar: coverAvatar, cover_name: coverName, cover_bio: coverBio },
			originalTS,
		),
	setContent: (v) => {
		const parsedMoments = parseMomentsFromTS(v);
		const parsedCover = parseMomentsCoverFromTS(v);
		if (parsedMoments.length > 0 || v.includes("momentsConfig")) {
			moments = parsedMoments;
		}
		if (parsedCover) {
			coverImage = parsedCover.cover_image;
			coverAvatar = parsedCover.cover_avatar;
			coverName = parsedCover.cover_name;
			coverBio = parsedCover.cover_bio;
		}
	},
	getPath: () => "src/config/momentsConfig.ts",
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => originalTS,
	setOriginalContent: (v) => (originalTS = v),
	getCommitMsg: (isEdit) =>
		isEdit ? `chore(moments): 更新说说` : `chore(moments): 创建说说配置`,
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
		.replace(/&quot;/g, '"')
		.trim();
}

function collectFromDOM() {
	const feed = document.getElementById("moments-feed");
	if (!feed) return;

	const coverImgEl = document.querySelector(".wx-cover-img") as HTMLImageElement | null;
	if (coverImgEl) {
		coverImage = coverImgEl.src;
	}
	const avatarEl = document.querySelector(".wx-avatar") as HTMLImageElement | null;
	if (avatarEl) {
		coverAvatar = avatarEl.src;
	} else {
		coverAvatar = profileConfig.avatar || "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640";
	}
	const nameEl = document.querySelector(".wx-name");
	if (nameEl) {
		coverName = nameEl.textContent?.trim() || "";
	}
	const bioEl = document.querySelector(".wx-bio");
	if (bioEl) {
		coverBio = bioEl.textContent?.trim() || "";
	}

	const result: MomentItem[] = [];

	function collectCards(container: Element | null) {
		if (!container) return;
		container.querySelectorAll<HTMLElement>(".moment-card").forEach((el) => {
			const id = el.id || "";
			const author = el.querySelector(".user-name")?.textContent?.trim() || "";
			const avatarEl = el.querySelector(".card-avatar img") as HTMLImageElement | null;
			const avatar = avatarEl?.src || "";
			const timeEl = el.querySelector("time");
			const published = (timeEl?.getAttribute("datetime") || "").slice(0, 10);
			const pinned = !!el.querySelector(".pinned-badge");
			const location = el.querySelector(".location")?.textContent?.trim() || "";
			const device = el.querySelector(".device")?.textContent?.trim() || "";
			const contentEl = el.querySelector(".moment-markdown-content");
			const bodyHtml = contentEl?.innerHTML || "";
			const body = htmlToMarkdown(bodyHtml);

			const imageEls = el.querySelectorAll(".card-images img");
			const images: string[] = [];
			imageEls.forEach((img) => {
				const src = img.getAttribute("data-src") || img.getAttribute("src") || "";
				if (src) images.push(src);
			});

			const tagEls = el.querySelectorAll(".card-tags .tag-item");
			const tags: string[] = [];
			tagEls.forEach((tag) => {
				const text = tag.textContent?.trim().replace(/^#/, "") || "";
				if (text) tags.push(text);
			});

			result.push({
				id: id || genId("mom"),
				author,
				avatar,
				pinned,
				published: published || new Date().toISOString().slice(0, 10),
				images,
				tags,
				location,
				device,
				body,
				enabled: true,
			});
		});
	}

	const pinnedBlock = document.getElementById("pinned-block");

	collectCards(pinnedBlock);
	collectCards(feed);

	moments = result;
	originalMoments = deepClone(result);
}

async function loadRepoData() {
	const existing = await getRepoFile("src/config/momentsConfig.ts");
	if (existing && existing.content) {
		try {
			const repoMoments: MomentItem[] = parseMomentsFromTS(existing.content);
			const repoCover = parseMomentsCoverFromTS(existing.content);
			originalTS = existing.content;
			fileSha = existing.sha || null;

			const repoMap = new Map(repoMoments.map((m) => [m.id, m]));
			moments = moments.map((m) => {
				const repoItem = repoMap.get(m.id);
				if (repoItem) {
					return {
						...m,
						enabled: repoItem.enabled ?? m.enabled,
					};
				}
				return m;
			});

			const existingIds = new Set(moments.map((m) => m.id));
			for (const g of repoMoments) {
				if (!existingIds.has(g.id)) {
					moments = [...moments, { ...g, id: g.id || genId("mom") }];
					existingIds.add(g.id);
				}
			}

			if (repoCover) {
				coverImage = repoCover.cover_image;
				coverAvatar = repoCover.cover_avatar;
				coverName = repoCover.cover_name;
				coverBio = repoCover.cover_bio;
			}

			originalMoments = deepClone(moments);
		} catch (e) {
			console.error("Failed to parse repo moments:", e);
		}
	} else {
		originalTS = buildMomentsConfigTS(
			moments,
			{ cover_image: coverImage, cover_avatar: coverAvatar, cover_name: coverName, cover_bio: coverBio },
		);
	}
	repoLoaded = true;
	drafts.restoreFromDrafts();
}

function hideSSRContent() {
	const feed = document.getElementById("moments-feed");
	const pinnedBlock = document.getElementById("pinned-block");
	const emptyEl = document.getElementById("moments-empty");
	const coverEl = document.getElementById("moments-cover");
	if (feed) (feed as HTMLElement).style.display = "none";
	if (pinnedBlock) (pinnedBlock as HTMLElement).style.display = "none";
	if (emptyEl) (emptyEl as HTMLElement).style.display = "none";
	if (coverEl) (coverEl as HTMLElement).style.display = "none";
}

function showSSRContent() {
	const feed = document.getElementById("moments-feed");
	const pinnedBlock = document.getElementById("pinned-block");
	const emptyEl = document.getElementById("moments-empty");
	const coverEl = document.getElementById("moments-cover");
	if (feed) (feed as HTMLElement).style.display = "";
	if (pinnedBlock) (pinnedBlock as HTMLElement).style.display = "";
	if (emptyEl) (emptyEl as HTMLElement).style.display = "";
	if (coverEl) (coverEl as HTMLElement).style.display = "";
}

function handleCancel() {
	editMode = false;
	moments = deepClone(originalMoments);
	editingIndex = -1;
	drafts.clearDrafts();
	showSSRContent();
}

function startEdit(index: number) {
	editingIndex = index;
	imagesInput = moments[index].images.join("\n");
	tagsInput = moments[index].tags.join(", ");
	updatePreview(index);
}

function updatePreview(index: number) {
	const m = moments[index];
	if (!m) {
		editPreview = "";
		return;
	}
	try {
		editPreview = marked.parse(m.body || "", {
			gfm: true,
			breaks: true,
		}) as string;
	} catch {
		editPreview = m.body || "";
	}
}

function updateField(
	index: number,
	field: keyof MomentItem,
	value: string | string[] | boolean,
) {
	moments[index] = { ...moments[index], [field]: value };
	moments = [...moments];
	if (field === "body") {
		updatePreview(index);
	}
}

function finishEdit(index: number) {
	const m = moments[index];
	if (!m.body.trim()) {
		showToast("说说内容不能为空", "warning");
		return;
	}
	editingIndex = -1;
	showToast("已修改，记得点击保存", "info");
}

function cancelItemEdit(index: number) {
	const m = moments[index];
	if (m._draft && !m.body.trim()) {
		moments = moments.filter((_, i) => i !== index);
	} else {
		const orig = originalMoments.find((o) => o.id === m.id && !m._draft);
		if (orig) {
			moments[index] = deepClone(orig);
			moments = [...moments];
		}
	}
	editingIndex = -1;
}

function deleteItem(index: number) {
	const m = moments[index];
	const preview = m.body.slice(0, 30) + (m.body.length > 30 ? "..." : "");
	if (!confirm(`确定要删除「${preview || "该说说"}」吗？`)) return;
	if (m._draft) {
		moments = moments.filter((_, i) => i !== index);
	} else {
		moments[index] = { ...moments[index], _deleted: true };
		moments = [...moments];
	}

	if (editingIndex === index) editingIndex = -1;
	else if (editingIndex > index) editingIndex--;
	showToast("已标记删除，记得点击保存", "info");
}

function moveUp(index: number) {
	if (index <= 0) return;
	const arr = [...moments];
	[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
	moments = arr;

	if (editingIndex === index) editingIndex = index - 1;
	else if (editingIndex === index - 1) editingIndex = index;
}

function moveDown(index: number) {
	if (index >= moments.length - 1) return;
	const arr = [...moments];
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
	moments = arr;

	if (editingIndex === index) editingIndex = index + 1;
	else if (editingIndex === index + 1) editingIndex = index;
}

function restoreItem(index: number) {
	moments[index] = { ...moments[index], _deleted: false };
	moments = [...moments];
}

function togglePinned(index: number) {
	moments[index] = { ...moments[index], pinned: !moments[index].pinned };
	moments = [...moments];
}

function handleAdd() {
	const now = new Date();
	const dateStr = now.toISOString().slice(0, 10);
	const newMoment: MomentItem = {
		id: genId("mom"),
		author: profileConfig.name || "",
		avatar: (profileConfig as any).avatar || "",
		pinned: false,
		published: dateStr,
		images: [],
		tags: [],
		location: "",
		device: "",
		body: "",
		enabled: true,
		_draft: true,
	};
	moments = [newMoment, ...moments];
	editingIndex = 0;
	imagesInput = "";
	tagsInput = "";
	editPreview = "";
}

function parseImagesInput(input: string): string[] {
	return input
		.split(/[\n,;，；]/)
		.map((s) => s.trim())
		.filter((s) => s);
}

function parseTagsInput(input: string): string[] {
	return input
		.split(/[,，、\s]+/)
		.map((s) => s.trim().replace(/^#/, ""))
		.filter((s) => s);
}

function handleSaveDraft() {
	const cleanData = moments.map(({ _draft, _deleted, ...rest }) => ({
		...rest,
		id: rest.id || genId("mom"),
		enabled: rest.enabled !== false,
	}));
	moments = cleanData;
	drafts.saveToDrafts();
}

async function handleSubmit() {
	if (editingIndex >= 0) {
		const m = moments[editingIndex];
		m.images = parseImagesInput(imagesInput);
		m.tags = parseTagsInput(tagsInput);
		finishEdit(editingIndex);
		if (editingIndex >= 0) return;
	}
	if (!hasValidToken()) {
		showToast("GitHub 代理未配置，请联系管理员", "warning");
		return;
	}
	saving = true;
	try {
		const cleanData = moments.map(({ _draft, _deleted, ...rest }) => ({
			...rest,
			id: rest.id || genId("mom"),
			enabled: rest.enabled !== false,
		}));
		moments = cleanData;
		drafts.saveToDrafts();
		await drafts.submitDrafts();
	} catch (err) {
		showToast("保存出错：" + (err as Error).message, "error");
		console.error(err);
	} finally {
		saving = false;
	}
}

function getGridCols(count: number) {
	if (count === 1) return 1;
	if (count === 2 || count === 4) return 2;
	return 3;
}
</script>


{#if editMode}
  <div class="moments-edit-list">
    <div class="wx-cover wx-cover-editable">
      <div class="wx-cover-img-box">
        <img src={coverImage} alt="封面" class="wx-cover-img" />
        <label class="wx-edit-overlay wx-edit-cover">
          <iconify-icon icon="material-symbols:edit-rounded"></iconify-icon>
          <span>更换封面</span>
          <input type="text" bind:value={coverImage} placeholder="粘贴图片链接..." />
        </label>
      </div>
      <div class="wx-info-bar">
        <div class="wx-avatar-box">
          <img src={coverAvatar} alt={coverName} class="wx-avatar" />
          <button
            class="wx-edit-avatar"
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showAvatarInput = !showAvatarInput;
              if (!showAvatarInput) return;
              setTimeout(() => {
                avatarInputRef?.focus();
                avatarInputRef?.select();
              }, 10);
            }}
            title="编辑头像"
          >
            <iconify-icon icon="material-symbols:edit-rounded"></iconify-icon>
          </button>
          {#if showAvatarInput}
            <div class="wx-edit-avatar-popup">
              <input
                bind:this={avatarInputRef}
                type="text"
                bind:value={coverAvatar}
                placeholder="头像链接..."
                onblur={() => (showAvatarInput = false)}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            </div>
          {/if}
        </div>
        <div class="wx-name wx-name-editable">
          <input type="text" bind:value={coverName} placeholder="昵称..." />
        </div>
        {#if coverBio !== undefined}
          <div class="wx-bio wx-bio-editable">
            <input type="text" bind:value={coverBio} placeholder="个性签名..." />
          </div>
        {/if}
      </div>
    </div>

    {#each moments as moment, i (i + "-" + moment.id)}
      {#if !moment._deleted}
        <div
          class="moments-edit-card"
          class:moments-edit-card-draft={moment._draft}
          class:moments-edit-card-editing={editingIndex === i}
        >
          {#if editingIndex !== i}
            <div class="moments-card-actions">
              {#if i > 0}
                <button class="moments-action-btn moments-action-move" onclick={() => moveUp(i)} title="上移">
                  <iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
                </button>
              {/if}
              {#if i < moments.filter(m => !m._deleted).length - 1}
                <button class="moments-action-btn moments-action-move" onclick={() => moveDown(i)} title="下移">
                  <iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon>
                </button>
              {/if}
              <button class="moments-action-btn moments-action-pin" onclick={() => togglePinned(i)} title={moment.pinned ? "取消置顶" : "置顶"} style={moment.pinned ? 'background:rgba(245,158,11,0.9);' : ''}>
                <iconify-icon icon={moment.pinned ? "material-symbols:push-pin" : "material-symbols:push-pin-outline"}></iconify-icon>
              </button>
              <button class="moments-action-btn moments-action-edit" onclick={() => startEdit(i)} title="编辑">
                <iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
              </button>
              <button class="moments-action-btn moments-action-delete" onclick={() => deleteItem(i)} title="删除">
                <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
              </button>
            </div>

            <div class="moments-card-display">
              <div class="moments-card-header">
                <div class="moments-card-avatar">
                  {#if moment.avatar}
                    <img src={moment.avatar} alt={moment.author} />
                  {:else}
                    <div class="moments-card-avatar-placeholder">
                      <iconify-icon icon="material-symbols:person-outline"></iconify-icon>
                    </div>
                  {/if}
                </div>
                <div class="moments-card-meta">
                  <span class="moments-card-author">{moment.author || "匿名"}</span>
                  <span class="moments-card-date">{moment.published}</span>
                  {#if moment.location}
                    <span class="moments-card-location">
                      <iconify-icon icon="material-symbols:location-on-outline" width="12"></iconify-icon>
                      {moment.location}
                    </span>
                  {/if}
                  {#if moment.pinned}
                    <span class="moments-pinned-badge">
                      <iconify-icon icon="material-symbols:pinboard" width="12"></iconify-icon>
                      置顶
                    </span>
                  {/if}
                  {#if moment._draft}
                    <span class="moments-draft-badge">新增</span>
                  {/if}
                </div>
              </div>
              <div class="moments-card-body">
                {moment.body || "（无内容）"}
              </div>
              {#if moment.images && moment.images.length > 0}
                <div class={`moments-card-images cols-${getGridCols(moment.images.length)}`}>
                  {#each moment.images.slice(0, 9) as img, idx}
                    <img src={img} alt="" loading="lazy" />
                  {/each}
                </div>
              {/if}
              {#if moment.tags && moment.tags.length > 0}
                <div class="moments-card-tags">
                  {#each moment.tags as tag}
                    <span class="moments-tag">#{tag}</span>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <div class="moments-card-edit-form">
              <div class="moments-form-header">
                <iconify-icon icon="material-symbols:edit-document-outline-rounded"></iconify-icon>
                <span>编辑说说</span>
                {#if moment._draft}
                  <span class="moments-draft-badge">新增</span>
                {/if}
              </div>
              <div class="moments-form-grid">
                <div class="moments-form-group">
                  <label>作者</label>
                  <input type="text" class="moments-input" value={moment.author} oninput={(e) => updateField(i, "author", (e.target as HTMLInputElement).value)} placeholder="作者名称" />
                </div>
                <div class="moments-form-group">
                  <label>日期</label>
                  <input type="date" class="moments-input" value={moment.published} oninput={(e) => updateField(i, "published", (e.target as HTMLInputElement).value)} />
                </div>
                <div class="moments-form-group">
                  <label>位置</label>
                  <input type="text" class="moments-input" value={moment.location} oninput={(e) => updateField(i, "location", (e.target as HTMLInputElement).value)} placeholder="发布位置" />
                </div>
                <div class="moments-form-group">
                  <label>
                    <input type="checkbox" checked={moment.pinned} onchange={(e) => updateField(i, "pinned", (e.target as HTMLInputElement).checked)} />
                    置顶
                  </label>
                </div>
              </div>
              <div class="moments-form-group">
                <label>头像 URL（可选）</label>
                <input type="text" class="moments-input" value={moment.avatar || ""} oninput={(e) => updateField(i, "avatar", (e.target as HTMLInputElement).value)} placeholder="头像图片链接" />
              </div>
              <div class="moments-form-group">
                <label>设备（可选）</label>
                <input type="text" class="moments-input" value={moment.device || ""} oninput={(e) => updateField(i, "device", (e.target as HTMLInputElement).value)} placeholder="发布设备" />
              </div>
              <div class="moments-form-group">
                <label>内容（Markdown）</label>
                <div class="moments-md-split">
                  <textarea
                    class="moments-md-textarea"
                    value={moment.body}
                    oninput={(e) => updateField(i, "body", (e.target as HTMLTextAreaElement).value)}
                    placeholder="记录生活点滴..."
                    spellcheck="false"
                    rows={6}
                  ></textarea>
                  <div class="moments-md-preview">{@html editPreview}</div>
                </div>
              </div>
              <div class="moments-form-group">
                <label>图片链接（每行一个，最多9张）</label>
                <textarea
                  class="moments-textarea"
                  bind:value={imagesInput}
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                  rows={3}
                  spellcheck="false"
                ></textarea>
                {#if parseImagesInput(imagesInput).length > 0}
                  <div class={`moments-img-preview cols-${getGridCols(Math.min(parseImagesInput(imagesInput).length, 9))}`}>
                    {#each parseImagesInput(imagesInput).slice(0, 9) as img, idx}
                      <img src={img} alt="" onerror={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')} />
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="moments-form-group">
                <label>标签（逗号分隔）</label>
                <input
                  type="text"
                  class="moments-input"
                  bind:value={tagsInput}
                  placeholder="生活, 日常, 分享"
                />
              </div>
              <div class="moments-form-actions">
                <button class="moments-btn moments-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
                <button class="moments-btn moments-btn-save" onclick={() => {
                  moments[i].images = parseImagesInput(imagesInput);
                  moments[i].tags = parseTagsInput(tagsInput);
                  moments = [...moments];
                  finishEdit(i);
                }}>完成</button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="moments-edit-card moments-edit-card-deleted">
          <div class="moments-deleted-info">
            <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
            <span>已标记删除</span>
          </div>
          <button class="moments-btn moments-btn-restore" onclick={() => restoreItem(i)}>撤销删除</button>
        </div>
      {/if}
    {/each}

    {#if moments.filter(m => !m._deleted).length === 0}
      <div class="moments-empty-state">
        <iconify-icon icon="material-symbols:sentiment-neutral-outline" style="font-size:48px;opacity:0.3;"></iconify-icon>
        <p>暂无说说，点击"添加"发布第一条</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .moments-edit-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 1rem 0;
  }

  .moments-edit-card {
    position: relative;
    border-radius: 16px;
    background: var(--card-bg, white);
    border: 1px solid var(--border, rgba(0,0,0,0.08));
    overflow: hidden;
    transition: all 0.2s;
  }
  :global(.dark) .moments-edit-card {
    background: rgba(23, 23, 23, 0.8);
    border-color: rgba(255,255,255,0.08);
  }
  .moments-edit-card:hover {
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
  }
  .moments-edit-card-draft {
    border-style: dashed;
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
  }
  .moments-edit-card-editing {
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
    box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }
  .moments-edit-card-deleted {
    opacity: 0.6;
    border-style: dashed;
    border-color: rgba(239, 68, 68, 0.3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
  }

  .wx-cover.wx-cover-editable {
    margin-bottom: 0;
    border-radius: 12px;
    overflow: visible;
    position: relative;
    border: 2px solid hsla(var(--theme-hue, 165), 70%, 50%, 0.4);
  }

  .wx-cover.wx-cover-editable .wx-cover-img-box {
    width: 100%;
    height: 280px;
    border-radius: 10px 10px 0 0;
    overflow: hidden;
    position: relative;
  }

  .wx-cover.wx-cover-editable .wx-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
  }

  .wx-edit-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.2s;
    cursor: pointer;
    color: #fff;
  }
  .wx-cover-img-box:hover .wx-edit-overlay {
    opacity: 1;
  }
  .wx-edit-overlay iconify-icon {
    font-size: 2rem;
  }
  .wx-edit-overlay span {
    font-size: 0.875rem;
  }
  .wx-edit-overlay input {
    margin-top: 8px;
    width: 80%;
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    font-size: 0.8125rem;
    color: #333;
  }

  .wx-cover.wx-cover-editable .wx-info-bar {
    position: relative;
    background: var(--card-bg);
    border: none;
    border-radius: 0 0 10px 10px;
    padding: 0.75rem 1.25rem 1rem;
    min-height: 2rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .wx-cover.wx-cover-editable .wx-avatar-box {
    position: absolute;
    top: 0;
    right: 1.25rem;
    transform: translateY(-65%);
    z-index: 20;
  }

  .wx-cover.wx-cover-editable .wx-avatar {
    width: 5rem;
    height: 5rem;
    border-radius: 6px;
    object-fit: cover;
    border: 3px solid var(--card-bg);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
    display: block;
  }

  .wx-edit-avatar {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: hsla(var(--theme-hue, 165), 70%, 50%, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    cursor: pointer;
    font-size: 0.9rem;
    border: none;
    padding: 0;
    z-index: 10;
  }
  .wx-edit-avatar:hover {
    background: hsla(var(--theme-hue, 165), 70%, 45%, 1);
  }
  .wx-edit-avatar-popup {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    z-index: 100;
  }
  .wx-edit-avatar-popup input {
    width: 220px;
    padding: 8px 12px;
    font-size: 0.875rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--card-bg);
    color: var(--text-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    outline: none;
  }
  .wx-edit-avatar-popup input:focus {
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.8);
  }

  .wx-cover.wx-cover-editable .wx-name {
    position: absolute;
    right: 7rem;
    top: 0;
    transform: translateY(-110%);
    font-size: 1.25rem;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
    white-space: nowrap;
    z-index: 15;
  }

  .wx-cover.wx-cover-editable .wx-name input {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #fff;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 700;
    width: 160px;
    outline: none;
  }
  .wx-cover.wx-cover-editable .wx-name input:focus {
    border-color: #fff;
    background: rgba(0, 0, 0, 0.5);
  }

  .wx-cover.wx-cover-editable .wx-bio {
    font-size: 0.8125rem;
    color: var(--content-meta);
    line-height: 1.5;
    text-align: right;
    max-width: calc(100% - 8rem);
    margin-left: auto;
    margin-top: 2rem;
  }

  .wx-cover.wx-cover-editable .wx-bio input {
    background: transparent;
    border: 1px dashed var(--border, rgba(0, 0, 0, 0.2));
    color: var(--content-meta);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.8125rem;
    text-align: right;
    width: 100%;
    outline: none;
  }
  .wx-cover.wx-cover-editable .wx-bio input:focus {
    border-style: solid;
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
  }

  .moments-card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .moments-edit-card:hover .moments-card-actions {
    opacity: 1;
  }
  .moments-action-btn {
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
  .moments-action-btn iconify-icon {
    display: flex;
  }
  .moments-action-move {
    background: rgba(100, 116, 139, 0.9);
  }
  .moments-action-move:hover {
    background: rgba(71, 85, 105, 1);
    transform: scale(1.1);
  }
  .moments-action-pin {
    background: rgba(107, 114, 128, 0.9);
  }
  .moments-action-pin:hover {
    transform: scale(1.1);
  }
  .moments-action-edit {
    background: rgba(59, 130, 246, 0.9);
  }
  .moments-action-edit:hover {
    background: rgba(37, 99, 235, 1);
    transform: scale(1.1);
  }
  .moments-action-delete {
    background: rgba(239, 68, 68, 0.9);
  }
  .moments-action-delete:hover {
    background: rgba(220, 38, 38, 1);
    transform: scale(1.1);
  }

  .moments-card-display {
    padding: 16px 20px;
  }
  .moments-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .moments-card-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid hsl(var(--theme-hue, 165), 70%, 50%);
    background: var(--btn-regular-bg, #f3f4f6);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .moments-card-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .moments-card-avatar-placeholder {
    color: var(--content-meta, #9ca3af);
    font-size: 20px;
  }
  .moments-card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 12px;
  }
  .moments-card-author {
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--theme-hue, 165), 70%, 50%);
  }
  .moments-card-date {
    color: var(--content-meta, #9ca3af);
  }
  .moments-card-location {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: var(--content-meta, #9ca3af);
  }
  .moments-pinned-badge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 6px;
    background: var(--btn-regular-bg);
    color: var(--btn-content);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
  }
  .moments-draft-badge {
    padding: 1px 8px;
    border-radius: 999px;
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
    font-size: 11px;
    font-weight: 600;
  }
  .moments-card-body {
    font-size: 14px;
    color: var(--text-color, #1f2937);
    line-height: 1.6;
    margin-bottom: 10px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  :global(.dark) .moments-card-body {
    color: #e5e7eb;
  }

  .moments-card-images {
    display: grid;
    gap: 4px;
    margin-bottom: 10px;
  }
  .moments-card-images.cols-1 { grid-template-columns: 150px; }
  .moments-card-images.cols-2 { grid-template-columns: repeat(2, 100px); }
  .moments-card-images.cols-3 { grid-template-columns: repeat(3, 80px); }
  .moments-card-images img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 6px;
  }

  .moments-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--border, rgba(0,0,0,0.08));
  }
  .moments-tag {
    padding: 2px 8px;
    background: transparent;
    border: 1px solid hsl(var(--theme-hue, 165), 70%, 50%);
    border-radius: 999px;
    font-size: 11px;
    color: hsl(var(--theme-hue, 165), 70%, 50%);
  }

  .moments-deleted-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #ef4444;
  }

  .moments-card-edit-form {
    padding: 20px;
  }
  .moments-form-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--theme-hue, 165), 70%, 45%);
  }
  .moments-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }
  .moments-form-group {
    margin-bottom: 12px;
  }
  .moments-form-group label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #4b5563);
    margin-bottom: 4px;
  }
  :global(.dark) .moments-form-group label {
    color: #d1d5db;
  }
  .moments-form-group label input[type="checkbox"] {
    margin-right: 4px;
    vertical-align: middle;
  }
  .moments-input,
  .moments-textarea,
  .moments-select {
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
  :global(.dark) .moments-input,
  :global(.dark) .moments-textarea,
  :global(.dark) .moments-select {
    background: #0f0f1a;
    border-color: #374151;
    color: #e5e7eb;
  }
  .moments-input:focus,
  .moments-textarea:focus,
  .moments-select:focus {
    border-color: hsl(var(--theme-hue, 165), 70%, 50%);
    box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }
  .moments-textarea {
    resize: vertical;
    min-height: 60px;
  }

  .moments-md-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1.5px solid var(--border, #d1d5db);
    border-radius: 8px;
    overflow: hidden;
    min-height: 120px;
  }
  :global(.dark) .moments-md-split {
    border-color: #374151;
  }
  .moments-md-textarea {
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
    min-height: 120px;
    box-sizing: border-box;
  }
  :global(.dark) .moments-md-textarea {
    background: #0d0d18;
    color: #e5e7eb;
  }
  .moments-md-preview {
    padding: 10px;
    overflow-y: auto;
    font-size: 12px;
    line-height: 1.6;
    color: var(--deep-text);
    border-left: 1px solid var(--border, #d1d5db);
    background: var(--card-bg, white);
    min-height: 120px;
  }
  :global(.dark) .moments-md-preview {
    border-left-color: #374151;
    background: rgba(23, 23, 23, 0.5);
  }
  .moments-md-preview :global(p) {
    margin: 0.25rem 0;
  }
  .moments-md-preview :global(code) {
    background: var(--btn-plain-bg-hover);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.85em;
  }

  .moments-img-preview {
    display: grid;
    gap: 4px;
    margin-top: 8px;
  }
  .moments-img-preview.cols-1 { grid-template-columns: 80px; }
  .moments-img-preview.cols-2 { grid-template-columns: repeat(2, 70px); }
  .moments-img-preview.cols-3 { grid-template-columns: repeat(3, 60px); }
  .moments-img-preview img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 4px;
  }

  .moments-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .moments-btn {
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
  .moments-btn-cancel {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-color, #374151);
  }
  .moments-btn-cancel:hover {
    background: var(--border, #e5e7eb);
  }
  :global(.dark) .moments-btn-cancel {
    background: #2d2d44;
    color: #d1d5db;
  }
  :global(.dark) .moments-btn-cancel:hover {
    background: #3d3d55;
  }
  .moments-btn-save {
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
  }
  .moments-btn-save:hover {
    background: hsl(var(--theme-hue, 165), 75%, 45%);
  }
  .moments-btn-restore {
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
  .moments-btn-restore:hover {
    background: #22c55e;
    color: white;
  }

  .moments-empty-state {
    text-align: center;
    padding: 48px 20px;
    color: var(--content-meta, #9ca3af);
    font-size: 14px;
  }

  @media (max-width: 640px) {
    .moments-form-grid {
      grid-template-columns: 1fr 1fr;
    }
    .moments-md-split {
      grid-template-columns: 1fr;
    }
    .moments-md-preview {
      border-left: none;
      border-top: 1px solid var(--border, #d1d5db);
    }
    .moments-card-images.cols-1 { grid-template-columns: 120px; }
    .moments-card-images.cols-2 { grid-template-columns: repeat(2, 90px); }
    .moments-card-images.cols-3 { grid-template-columns: repeat(3, 70px); }
  }
</style>
