<script lang="ts">
import { onMount } from "svelte";
import {
	hasValidToken,
	showToast,
	genId,
	deepClone,
	ensureIconify,
	getRepoFile,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";

interface DaohangItem {
	id: string;
	name: string;
	url: string;
	description: string;
	category: string;
	icon: string;
	tags: string[];
	color: string;
	image?: string;
	featured: boolean;
	order: number;
	enabled?: boolean;
	_draft?: boolean;
	_deleted?: boolean;
}

interface CollectionApiItem {
	id: string;
	name: string;
	url: string;
	description: string;
	icon: string;
	enabled?: boolean;
	_draft?: boolean;
	_deleted?: boolean;
}

interface CollectionApiGroup {
	category: string;
	items: CollectionApiItem[];
}

type EditableItem = DaohangItem | CollectionApiItem;

interface Props {
	pageKey?: string;
	customPageName?: string;
	initialItems?: any[];
}

let {
	pageKey: propPageKey = "daohang",
	customPageName = "",
	initialItems = [],
}: Props = $props();

let editMode = $state(false);
let saving = $state(false);
let items = $state<any[]>([]);
let originalItems = $state<any[]>([]);
let editingIndex = $state(-1);
let activeTab = $state("all");
let fileSha = $state<string | null>(null);
let repoLoaded = $state(false);
let originalTS = $state<string>("");

const pageKey = $derived(propPageKey);
const pageName = $derived(customPageName || (propPageKey === "projects" ? "网站导航" : "导航"));
const isCollectionApi = $derived(propPageKey === "projects");
const configFilePath = $derived(isCollectionApi ? "src/config/projectsConfig.ts" : "src/config/daohangConfig.ts");

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

function parseDaohangFromTS(tsContent: string): DaohangItem[] {
	const items = parseArrayFromTS(tsContent, "export const daohangConfig: DaohangItem[] = [");
	return items.map((item: any, index: number) => ({
		id: item.id || `dh-${index}`,
		name: item.name || "",
		url: item.url || "",
		description: item.description || "",
		category: item.category || "未分类",
		icon: item.icon || "",
		tags: Array.isArray(item.tags) ? item.tags : [],
		color: item.color || "",
		image: item.image || "",
		featured: !!item.featured,
		order: typeof item.order === "number" ? item.order : index * 10,
		enabled: item.enabled !== false,
	}));
}

function buildDaohangObject(item: DaohangItem): string {
	const obj: any = {
		id: item.id,
		name: item.name,
		url: item.url,
		icon: item.icon,
		description: item.description,
		category: item.category,
		tags: item.tags,
		color: item.color,
	};
	if (item.image) obj.image = item.image;
	obj.featured = item.featured;
	obj.order = item.order;
	obj.enabled = item.enabled !== false;

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

function buildDaohangConfigTS(
	daohangList: DaohangItem[],
	originalContent?: string,
): string {
	const daohangEntries = daohangList.map((m) => buildDaohangObject(m));
	const daohangArrayContent = daohangEntries.join("\n");

	if (originalContent) {
		let result = originalContent;
		result = replaceArrayInTS(
			result,
			"export const daohangConfig: DaohangItem[] = [",
			daohangArrayContent,
		);
		return result;
	}

	return `export interface DaohangItem {
	id: string;
	name: string;
	url: string;
	icon: string;
	description: string;
	category: string;
	tags: string[];
	color: string;
	image?: string;
	featured: boolean;
	order: number;
	enabled?: boolean;
}

export interface DaohangPageConfig {
	title?: string;
	description?: string;
	showComment?: boolean;
}

export const daohangPageConfig: DaohangPageConfig = {
	title: "网站导航",
	description: "收录个人网站、常用工具和收藏网站",
	showComment: false,
};

export const daohangConfig: DaohangItem[] = [
${daohangArrayContent}
];

export const categoryOrder: Record<string, number> = {
	"我的网站": 0,
	"常用网站": 1,
	"资源网站": 2,
	"工具网站": 3,
	"大佬博客": 4,
	"学习网站": 5,
	"设计资源": 6,
	"开发工具": 7,
	"学习资源": 8,
	"AI 工具": 9,
	"文档": 10,
	"其他网站": 11,
};

export const categoryIcons: Record<string, string> = {
	"我的网站": "material-symbols:person",
	"常用网站": "material-symbols:star",
	"资源网站": "material-symbols:folder",
	"工具网站": "material-symbols:handyman",
	"大佬博客": "material-symbols:menu-book",
	"学习网站": "material-symbols:school",
	"设计资源": "material-symbols:palette-outline",
	"开发工具": "material-symbols:code-rounded",
	"学习资源": "material-symbols:school",
	"AI 工具": "material-symbols:smart-toy-outline",
	"文档": "material-symbols:description",
	"其他网站": "material-symbols:link",
};

export function getAllDaohang(): DaohangItem[] {
	return [...daohangConfig].sort((a, b) => a.order - b.order);
}

export function getEnabledDaohang(): DaohangItem[] {
	return daohangConfig
		.filter((item) => item.enabled !== false)
		.sort((a, b) => a.order - b.order);
}

export function getDaohangByCategory(category: string): DaohangItem[] {
	return daohangConfig
		.filter((item) => item.enabled !== false && item.category === category)
		.sort((a, b) => a.order - b.order);
}

export function getFeaturedDaohang(): DaohangItem[] {
	return daohangConfig
		.filter((item) => item.enabled !== false && item.featured)
		.sort((a, b) => a.order - b.order);
}

export function getAllCategories(): string[] {
	const categories = new Set(daohangConfig.map((item) => item.category));
	return [...categories].sort(
		(a, b) => (categoryOrder[a] ?? 99) - (categoryOrder[b] ?? 99),
	);
}

export function getEnabledCategories(): string[] {
	const enabled = daohangConfig.filter((item) => item.enabled !== false);
	const categories = new Set(enabled.map((item) => item.category));
	return [...categories].sort(
		(a, b) => (categoryOrder[a] ?? 99) - (categoryOrder[b] ?? 99),
	);
}

export function getCategoryIcon(category: string): string {
	return categoryIcons[category] || "material-symbols:link";
}
`;
}

// ============ CollectionApi 模式（projects 页面）============

function collectionItemId(item: { name: string; url: string; category: string }): string {
	const key = `${item.category}::${item.name}::${item.url}`;
	let h = 0;
	for (let i = 0; i < key.length; i++) {
		h = (h * 31 + key.charCodeAt(i)) | 0;
	}
	return `pj-${(h >>> 0).toString(36)}`;
}

function parseCollectionApiFromTS(tsContent: string): CollectionApiItem[] {
	const groups = parseArrayFromTS(tsContent, "export const projectsPageConfig: CollectionsApiConfig = {");
	const result: CollectionApiItem[] = [];
	if (groups && Array.isArray(groups) && groups[0] && Array.isArray(groups[0].apis)) {
		for (const g of groups[0].apis) {
			const cat = g.category || "未分类";
			for (const item of g.items || []) {
				result.push({
					id: collectionItemId({ name: item.name, url: item.url, category: cat }),
					name: item.name || "",
					url: item.url || "",
					description: item.description || "",
					icon: item.icon || "",
					category: cat,
					enabled: item.enabled !== false,
				});
			}
		}
	}
	return result;
}

function buildCollectionApiObject(item: CollectionApiItem): string {
	const obj: any = {
		name: item.name,
		url: item.url,
		description: item.description,
		icon: item.icon,
		enabled: item.enabled !== false,
	};
	const json = JSON.stringify(obj, null, 2)
		.split("\n")
		.map((line, i, arr) =>
			i === arr.length - 1 ? `\t\t\t\t${line},` : `\t\t\t\t${line}`,
		)
		.join("\n");
	return json;
}

function buildCollectionApiGroupsContent(groups: CollectionApiGroup[]): string {
	return groups
		.map((g) => {
			const itemsContent = g.items
				.map((it) => buildCollectionApiObject(it))
				.join("\n");
			return `\t\t{\n\t\t\tcategory: ${JSON.stringify(g.category)},\n\t\t\titems: [\n${itemsContent}\n\t\t\t],\n\t\t},`;
		})
		.join("\n");
}

function buildCollectionApiConfigTS(
	apiList: CollectionApiItem[],
	originalContent?: string,
): string {
	// 按 category 分组
	const groupsMap = new Map<string, CollectionApiItem[]>();
	for (const item of apiList) {
		const cat = item.category || "未分类";
		if (!groupsMap.has(cat)) groupsMap.set(cat, []);
		groupsMap.get(cat)!.push(item);
	}
	const groups: CollectionApiGroup[] = Array.from(groupsMap.entries()).map(
		([category, items]) => ({ category, items }),
	);
	const apisContent = buildCollectionApiGroupsContent(groups);

	if (originalContent) {
		let result = originalContent;
		// 替换 apis: [...] 数组的内容
		const startMarker = "apis: [";
		const startIdx = result.indexOf(startMarker);
		if (startIdx !== -1) {
			const bracketStart = result.indexOf("[", startIdx);
			if (bracketStart !== -1) {
				let depth = 1;
				let idx = bracketStart + 1;
				while (idx < result.length && depth > 0) {
					if (result[idx] === "[") depth++;
					else if (result[idx] === "]") depth--;
					if (depth > 0) idx++;
				}
				result =
					result.substring(0, bracketStart + 1) +
					"\n" +
					apisContent +
					"\n\t" +
					result.substring(idx);
			}
		}
		return result;
	}

	return `import type { CollectionsApiConfig } from "../types/config";

export const projectsPageConfig: CollectionsApiConfig = {
\ttitle: "网站导航",
\tdescription: "收录个人网站、常用工具和收藏网站",
\tapis: [
${apisContent}
\t],
};
`;
}

const drafts = setupRepoDrafts({
	get pageKey() {
		return pageKey;
	},
	get pageName() {
		return pageName;
	},
	getContent: () => {
		const visible = items.filter((m) => !m._deleted) as any[];
		if (isCollectionApi) {
			return buildCollectionApiConfigTS(visible, originalTS);
		}
		return buildDaohangConfigTS(visible, originalTS);
	},
	setContent: (v) => {
		if (isCollectionApi) {
			const parsed = parseCollectionApiFromTS(v);
			if (parsed.length > 0 || v.includes("projectsPageConfig")) {
				items = parsed as any;
			}
		} else {
			const parsed = parseDaohangFromTS(v);
			if (parsed.length > 0 || v.includes("daohangConfig")) {
				items = parsed;
			}
		}
	},
	getPath: () => configFilePath,
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => originalTS,
	setOriginalContent: (v) => (originalTS = v),
	getCommitMsg: (isEdit) => {
		const prefix = isCollectionApi ? "projects" : "daohang";
		const label = isCollectionApi ? "网站导航" : "导航";
		return isEdit ? `chore(${prefix}): 更新${label}` : `chore(${prefix}): 创建${label}配置`;
	},
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
	// 优先使用 initialItems（来自 Astro 页面传入的 props）
	if (Array.isArray(initialItems) && initialItems.length > 0) {
		if (isCollectionApi) {
			// initialItems 是 CollectionApiGroup[] 格式
			const flat: any[] = [];
			for (const g of initialItems) {
				const cat = g.category || "未分类";
				for (const item of g.items || []) {
					flat.push({
						id: collectionItemId({ name: item.name || "", url: item.url || "", category: cat }),
						name: item.name || "",
						url: item.url || "",
						description: item.description || "",
						icon: item.icon || "",
						category: cat,
						enabled: item.enabled !== false,
					});
				}
			}
			items = flat;
			originalItems = deepClone(flat);
		} else {
			items = initialItems.map((m: any, i: number) => ({
				id: m.id || genId("dh"),
				name: m.name || "",
				url: m.url || "",
				description: m.description || "",
				category: m.category || "未分类",
				icon: m.icon || "",
				tags: Array.isArray(m.tags) ? m.tags : [],
				color: m.color || "",
				image: m.image || "",
				featured: !!m.featured,
				order: typeof m.order === "number" ? m.order : i * 10,
				enabled: m.enabled !== false,
			}));
			originalItems = deepClone(items);
		}
	} else {
		collectFromDOM();
	}
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
	const allSection = document.querySelector('[data-tools-section="all"]');
	if (!allSection) return;
	const cards = allSection.querySelectorAll(".tools-card");
	const collected: any[] = [];
	cards.forEach((el) => {
		const card = el as HTMLElement;
		const link = card.querySelector("a") || card;
		const href = card.getAttribute("href") || link.getAttribute("href") || "";
		const name = card.querySelector("h3")?.textContent?.trim() || "";
		const desc = card.querySelector(".tools-card-desc")?.textContent?.trim() || "";
		const category = card.dataset.category || "";
		const iconEl = card.querySelector("img") as HTMLImageElement | null;
		const icon = iconEl?.src || "";
		if (isCollectionApi) {
			collected.push({
				id: collectionItemId({ name, url: href, category }),
				name,
				url: href,
				description: desc,
				icon,
				category,
				enabled: true,
			});
		} else {
			collected.push({
				id: genId("dh"),
				name,
				url: href,
				description: desc,
				category,
				icon,
				tags: [],
				color: "",
				featured: false,
				order: collected.length * 10,
				enabled: true,
			});
		}
	});
	if (collected.length > 0) {
		items = collected;
		originalItems = deepClone(collected);
	}
}

async function loadRepoData() {
	const existing = await getRepoFile(configFilePath);
	if (existing && existing.content) {
		try {
			originalTS = existing.content;
			fileSha = existing.sha || null;

			if (isCollectionApi) {
				const repoItems = parseCollectionApiFromTS(existing.content);
				if (repoItems.length > 0) {
					items = repoItems;
				}
			} else {
				const repoItems: DaohangItem[] = parseDaohangFromTS(existing.content);
				if (repoItems.length > 0) {
					items = repoItems;
				}
			}

			originalItems = deepClone(items);
		} catch (e) {
			console.error("Failed to parse repo data:", e);
		}
	} else {
		originalTS = isCollectionApi
			? buildCollectionApiConfigTS(items as any)
			: buildDaohangConfigTS(items);
	}
	repoLoaded = true;
	drafts.restoreFromDrafts();
}

const enabledItems = $derived(items.filter((i) => i.enabled !== false && !i._deleted));
const allCategories = $derived([
	...new Set(items.filter((i) => !i._deleted).map((i) => i.category).filter(Boolean)),
]);
const enabledCategories = $derived([
	...new Set(enabledItems.map((i) => i.category).filter(Boolean)),
]);
const categories = $derived(editMode ? allCategories : enabledCategories);
const categoryCounts = $derived.by(() => {
	const counts: Record<string, number> = {};
	const source = editMode ? items.filter((i) => !i._deleted) : enabledItems;
	for (const item of source) {
		counts[item.category] = (counts[item.category] || 0) + 1;
	}
	return counts;
});
const sourceItems = $derived(editMode ? items.filter((i) => !i._deleted) : enabledItems);
const displayItems = $derived(
	activeTab === "all"
		? sourceItems
		: sourceItems.filter((i) => i.category === activeTab),
);

function hideSSRGrid() {
	// 兼容两种 SSR 网格 id
	const ids = ["daohang-grid", "projects-grid"];
	for (const id of ids) {
		const grid = document.getElementById(id);
		if (grid) grid.style.display = "none";
	}
	// 同时隐藏所有 data-tools-section
	document.querySelectorAll("[data-tools-section]").forEach((el) => {
		(el as HTMLElement).style.display = "none";
	});
}

function showSSRGrid() {
	const ids = ["daohang-grid", "projects-grid"];
	for (const id of ids) {
		const grid = document.getElementById(id);
		if (grid) grid.style.display = "";
	}
	// 恢复 data-tools-section 的可见性（保留原有的 hidden class 逻辑）
	document.querySelectorAll("[data-tools-section]").forEach((el) => {
		(el as HTMLElement).style.display = "";
	});
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
	if (item._draft) {
		items = items.filter((_, i) => i !== globalIdx);
	} else {
		items[globalIdx] = { ...items[globalIdx], _deleted: true };
		items = [...items];
	}
	if (editingIndex === globalIdx) editingIndex = -1;
	else if (editingIndex > globalIdx) editingIndex--;
	showToast("已标记删除，记得点击保存", "info");
}

function restoreItem(index: number) {
	const globalIdx = items.indexOf(displayItems[index]);
	if (globalIdx >= 0) {
		items[globalIdx] = { ...items[globalIdx], _deleted: false };
		items = [...items];
	}
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
		tags: [],
		color: "",
		featured: false,
		order: items.length * 10,
		enabled: true,
		_draft: true,
	};
	items = [...items, newItem];
	editingIndex = items.length - 1;
	activeTab = "all";
}

function handleSaveDraft() {
	const cleanData = items.map(({ _draft, _deleted, ...rest }) => ({
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
	if (!hasValidToken()) {
		showToast("GitHub 代理未配置，请联系管理员", "warning");
		return;
	}
	saving = true;
	try {
		const cleanData = items.map(({ _draft, _deleted, ...rest }) => ({
			...rest,
			id: rest.id || genId("dh"),
			enabled: rest.enabled !== false,
		}));
		items = cleanData;
		drafts.saveToDrafts();
		await drafts.submitDrafts();
	} catch (err) {
		showToast("保存出错：" + (err as Error).message, "error");
		console.error(err);
	} finally {
		saving = false;
	}
}

function updateField(
	index: number,
	field: keyof DaohangItem,
	value: string | boolean | string[] | number,
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

function parseTagsInput(input: string): string[] {
	return input
		.split(/[,，、\s]+/)
		.map((s) => s.trim())
		.filter((s) => s);
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
			{#if !item._deleted}
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
							{#if item.featured}
								<span class="card-featured-badge">精选</span>
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
								{#if item.tags && item.tags.length > 0}
									<div class="card-tags">
										{#each item.tags as tag}
											<span class="card-tag">#{tag}</span>
										{/each}
									</div>
								{/if}
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
								<label>图标 (iconify 图标名或图片 URL)</label>
								<input
									type="text"
									value={item.icon || ""}
									oninput={(e) => updateField(globalIdx, "icon", (e.target as HTMLInputElement).value)}
									placeholder="material-symbols:link 或 https://example.com/icon.png"
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
							{#if !isCollectionApi}
							<div class="form-group">
								<label>标签（逗号分隔）</label>
								<input
									type="text"
									value={(item.tags || []).join(", ")}
									oninput={(e) => updateField(globalIdx, "tags", parseTagsInput((e.target as HTMLInputElement).value))}
									placeholder="工具, 资源, 学习"
									class="form-input"
								/>
							</div>
							<div class="form-group">
								<label>颜色</label>
								<input
									type="text"
									value={item.color || ""}
									oninput={(e) => updateField(globalIdx, "color", (e.target as HTMLInputElement).value)}
									placeholder="#f97316"
									class="form-input"
								/>
							</div>
							<div class="form-group">
								<label>排序</label>
								<input
									type="number"
									value={item.order}
									oninput={(e) => updateField(globalIdx, "order", parseInt((e.target as HTMLInputElement).value) || 0)}
									placeholder="10"
									class="form-input"
								/>
							</div>
							{/if}
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
								{#if !isCollectionApi}
								<label class="checkbox-label">
									<input
										type="checkbox"
										checked={item.featured}
										onchange={(e) => updateField(globalIdx, "featured", (e.target as HTMLInputElement).checked)}
										class="form-checkbox"
									/>
									<span>精选</span>
								</label>
								{/if}
							</div>
							<div class="form-actions">
								<button class="form-btn form-btn-cancel" onclick={() => cancelItemEdit(globalIdx)}>取消</button>
								<button class="form-btn form-btn-save" onclick={() => finishEdit(globalIdx)}>完成</button>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="edit-daohang-card edit-daohang-card-deleted">
					<div class="deleted-info">
						<iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
						<span>已标记删除</span>
					</div>
					<button class="restore-btn" onclick={() => restoreItem(i)}>撤销删除</button>
				</div>
			{/if}
		{/each}

		{#if items.filter((i) => !i._deleted).length === 0}
			<div class="empty-state">
				<iconify-icon icon="material-symbols:bookmark-outline-rounded" class="text-4xl mb-2 opacity-40"></iconify-icon>
				<p>暂无导航，点击"添加"开始添加</p>
			</div>
		{/if}
	</div>
{/if}

<style>
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
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
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

	.edit-daohang-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 16px;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		box-sizing: border-box;
		contain: inline-size;
	}
	:global(.tools-edit-grid) {
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) !important;
	}

	.edit-daohang-card {
		position: relative;
		border-radius: 16px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
		overflow: hidden;
		transition: all 0.2s;
		min-width: 0;
		max-width: 100%;
		width: 100%;
		box-sizing: border-box;
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
	.edit-daohang-card-deleted {
		opacity: 0.6;
		border-style: dashed;
		border-color: rgba(239, 68, 68, 0.3);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 20px;
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
	.card-featured-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 500;
		margin-bottom: 12px;
		margin-left: 6px;
		background: rgba(245, 158, 11, 0.12);
		color: #f59e0b;
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
	.card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 8px;
	}
	.card-tag {
		padding: 1px 6px;
		font-size: 10px;
		border-radius: 4px;
		background: var(--btn-regular-bg, #f3f4f6);
		color: var(--text-secondary, #6b7280);
	}
	:global(.dark) .card-tag {
		background: rgba(255, 255, 255, 0.08);
		color: #9ca3af;
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
	.form-group-checkbox { margin-bottom: 16px; display: flex; gap: 16px; }
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

	.deleted-info {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #ef4444;
	}
	.restore-btn {
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
	.restore-btn:hover {
		background: #22c55e;
		color: white;
	}

	.empty-state {
		grid-column: 1 / -1; text-align: center; padding: 48px 20px;
		color: var(--content-meta, #9ca3af); font-size: 14px;
	}
</style>
