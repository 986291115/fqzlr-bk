<script lang="ts">
import { onMount } from "svelte";
import {
	hasValidToken,
	showToast,
	ensureIconify,
	getRepoFile,
	genId,
	deepClone,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";

interface PlaceItem {
	id: string;
	date: string;
	province: string;
	city?: string;
	district?: string;
	experience?: string;
	visitCount: number;
	location?: string;
	lat?: number;
	lng?: number;
	enabled?: boolean;
	url?: string;
	urlLabel?: string;
	photos?: string[];
	tags?: string[];
	_draft?: boolean;
	_deleted?: boolean;
}

let editMode = $state(false);
let saving = $state(false);
let places = $state<PlaceItem[]>([]);
let originalPlaces = $state<PlaceItem[]>([]);
let editingIndex = $state(-1);
let repoLoaded = $state(false);
let fileSha = $state<string | null>(null);
let originalTS = $state<string>("");

const pageKey = "places";
const pageName = "旅行足迹";

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

function parsePlacesFromTS(tsContent: string): PlaceItem[] {
	const items = parseArrayFromTS(tsContent, "export const placesConfig: PlaceItem[] = [");
	return items.map((item: any, index: number) => ({
		id: item.id || `place-${index}`,
		date: item.date || new Date().toISOString().slice(0, 10),
		province: item.province || "",
		city: item.city || "",
		district: item.district || "",
		experience: item.experience || "",
		visitCount: item.visitCount || 1,
		location: item.location || "",
		lat: item.lat,
		lng: item.lng,
		enabled: item.enabled !== false,
		url: item.url || "",
		urlLabel: item.urlLabel || "",
		photos: item.photos || [],
		tags: item.tags || [],
	}));
}

function buildPlaceObject(p: PlaceItem): string {
	const obj: any = {
		id: p.id,
		date: p.date,
		province: p.province,
	};
	if (p.city) obj.city = p.city;
	if (p.district) obj.district = p.district;
	if (p.experience) obj.experience = p.experience;
	obj.visitCount = p.visitCount;
	if (p.location) obj.location = p.location;
	if (p.lat !== undefined) obj.lat = p.lat;
	if (p.lng !== undefined) obj.lng = p.lng;
	if (p.url) obj.url = p.url;
	if (p.urlLabel) obj.urlLabel = p.urlLabel;
	if (p.photos && p.photos.length > 0) obj.photos = p.photos;
	if (p.tags && p.tags.length > 0) obj.tags = p.tags;
	obj.enabled = p.enabled !== false;

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

function buildPlacesConfigTS(
	placesList: PlaceItem[],
	originalContent?: string,
): string {
	const placeEntries = placesList.map((p) => buildPlaceObject(p));
	const placesArrayContent = placeEntries.join("\n");

	if (originalContent) {
		let result = originalContent;
		result = replaceArrayInTS(
			result,
			"export const placesConfig: PlaceItem[] = [",
			placesArrayContent,
		);
		return result;
	}

	return `/**
 * 足迹/旅行地点配置
 * 用于管理足迹地图与旅行记录
 */

export interface PlaceItem {
	id: string;
	date: string;
	province: string;
	city?: string;
	district?: string;
	experience?: string;
	visitCount: number;
	location?: string;
	lat?: number;
	lng?: number;
	enabled?: boolean;
}

export interface PlacesPageConfig {
	title?: string;
	description?: string;
}

export const placesPageConfig: PlacesPageConfig = {
	title: "去过的地方",
	description: "足迹地图与旅行记录",
};

export const placesConfig: PlaceItem[] = [
${placesArrayContent}
];

export function getAllPlaces(): PlaceItem[] {
	return [...placesConfig].sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);
}

export function getEnabledPlaces(): PlaceItem[] {
	const enabled = placesConfig.filter((p) => p.enabled !== false);
	return enabled.sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);
}

export function getTotalVisitCount(places: PlaceItem[]): number {
	return places.reduce((acc, p) => acc + (p.visitCount || 1), 0);
}

export function getThisYearVisitCount(places: PlaceItem[]): number {
	const currentYear = new Date().getFullYear();
	return places.filter((p) => {
		const d = new Date(p.date);
		return !Number.isNaN(d.getTime()) && d.getFullYear() === currentYear;
	}).length;
}
`;
}

const drafts = setupRepoDrafts({
	pageKey,
	pageName,
	getContent: () =>
		buildPlacesConfigTS(
			places.filter((m) => !m._deleted),
			originalTS,
		),
	setContent: (v) => {
		const parsed = parsePlacesFromTS(v);
		if (parsed.length > 0 || v.includes("placesConfig")) {
			places = parsed;
		}
	},
	getPath: () => "src/config/placesConfig.ts",
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => originalTS,
	setOriginalContent: (v) => (originalTS = v),
	getCommitMsg: (isEdit) =>
		isEdit ? `chore(places): 更新旅行足迹` : `chore(places): 创建足迹配置`,
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
	const result: PlaceItem[] = [];
	document.querySelectorAll(".place-card").forEach((card) => {
		const nameEl = card.querySelector(".place-name");
		const nameText = nameEl?.textContent?.trim() || "";
		const parts = nameText.split("·").map((s) => s.trim());
		const province = parts[0] || "";
		const city = parts[1] || "";
		const expEl = card.querySelector(".place-exp");
		const experience = expEl?.textContent?.trim() || "";
		const metaDiv = card.querySelector(".text-right");
		const countText =
			metaDiv?.querySelector(".font-semibold")?.textContent?.trim() || "1";
		const visitCount = parseInt(countText.replace(/[^\d]/g, "")) || 1;
		const dateText =
			metaDiv?.querySelector("div:last-child")?.textContent?.trim() || "";
		const date = dateText || new Date().toISOString().slice(0, 10);
		result.push({
			id: genId("pl"),
			province,
			city,
			district: "",
			experience,
			visitCount,
			date,
			enabled: true,
		});
	});
	places = result;
	originalPlaces = deepClone(result);
}

async function loadRepoData() {
	const existing = await getRepoFile("src/config/placesConfig.ts");
	if (existing && existing.content) {
		try {
			const repoPlaces: PlaceItem[] = parsePlacesFromTS(existing.content);
			originalTS = existing.content;
			fileSha = existing.sha || null;

			const repoMap = new Map(repoPlaces.map((m) => [m.id, m]));
			places = places.map((m) => {
				const repoItem = repoMap.get(m.id);
				if (repoItem) {
					return {
						...m,
						enabled: repoItem.enabled ?? m.enabled,
						location: repoItem.location ?? m.location,
						lat: repoItem.lat ?? m.lat,
						lng: repoItem.lng ?? m.lng,
					};
				}
				return m;
			});

			const existingIds = new Set(places.map((m) => m.id));
			for (const g of repoPlaces) {
				if (!existingIds.has(g.id)) {
					places = [...places, { ...g, id: g.id || genId("pl") }];
					existingIds.add(g.id);
				}
			}

			originalPlaces = deepClone(places);
		} catch (e) {
			console.error("Failed to parse repo places:", e);
		}
	} else {
		originalTS = buildPlacesConfigTS(places);
	}
	repoLoaded = true;
	drafts.restoreFromDrafts();
}

function hideSSRContent() {
	const mapSection = document.getElementById("life-map")?.closest("div.mb-6");
	const statsRow = document.querySelector(".stat-pill")?.parentElement;
	const listSection = document.querySelector(".places-grid")?.parentElement;
	const headings = document.querySelectorAll("h2.text-lg");
	if (mapSection) (mapSection as HTMLElement).style.display = "none";
	if (statsRow) (statsRow as HTMLElement).style.display = "none";
	headings.forEach((h) => {
		if (
			h.textContent?.includes("足迹地图") ||
			h.textContent?.includes("地点列表")
		)
			(h as HTMLElement).style.display = "none";
	});
}

function showSSRContent() {
	const mapSection = document.getElementById("life-map")?.closest("div.mb-6");
	const statsRow = document.querySelector(".stat-pill")?.parentElement;
	const headings = document.querySelectorAll("h2.text-lg");
	if (mapSection) (mapSection as HTMLElement).style.display = "";
	if (statsRow) (statsRow as HTMLElement).style.display = "";
	headings.forEach((h) => {
		(h as HTMLElement).style.display = "";
	});
}

function handleCancel() {
	editMode = false;
	places = deepClone(originalPlaces);
	editingIndex = -1;
	drafts.clearDrafts();
	showSSRContent();
}

function startEdit(index: number) {
	editingIndex = index;
}

function updateField(
	index: number,
	field: keyof PlaceItem,
	value: string | number,
) {
	places[index] = { ...places[index], [field]: value };
	places = [...places];
}

function finishEdit(index: number) {
	const p = places[index];
	if (!p.province.trim()) {
		showToast("省份不能为空", "warning");
		return;
	}
	editingIndex = -1;
	showToast("已修改，记得点击保存", "info");
}

function cancelItemEdit(index: number) {
	const p = places[index];
	if (p._draft && !p.province.trim()) {
		places = places.filter((_, i) => i !== index);
	} else {
		const orig = originalPlaces.find((o) => o.id === p.id && !p._draft);
		if (orig) {
			places[index] = deepClone(orig);
			places = [...places];
		}
	}
	editingIndex = -1;
}

function deleteItem(index: number) {
	const p = places[index];
	if (
		!confirm(`确定要删除「${p.province}${p.city ? " · " + p.city : ""}」吗？`)
	)
		return;
	if (p._draft) {
		places = places.filter((_, i) => i !== index);
	} else {
		places[index] = { ...places[index], _deleted: true };
		places = [...places];
	}
	if (editingIndex === index) editingIndex = -1;
	else if (editingIndex > index) editingIndex--;
	showToast("已标记删除，记得点击保存", "info");
}

function moveUp(index: number) {
	if (index <= 0) return;
	const arr = [...places];
	[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
	places = arr;
	if (editingIndex === index) editingIndex = index - 1;
	else if (editingIndex === index - 1) editingIndex = index;
}

function moveDown(index: number) {
	if (index >= places.length - 1) return;
	const arr = [...places];
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
	places = arr;
	if (editingIndex === index) editingIndex = index + 1;
	else if (editingIndex === index + 1) editingIndex = index;
}

function restoreItem(index: number) {
	places[index] = { ...places[index], _deleted: false };
	places = [...places];
}

function handleAdd() {
	places = [
		{
			id: genId("pl"),
			province: "",
			city: "",
			district: "",
			experience: "",
			visitCount: 1,
			date: new Date().toISOString().slice(0, 10),
			location: "",
			enabled: true,
			url: "",
			urlLabel: "",
			photos: [],
			tags: [],
			_draft: true,
		},
		...places,
	];
	editingIndex = 0;
}

function addTag(index: number, tag: string) {
	const trimmed = tag.trim();
	if (!trimmed) return;
	const currentTags = places[index].tags || [];
	if (currentTags.includes(trimmed)) return;
	places[index] = { ...places[index], tags: [...currentTags, trimmed] };
	places = [...places];
}

function removeTag(index: number, tagIndex: number) {
	const currentTags = places[index].tags || [];
	places[index] = { ...places[index], tags: currentTags.filter((_, i) => i !== tagIndex) };
	places = [...places];
}

function addPhoto(index: number, photoUrl: string) {
	const trimmed = photoUrl.trim();
	if (!trimmed) return;
	const currentPhotos = places[index].photos || [];
	places[index] = { ...places[index], photos: [...currentPhotos, trimmed] };
	places = [...places];
}

function removePhoto(index: number, photoIndex: number) {
	const currentPhotos = places[index].photos || [];
	places[index] = { ...places[index], photos: currentPhotos.filter((_, i) => i !== photoIndex) };
	places = [...places];
}

function handleSaveDraft() {
	const cleanData = places.map(({ _draft, _deleted, ...rest }) => ({
		...rest,
		id: rest.id || genId("pl"),
		enabled: rest.enabled !== false,
	}));
	places = cleanData;
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
		const cleanData = places.map(({ _draft, _deleted, ...rest }) => ({
			...rest,
			id: rest.id || genId("pl"),
			enabled: rest.enabled !== false,
		}));
		places = cleanData;
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
  <div class="pl-edit-list">
    {#each places as p, i (i + "-" + p.id)}
      {#if !p._deleted}
        <div
          class="pl-card"
          class:pl-card-draft={p._draft}
          class:pl-card-editing={editingIndex === i}
        >
          {#if editingIndex !== i}
            <div class="pl-card-actions">
              {#if i > 0}
                <button class="pl-action-btn pl-action-move" onclick={() => moveUp(i)} title="上移">
                  <iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
                </button>
              {/if}
              {#if i < places.filter(x => !x._deleted).length - 1}
                <button class="pl-action-btn pl-action-move" onclick={() => moveDown(i)} title="下移">
                  <iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon>
                </button>
              {/if}
              <button class="pl-action-btn pl-action-edit" onclick={() => startEdit(i)} title="编辑">
                <iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
              </button>
              <button class="pl-action-btn pl-action-delete" onclick={() => deleteItem(i)} title="删除">
                <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
              </button>
            </div>
            <div class="pl-card-display">
              <div class="pl-card-meta">
                <iconify-icon icon="material-symbols:location-on-rounded" style="color:#ef4444;"></iconify-icon>
                <span class="pl-card-name">{p.province || "未知省份"}{p.city ? ` · ${p.city}` : ""}</span>
                <span class="pl-card-count">到访 {p.visitCount} 次</span>
                <span class="pl-card-date">{p.date}</span>
                {#if p._draft}<span class="pl-badge-draft">新增</span>{/if}
              </div>
              {#if p.experience}<p class="pl-card-exp">{p.experience}</p>{/if}
            </div>
          {:else}
            <div class="pl-card-form">
              <div class="pl-form-header">
                <iconify-icon icon="material-symbols:edit-location-alt-rounded"></iconify-icon>
                <span>编辑地点</span>
                {#if p._draft}<span class="pl-badge-draft">新增</span>{/if}
              </div>
              <div class="pl-form-row">
                <div class="pl-form-group">
                  <label>省份 *</label>
                  <input
                    type="text"
                    class="pl-input"
                    value={p.province}
                    oninput={(e) => updateField(i, "province", (e.target as HTMLInputElement).value)}
                    placeholder="如：浙江"
                  />
                </div>
                <div class="pl-form-group">
                  <label>城市</label>
                  <input
                    type="text"
                    class="pl-input"
                    value={p.city || ""}
                    oninput={(e) => updateField(i, "city", (e.target as HTMLInputElement).value)}
                    placeholder="如：杭州"
                  />
                </div>
              </div>
              <div class="pl-form-row">
                <div class="pl-form-group">
                  <label>区/县</label>
                  <input
                    type="text"
                    class="pl-input"
                    value={p.district || ""}
                    oninput={(e) => updateField(i, "district", (e.target as HTMLInputElement).value)}
                    placeholder="如：西湖区"
                  />
                </div>
                <div class="pl-form-group">
                  <label>日期</label>
                  <input
                    type="date"
                    class="pl-input"
                    value={p.date}
                    oninput={(e) => updateField(i, "date", (e.target as HTMLInputElement).value)}
                  />
                </div>
                <div class="pl-form-group">
                  <label>到访次数</label>
                  <input
                    type="number"
                    class="pl-input"
                    min="1"
                    value={p.visitCount}
                    oninput={(e) => updateField(i, "visitCount", parseInt((e.target as HTMLInputElement).value) || 1)}
                  />
                </div>
              </div>
              <div class="pl-form-group">
                <label>体验/备注</label>
                <input
                  type="text"
                  class="pl-input"
                  value={p.experience || ""}
                  oninput={(e) => updateField(i, "experience", (e.target as HTMLInputElement).value)}
                  placeholder="旅行体验描述"
                />
              </div>
              <div class="pl-form-row">
                <div class="pl-form-group">
                  <label>位置名称</label>
                  <input
                    type="text"
                    class="pl-input"
                    value={p.location || ""}
                    oninput={(e) => updateField(i, "location", (e.target as HTMLInputElement).value)}
                    placeholder="具体位置"
                  />
                </div>
                <div class="pl-form-group">
                  <label>纬度</label>
                  <input
                    type="number"
                    step="any"
                    class="pl-input"
                    value={p.lat ?? ""}
                    oninput={(e) => {
                      const val = (e.target as HTMLInputElement).value;
                      updateField(i, "lat", val ? parseFloat(val) : undefined as any);
                    }}
                    placeholder="如：30.2741"
                  />
                </div>
                <div class="pl-form-group">
                  <label>经度</label>
                  <input
                    type="number"
                    step="any"
                    class="pl-input"
                    value={p.lng ?? ""}
                    oninput={(e) => {
                      const val = (e.target as HTMLInputElement).value;
                      updateField(i, "lng", val ? parseFloat(val) : undefined as any);
                    }}
                    placeholder="如：120.1551"
                  />
                </div>
              </div>
              <div class="pl-form-row">
                <div class="pl-form-group">
                  <label>链接文字</label>
                  <input
                    type="text"
                    class="pl-input"
                    value={p.urlLabel || ""}
                    oninput={(e) => updateField(i, "urlLabel", (e.target as HTMLInputElement).value)}
                    placeholder="如：游记"
                  />
                </div>
                <div class="pl-form-group" style="grid-column: span 2;">
                  <label>链接 URL</label>
                  <input
                    type="text"
                    class="pl-input"
                    value={p.url || ""}
                    oninput={(e) => updateField(i, "url", (e.target as HTMLInputElement).value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div class="pl-form-group">
                <label>标签</label>
                <p class="pl-form-hint">输入标签后按 Enter 添加</p>
                <div class="pl-tags-input" id="pl-tags-{i}">
                  {#if p.tags && p.tags.length > 0}
                    {#each p.tags as tag, tagIndex (tag + tagIndex)}
                      <span class="pl-tag-chip">
                        {tag}
                        <button type="button" class="pl-tag-remove" onclick={() => removeTag(i, tagIndex)}>×</button>
                      </span>
                    {/each}
                  {/if}
                  <input
                    type="text"
                    class="pl-tag-input"
                    placeholder="输入标签..."
                    onkeydown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        addTag(i, input.value);
                        input.value = '';
                      }
                    }}
                  />
                </div>
              </div>
              <div class="pl-form-group">
                <label>照片</label>
                <div class="pl-photos-list">
                  {#if p.photos && p.photos.length > 0}
                    {#each p.photos as photo, photoIndex (photo + photoIndex)}
                      <div class="pl-photo-item">
                        <img src={photo} alt="" class="pl-photo-thumb" />
                        <button type="button" class="pl-photo-remove" onclick={() => removePhoto(i, photoIndex)}>×</button>
                      </div>
                    {/each}
                  {/if}
                </div>
                <div class="pl-photo-input-row">
                  <input
                    type="text"
                    class="pl-input pl-photo-input"
                    placeholder="输入照片 URL..."
                    id="pl-photo-input-{i}"
                    onkeydown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        addPhoto(i, input.value);
                        input.value = '';
                      }
                    }}
                  />
                  <button
                    type="button"
                    class="pl-btn pl-btn-add-photo"
                    onclick={() => {
                      const input = document.getElementById('pl-photo-input-' + i) as HTMLInputElement;
                      if (input) {
                        addPhoto(i, input.value);
                        input.value = '';
                      }
                    }}
                  >添加</button>
                </div>
              </div>
              <div class="pl-form-actions">
                <button class="pl-btn pl-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
                <button class="pl-btn pl-btn-save" onclick={() => finishEdit(i)}>完成</button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="pl-card pl-card-deleted">
          <div class="pl-deleted-info">
            <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
            <span>{p.province}{p.city ? ` · ${p.city}` : ""} 已标记删除</span>
          </div>
          <button class="pl-btn pl-btn-restore" onclick={() => restoreItem(i)}>撤销删除</button>
        </div>
      {/if}
    {/each}
    {#if places.filter(p => !p._deleted).length === 0}
      <div class="pl-empty">
        <iconify-icon icon="material-symbols:explore-off-rounded" style="font-size:48px;opacity:0.3;"></iconify-icon>
        <p>暂无地点记录，点击"添加"创建</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .pl-edit-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pl-card {
    position: relative;
    border-radius: 16px;
    background: var(--card-bg, white);
    border: 2px solid #000;
    overflow: hidden;
    transition: all 0.2s;
  }
  :global(.dark) .pl-card {
    background: rgba(23, 23, 23, 0.8);
    border-color: #3f3f46;
  }
  .pl-card:hover {
    border-color: var(--primary);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }
  .pl-card-draft {
    border-style: dashed;
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
  }
  .pl-card-editing {
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
    box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }
  .pl-card-deleted {
    opacity: 0.6;
    border-style: dashed;
    border-color: rgba(239, 68, 68, 0.3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
  }

  .pl-card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .pl-card:hover .pl-card-actions {
    opacity: 1;
  }
  .pl-action-btn {
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
  .pl-action-btn iconify-icon {
    display: flex;
  }
  .pl-action-btn:hover {
    transform: scale(1.1);
  }
  .pl-action-move:hover {
    background: rgba(71, 85, 105, 1);
  }
  .pl-action-edit {
    background: rgba(59, 130, 246, 0.9) !important;
  }
  .pl-action-edit:hover {
    background: rgba(37, 99, 235, 1) !important;
  }
  .pl-action-delete {
    background: rgba(239, 68, 68, 0.9) !important;
  }
  .pl-action-delete:hover {
    background: rgba(220, 38, 38, 1) !important;
  }

  .pl-card-display {
    padding: 14px 20px;
  }
  .pl-card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pl-card-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--deep-text);
  }
  .pl-card-count {
    font-size: 12px;
    font-weight: 600;
    color: var(--primary);
  }
  .pl-card-date {
    font-size: 12px;
    color: var(--content-meta);
    margin-left: auto;
    padding-right: 80px;
  }
  .pl-badge-draft {
    padding: 1px 8px;
    border-radius: 999px;
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
    font-size: 11px;
    font-weight: 600;
  }
  .pl-card-exp {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--content-meta);
    line-height: 1.5;
    padding-right: 80px;
  }
  .pl-deleted-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #ef4444;
  }

  .pl-card-form {
    padding: 20px;
  }
  .pl-form-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--theme-hue, 165), 70%, 45%);
  }
  .pl-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }
  .pl-form-group {
    margin-bottom: 10px;
  }
  .pl-form-group label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #4b5563);
    margin-bottom: 4px;
  }
  :global(.dark) .pl-form-group label {
    color: #d1d5db;
  }
  .pl-input {
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
  :global(.dark) .pl-input {
    background: #0f0f1a;
    border-color: #374151;
    color: #e5e7eb;
  }
  .pl-input:focus {
    border-color: hsl(var(--theme-hue, 165), 70%, 50%);
    box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }
  .pl-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .pl-btn {
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
  .pl-btn-cancel {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-color, #374151);
  }
  .pl-btn-cancel:hover {
    background: var(--border, #e5e7eb);
  }
  :global(.dark) .pl-btn-cancel {
    background: #2d2d44;
    color: #d1d5db;
  }
  .pl-btn-save {
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
  }
  .pl-btn-save:hover {
    background: hsl(var(--theme-hue, 165), 75%, 45%);
  }
  .pl-btn-restore {
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
  .pl-btn-restore:hover {
    background: #22c55e;
    color: white;
  }
  .pl-empty {
    text-align: center;
    padding: 48px 20px;
    color: var(--content-meta, #9ca3af);
    font-size: 14px;
    border-radius: 16px;
    border: 2px dashed var(--border, rgba(0, 0, 0, 0.1));
  }

  .pl-form-hint {
    margin: 0 0 4px;
    font-size: 11px;
    color: var(--content-meta, #9ca3af);
  }

  .pl-tags-input {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 10px;
    border: 1.5px solid var(--border, #d1d5db);
    border-radius: 8px;
    min-height: 36px;
    align-items: center;
    background: var(--bg-color, white);
    transition: border-color 0.2s;
  }
  :global(.dark) .pl-tags-input {
    background: #0f0f1a;
    border-color: #374151;
  }
  .pl-tags-input:focus-within {
    border-color: hsl(var(--theme-hue, 165), 70%, 50%);
    box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }

  .pl-tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 999px;
    background: var(--btn-plain-bg-active, hsl(var(--theme-hue, 165), 70%, 92%));
    color: var(--primary, hsl(var(--theme-hue, 165), 70%, 45%));
  }

  .pl-tag-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.1);
    color: inherit;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }
  .pl-tag-remove:hover {
    background: rgba(0, 0, 0, 0.2);
  }

  .pl-tag-input {
    flex: 1;
    min-width: 80px;
    border: none;
    background: transparent;
    outline: none;
    font-size: 13px;
    padding: 2px 0;
    color: var(--text-color, #1f2937);
    font-family: inherit;
  }
  :global(.dark) .pl-tag-input {
    color: #e5e7eb;
  }

  .pl-photos-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }

  .pl-photo-item {
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 8px;
    overflow: hidden;
    border: 1.5px solid var(--border, #d1d5db);
  }

  .pl-photo-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .pl-photo-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.9);
    color: white;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pl-photo-remove:hover {
    background: rgba(220, 38, 38, 1);
  }

  .pl-photo-input-row {
    display: flex;
    gap: 6px;
  }

  .pl-photo-input {
    flex: 1;
  }

  .pl-btn-add-photo {
    flex: none;
    padding: 0 14px;
    font-size: 12px;
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-color, #374151);
  }
  .pl-btn-add-photo:hover {
    background: var(--border, #e5e7eb);
  }
  :global(.dark) .pl-btn-add-photo {
    background: #2d2d44;
    color: #d1d5db;
  }

  @media (max-width: 640px) {
    .pl-form-row {
      grid-template-columns: 1fr;
    }
    .pl-card-date,
    .pl-card-exp {
      padding-right: 0;
    }
  }
</style>
