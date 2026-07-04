<script lang="ts">
import { onMount } from "svelte";
import EditToolbar from "./EditToolbar.svelte";
import {
	getRepoFile,
	showToast,
	deepClone,
	ensureIconify,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";
import { repoConfig } from "@/config/editConfig";
import { siteConfig } from "@/config/siteConfig";
import { sidebarLayoutConfig } from "@/config/sidebarConfig";
import { profileConfig } from "@/config/profileConfig";
import { backgroundWallpaper } from "@/config/backgroundWallpaper";
import { sakuraConfig } from "@/config/sakuraConfig";
import { relationshipConfig } from "@/config/relationshipConfig";
import { announcementConfig } from "@/config/announcementConfig";

type FullConfig = Record<string, any>;

type ConfigTab = {
	key: string;
	label: string;
	icon: string;
	path: string;
	pageName: string;
};

const tabs: ConfigTab[] = [
	{ key: "site", label: "站点配置", icon: "material-symbols:settings", path: "src/config/siteConfig.ts", pageName: "站点配置" },
	{ key: "sidebar", label: "侧边栏", icon: "material-symbols:view-sidebar-outline", path: "src/config/sidebarConfig.ts", pageName: "侧边栏配置" },
	{ key: "profile", label: "用户资料", icon: "material-symbols:person", path: "src/config/profileConfig.ts", pageName: "用户资料配置" },
	{ key: "background", label: "背景壁纸", icon: "material-symbols:wallpaper", path: "src/config/backgroundWallpaper.ts", pageName: "背景壁纸配置" },
	{ key: "sakura", label: "樱花特效", icon: "material-symbols:local-florist", path: "src/config/sakuraConfig.ts", pageName: "樱花特效配置" },
	{ key: "relationship", label: "恋爱计时", icon: "material-symbols:favorite", path: "src/config/relationshipConfig.ts", pageName: "恋爱计时配置" },
	{ key: "announcement", label: "公告", icon: "material-symbols:campaign", path: "src/config/announcementConfig.ts", pageName: "公告配置" },
];

let activeTab = $state("site");

let editMode = $state(true);
let codeMode = $state(false);
let saving = $state(false);

let configStates = $state<Record<string, {
	config: FullConfig;
	originalConfig: FullConfig;
	codeContent: string;
	originalCodeContent: string;
	fileSha: string | null;
	drafts: ReturnType<typeof setupRepoDrafts>;
}>>({});

function getCurrentTab(): ConfigTab {
	return tabs.find(t => t.key === activeTab) || tabs[0];
}

function getState() {
	return configStates[activeTab];
}

let hasChanges = $derived(getState()?.drafts?.hasLocalChanges?.() ?? false);

function initTabState(key: string, tab: ConfigTab, initialConfig: FullConfig) {
	if (configStates[key]) return;

	const state = {
		config: deepClone(initialConfig),
		originalConfig: deepClone(initialConfig),
		codeContent: "",
		originalCodeContent: "",
		fileSha: null,
		drafts: null as any,
	};

	state.drafts = setupRepoDrafts({
		pageKey: `config-${key}`,
		pageName: tab.pageName,
		getContent: () => (codeMode ? state.codeContent : generateCode(key, state.config)),
		setContent: (v: string) => {
			state.codeContent = v;
			codeMode = true;
		},
		getPath: () => tab.path,
		getSha: () => state.fileSha,
		setSha: (v: string | null) => (state.fileSha = v),
		getOriginalContent: () => state.originalCodeContent,
		setOriginalContent: (v: string) => {
			state.originalCodeContent = v;
			state.originalConfig = deepClone(state.config);
		},
		getCommitMsg: (isEdit: boolean) =>
			isEdit ? `chore: 更新${tab.pageName}` : `chore: 创建${tab.pageName}`,
		onSubmitted: () => {
			setTimeout(() => window.location.reload(), 1500);
		},
	});

	configStates = { ...configStates, [key]: state as any };
}

const langOptions = [
	{ value: "zh_CN", label: "简体中文 (zh_CN)" },
	{ value: "zh_TW", label: "繁體中文 (zh_TW)" },
	{ value: "en", label: "English (en)" },
	{ value: "ja", label: "日本語 (ja)" },
	{ value: "ru", label: "Русский (ru)" },
];

const calloutThemes = [
	{ value: "github", label: "GitHub 风格" },
	{ value: "obsidian", label: "Obsidian 风格" },
	{ value: "vitepress", label: "VitePress 风格" },
];

const pageLabels: Record<string, string> = {
	sponsor: "赞助页面",
	guestbook: "留言板",
	bangumi: "番剧页面",
	books: "书架页面",
	moviesGames: "影视游戏",
	musicPage: "音乐页面",
	changelog: "更新日志",
};

onMount(() => {
	ensureIconify();
	loadAllConfigs();
});

function loadAllConfigs() {
	try {
		const w = window as any;

		initTabState("site", tabs[0], w.__SITE_CONFIG__ || siteConfig);
		initTabState("sidebar", tabs[1], w.__SIDEBAR_CONFIG__ || sidebarLayoutConfig);
		initTabState("profile", tabs[2], w.__PROFILE_CONFIG__ || profileConfig);
		initTabState("background", tabs[3], w.__BACKGROUND_CONFIG__ || backgroundWallpaper);
		initTabState("sakura", tabs[4], w.__SAKURA_CONFIG__ || sakuraConfig);
		initTabState("relationship", tabs[5], w.__RELATIONSHIP_CONFIG__ || relationshipConfig);
		initTabState("announcement", tabs[6], w.__ANNOUNCEMENT_CONFIG__ || announcementConfig);

		for (const key of Object.keys(configStates)) {
			const s = configStates[key];
			s.originalCodeContent = generateCode(key, s.config);
		}

		initAllRepoStates();
	} catch (e) {
		console.error("Failed to load configs:", e);
	}
}

async function initAllRepoStates() {
	for (const tab of tabs) {
		try {
			const existing = await getRepoFile(tab.path, repoConfig);
			if (existing && configStates[tab.key]) {
				configStates[tab.key].fileSha = existing.sha;
			}
		} catch {}
	}
	for (const key of Object.keys(configStates)) {
		configStates[key].drafts.restoreFromDrafts();
	}
}

function handleModeChange(e: CustomEvent) {
	editMode = e.detail.editing;
	if (editMode) {
	} else {
		codeMode = false;
	}
}

function handleCancel() {
	const s = getState();
	s.config = deepClone(s.originalConfig);
	codeMode = false;
	s.drafts.clearDrafts();
	showToast("已取消编辑", "info");
}

function handleSaveDraft() {
	getState().drafts.saveToDrafts();
}

async function handleSubmit() {
	saving = true;
	try {
		await getState().drafts.submitDrafts();
	} finally {
		saving = false;
	}
}

function setConfig(path: string[], value: any) {
	const s = getState();
	let obj: any = s.config;
	for (let i = 0; i < path.length - 1; i++) {
		if (!obj[path[i]]) obj[path[i]] = {};
		obj = obj[path[i]];
	}
	obj[path[path.length - 1]] = value;
	s.config = { ...s.config };
}

function updateKeywords(value: string) {
	const s = getState();
	s.config.keywords = value
		.split(/[,，]/)
		.map((s2: string) => s2.trim())
		.filter(Boolean);
	s.config = { ...s.config };
}

function getKeywordsString(): string {
	const s = getState();
	return (s.config.keywords || []).join(", ");
}

function updatePageField(key: string, value: boolean) {
	const s = getState();
	s.config.pages = { ...s.config.pages, [key]: value };
}

function generateCode(key: string, config: any): string {
	const names: Record<string, string> = {
		site: "siteConfig",
		sidebar: "sidebarConfig",
		profile: "profileConfig",
		background: "backgroundWallpaper",
		sakura: "sakuraConfig",
		relationship: "relationshipConfig",
		announcement: "announcementConfig",
	};
	const name = names[key] || "config";
	const json = JSON.stringify(config, null, 2);
	return `// ${name} 配置文件
// 由可视化编辑器生成
const ${name} = ${json};

export default ${name};
`;
}

function toggleCodeMode() {
	const s = getState();
	if (!codeMode) {
		s.codeContent = generateCode(activeTab, s.config);
	}
	codeMode = !codeMode;
}

const huePreviewColor = $derived(getState()?.config?.themeColor?.hue !== undefined
	? `hsl(${getState().config.themeColor.hue}, 70%, 50%)`
	: `hsl(230, 70%, 50%)`);
</script>


<div class="config-tabs">
	{#each tabs as tab (tab.key)}
		<button
			class="config-tab"
			class:config-tab-active={activeTab === tab.key}
			onclick={() => { activeTab = tab.key; codeMode = false; }}
		>
			<iconify-icon icon={tab.icon}></iconify-icon>
			<span>{tab.label}</span>
		</button>
	{/each}
</div>

<div class="config-edit-toolbar">
	<EditToolbar
		pageName={getCurrentTab().pageName}
		pageKey={`config-${activeTab}`}
		mountTo=".page-header-toolbar-slot"
		startInEditMode={true}
		persistentEdit={true}
		{saving}
		{hasChanges}
		showAddButton={false}
		on:modeChange={(e) => handleModeChange(e)}
		on:saveDraft={() => handleSaveDraft()}
		on:submit={() => handleSubmit()}
		on:cancel={() => handleCancel()}
	/>
</div>

{#if editMode && getState()}
			<button
				class="code-toggle-btn"
				class:code-toggle-btn-active={codeMode}
				onclick={toggleCodeMode}
				title={codeMode ? "切换到可视化编辑" : "切换到代码编辑"}
			>
				<iconify-icon icon={codeMode ? "material-symbols:visibility-rounded" : "material-symbols:code-rounded"} class="text-sm"></iconify-icon>
				{codeMode ? "可视化" : "代码"}
			</button>

			{#if codeMode}
				<div class="config-card">
					<div class="config-card-header">
						<iconify-icon icon="material-symbols:code-rounded" class="text-lg"></iconify-icon>
						<h3>TypeScript 代码编辑</h3>
					</div>
					<div class="code-editor-wrap">
						<textarea
							value={getState().codeContent}
							oninput={(e) => {
								const s = getState();
								s.codeContent = (e.target as HTMLTextAreaElement).value;
							}}
							class="code-textarea"
							spellcheck="false"
						></textarea>
					</div>
				</div>
			{:else if activeTab === 'site'}
		<div class="config-form">
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:info-outline-rounded" class="text-lg"></iconify-icon>
					<h3>基础信息</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>站点标题</label>
							<input
								type="text"
								value={getState().config.title || ""}
								oninput={(e) => setConfig(["title"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="站点标题"
							/>
						</div>
						<div class="form-group">
							<label>副标题</label>
							<input
								type="text"
								value={getState().config.subtitle || ""}
								oninput={(e) => setConfig(["subtitle"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="站点副标题"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>站点 URL</label>
							<input
								type="url"
								value={getState().config.site_url || ""}
								oninput={(e) => setConfig(["site_url"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="https://example.com/"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>站点描述</label>
							<textarea
								value={getState().config.description || ""}
								oninput={(e) => setConfig(["description"], (e.target as HTMLTextAreaElement).value)}
								class="form-textarea"
								rows={2}
								placeholder="用于 SEO meta description"
							></textarea>
						</div>
						<div class="form-group form-group-full">
							<label>关键词（逗号分隔）</label>
							<input
								type="text"
								value={getKeywordsString()}
								oninput={(e) => updateKeywords((e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="关键词1, 关键词2, 关键词3"
							/>
						</div>
						<div class="form-group">
							<label>语言</label>
							<select
								value={getState().config.lang || "zh_CN"}
								onchange={(e) => setConfig(["lang"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								{#each langOptions as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:format-color-text" class="text-lg"></iconify-icon>
					<h3>主题设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-group-full">
							<label>
								主题色 Hue:
								<span class="hue-value" style="color:{huePreviewColor}">{getState().config.themeColor?.hue ?? 230}</span>
							</label>
							<div class="hue-slider-wrap">
								<input
									type="range"
									min={0}
									max={360}
									value={getState().config.themeColor?.hue ?? 230}
									oninput={(e) => setConfig(["themeColor", "hue"], parseInt((e.target as HTMLInputElement).value))}
									class="hue-slider"
									style={`--hue-preview:${huePreviewColor}`}
								/>
								<div class="hue-preview-dot" style={`background:${huePreviewColor}`}></div>
							</div>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.themeColor?.fixed ?? false}
									onchange={(e) => setConfig(["themeColor", "fixed"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>固定主题色（隐藏选择器）</span>
							</label>
						</div>
						<div class="form-group">
							<label>默认模式</label>
							<select
								value={getState().config.themeColor?.defaultMode || "system"}
								onchange={(e) => setConfig(["themeColor", "defaultMode"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="light">浅色 (light)</option>
								<option value="dark">暗色 (dark)</option>
								<option value="system">跟随系统 (system)</option>
							</select>
						</div>
						<div class="form-group">
							<label>页面宽度 (rem)</label>
							<input
								type="number"
								min={60}
								max={200}
								value={getState().config.pageWidth ?? 100}
								oninput={(e) => setConfig(["pageWidth"], parseInt((e.target as HTMLInputElement).value) || 100)}
								class="form-input"
							/>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.card?.border !== false}
									onchange={(e) => setConfig(["card", "border"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>卡片边框和阴影</span>
							</label>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:navigation-rounded" class="text-lg"></iconify-icon>
					<h3>导航栏设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>Logo 类型</label>
							<select
								value={getState().config.navbar?.logo?.type || "icon"}
								onchange={(e) => setConfig(["navbar", "logo", "type"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="icon">图标 (icon)</option>
								<option value="image">本地图片 (image)</option>
								<option value="url">网络图片 (url)</option>
							</select>
						</div>
						<div class="form-group">
							<label>Logo 值</label>
							<input
								type="text"
								value={getState().config.navbar?.logo?.value || ""}
								oninput={(e) => setConfig(["navbar", "logo", "value"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder={getState().config.navbar?.logo?.type === "icon" ? "material-symbols:home" : "图片路径或URL"}
							/>
						</div>
						<div class="form-group">
							<label>导航标题</label>
							<input
								type="text"
								value={getState().config.navbar?.title || ""}
								oninput={(e) => setConfig(["navbar", "title"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="留空则使用站点标题"
							/>
						</div>
						<div class="form-group">
							<label>悬停颜文字</label>
							<input
								type="text"
								value={getState().config.navbar?.hoverTitle || ""}
								oninput={(e) => setConfig(["navbar", "hoverTitle"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="鼠标悬停时显示的文字"
							/>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.navbar?.widthFull ?? false}
									onchange={(e) => setConfig(["navbar", "widthFull"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>全宽导航栏</span>
							</label>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.navbar?.followTheme ?? false}
									onchange={(e) => setConfig(["navbar", "followTheme"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>图标标题跟随主题色</span>
							</label>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:home-outline-rounded" class="text-lg"></iconify-icon>
					<h3>门户区设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.portal?.announcement?.enable ?? false}
									onchange={(e) => setConfig(["portal", "announcement", "enable"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>启用公告</span>
							</label>
						</div>
						<div class="form-group form-group-full">
							<label>公告内容</label>
							<textarea
								value={getState().config.portal?.announcement?.text || ""}
								oninput={(e) => setConfig(["portal", "announcement", "text"], (e.target as HTMLTextAreaElement).value)}
								class="form-textarea"
								rows={2}
								placeholder="公告内容"
							></textarea>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.portal?.dailyQuote?.enable ?? false}
									onchange={(e) => setConfig(["portal", "dailyQuote", "enable"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>启用每日一言</span>
							</label>
						</div>
						<div class="form-group">
							<label>最近文章数</label>
							<input
								type="number"
								min={0}
								max={10}
								value={getState().config.portal?.recentPostsCount ?? 3}
								oninput={(e) => setConfig(["portal", "recentPostsCount"], parseInt((e.target as HTMLInputElement).value) || 0)}
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>最近说说数</label>
							<input
								type="number"
								min={0}
								max={10}
								value={getState().config.portal?.recentMomentsCount ?? 3}
								oninput={(e) => setConfig(["portal", "recentMomentsCount"], parseInt((e.target as HTMLInputElement).value) || 0)}
								class="form-input"
							/>
						</div>
						<div class="form-group form-group-full">
							<label class="config-hint">
								提示：每日一言的名言列表请在代码模式下编辑
							</label>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:history-toggle-off-rounded" class="text-lg"></iconify-icon>
					<h3>页面开关</h3>
				</div>
				<div class="config-card-body">
					<div class="pages-grid">
						{#each Object.entries(getState().config.pages || {}) as [key, val]}
							<label class="page-toggle-item" class:page-toggle-off={!val}>
								<input
									type="checkbox"
									checked={val}
									onchange={(e) => updatePageField(key, (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span class="page-toggle-label">{pageLabels[key] || key}</span>
								<span class="page-toggle-key">{key}</span>
							</label>
						{/each}
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:movie-outline-rounded" class="text-lg"></iconify-icon>
					<h3>番剧 & 豆瓣</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>Bangumi 用户 ID</label>
							<input
								type="text"
								value={getState().config.bangumi?.userId || ""}
								oninput={(e) => setConfig(["bangumi", "userId"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="Bangumi 用户 ID"
							/>
						</div>
						<div class="form-group">
							<label>豆瓣用户 ID</label>
							<input
								type="text"
								value={getState().config.douban?.userId || ""}
								oninput={(e) => setConfig(["douban", "userId"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="豆瓣用户 ID"
							/>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:map-outline-rounded" class="text-lg"></iconify-icon>
					<h3>地图配置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-group-full">
							<label>高德地图 API Key</label>
							<input
								type="text"
								value={getState().config.mapConfig?.amapKey || ""}
								oninput={(e) => setConfig(["mapConfig", "amapKey"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="高德地图 Web端 JS API Key"
							/>
						</div>
						<div class="form-group">
							<label>中心经度</label>
							<input
								type="number"
								step="0.001"
								value={getState().config.mapConfig?.center?.[0] ?? 104.195}
								oninput={(e) => {
									const lat = getState().config.mapConfig?.center?.[1] ?? 35.861;
									setConfig(["mapConfig", "center"], [parseFloat((e.target as HTMLInputElement).value) || 0, lat]);
								}}
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>中心纬度</label>
							<input
								type="number"
								step="0.001"
								value={getState().config.mapConfig?.center?.[1] ?? 35.861}
								oninput={(e) => {
									const lng = getState().config.mapConfig?.center?.[0] ?? 104.195;
									setConfig(["mapConfig", "center"], [lng, parseFloat((e.target as HTMLInputElement).value) || 0]);
								}}
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>缩放级别</label>
							<input
								type="number"
								min={1}
								max={18}
								value={getState().config.mapConfig?.zoom ?? 4}
								oninput={(e) => setConfig(["mapConfig", "zoom"], parseInt((e.target as HTMLInputElement).value) || 4)}
								class="form-input"
							/>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.mapConfig?.showMarkers !== false}
									onchange={(e) => setConfig(["mapConfig", "showMarkers"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>显示地图标记点</span>
							</label>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:list-alt-outline-rounded" class="text-lg"></iconify-icon>
					<h3>文章列表设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.categoryBar !== false}
									onchange={(e) => setConfig(["categoryBar"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>分类导航栏</span>
							</label>
						</div>
						<div class="form-group">
							<label>默认布局模式</label>
							<select
								value={getState().config.postListLayout?.defaultMode || "grid"}
								onchange={(e) => setConfig(["postListLayout", "defaultMode"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="list">列表模式 (list)</option>
								<option value="grid">网格模式 (grid)</option>
							</select>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.postListLayout?.allowSwitch !== false}
									onchange={(e) => setConfig(["postListLayout", "allowSwitch"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>允许切换布局</span>
							</label>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.postListLayout?.grid?.masonry ?? false}
									onchange={(e) => setConfig(["postListLayout", "grid", "masonry"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>瀑布流布局</span>
							</label>
						</div>
						<div class="form-group">
							<label>网格列数</label>
							<select
								value={getState().config.postListLayout?.grid?.columns ?? 3}
								onchange={(e) => setConfig(["postListLayout", "grid", "columns"], parseInt((e.target as HTMLSelectElement).value))}
								class="form-select"
							>
								<option value={2}>2 列</option>
								<option value={3}>3 列</option>
							</select>
						</div>
						<div class="form-group">
							<label>每页文章数</label>
							<input
								type="number"
								min={1}
								max={50}
								value={getState().config.pagination?.postsPerPage ?? 10}
								oninput={(e) => setConfig(["pagination", "postsPerPage"], parseInt((e.target as HTMLInputElement).value) || 10)}
								class="form-input"
							/>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:analytics-outline-rounded" class="text-lg"></iconify-icon>
					<h3>统计分析</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>Google Analytics ID</label>
							<input
								type="text"
								value={getState().config.analytics?.googleAnalyticsId || ""}
								oninput={(e) => setConfig(["analytics", "googleAnalyticsId"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="G-XXXXXXXXXX"
							/>
						</div>
						<div class="form-group">
							<label>Microsoft Clarity ID</label>
							<input
								type="text"
								value={getState().config.analytics?.microsoftClarityId || ""}
								oninput={(e) => setConfig(["analytics", "microsoftClarityId"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="Clarity ID"
							/>
						</div>
						<div class="form-group">
							<label>Umami Website ID</label>
							<input
								type="text"
								value={getState().config.analytics?.umamiAnalytics?.websiteId || ""}
								oninput={(e) => setConfig(["analytics", "umamiAnalytics", "websiteId"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="Umami 网站 ID"
							/>
						</div>
						<div class="form-group">
							<label>Umami Script URL</label>
							<input
								type="text"
								value={getState().config.analytics?.umamiAnalytics?.scriptUrl || ""}
								oninput={(e) => setConfig(["analytics", "umamiAnalytics", "scriptUrl"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="https://umami.example.com/script.js"
							/>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:settings-outline-rounded" class="text-lg"></iconify-icon>
					<h3>其他设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>站点开始日期</label>
							<input
								type="date"
								value={getState().config.siteStartDate || ""}
								oninput={(e) => setConfig(["siteStartDate"], (e.target as HTMLInputElement).value)}
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>时区</label>
							<input
								type="text"
								value={getState().config.timezone || ""}
								oninput={(e) => setConfig(["timezone"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="Asia/Shanghai"
							/>
						</div>
						<div class="form-group">
							<label>上班时间</label>
							<input
								type="number"
								min={0}
								max={23}
								value={getState().config.workHours?.start ?? 9}
								oninput={(e) => setConfig(["workHours", "start"], parseInt((e.target as HTMLInputElement).value) || 9)}
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>下班时间</label>
							<input
								type="number"
								min={0}
								max={23}
								value={getState().config.workHours?.end ?? 18}
								oninput={(e) => setConfig(["workHours", "end"], parseInt((e.target as HTMLInputElement).value) || 18)}
								class="form-input"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>Callout 主题</label>
							<select
								value={getState().config.rehypeCallouts?.theme || "github"}
								onchange={(e) => setConfig(["rehypeCallouts", "theme"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								{#each calloutThemes as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.showLastModified !== false}
									onchange={(e) => setConfig(["showLastModified"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>显示上次编辑时间</span>
							</label>
						</div>
						<div class="form-group">
							<label>文章过期阈值（天）</label>
							<input
								type="number"
								min={0}
								max={365}
								value={getState().config.outdatedThreshold ?? 30}
								oninput={(e) => setConfig(["outdatedThreshold"], parseInt((e.target as HTMLInputElement).value) || 30)}
								class="form-input"
							/>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.sharePoster !== false}
									onchange={(e) => setConfig(["sharePoster"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>分享海报生成</span>
							</label>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.generateOgImages ?? false}
									onchange={(e) => setConfig(["generateOgImages"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>OpenGraph 图片生成</span>
							</label>
						</div>
						<div class="form-group">
							<label>图片输出格式</label>
							<select
								value={getState().config.imageOptimization?.formats || "webp"}
								onchange={(e) => setConfig(["imageOptimization", "formats"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="webp">WebP</option>
								<option value="avif">AVIF</option>
								<option value="both">两者都有</option>
							</select>
						</div>
						<div class="form-group">
							<label>图片压缩质量</label>
							<input
								type="number"
								min={1}
								max={100}
								value={getState().config.imageOptimization?.quality ?? 85}
								oninput={(e) => setConfig(["imageOptimization", "quality"], parseInt((e.target as HTMLInputElement).value) || 85)}
								class="form-input"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	{:else if activeTab === 'sidebar'}
		<div class="config-form">
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:view-sidebar-outline" class="text-lg"></iconify-icon>
					<h3>侧边栏布局设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.enable ?? true}
									onchange={(e) => setConfig(["enable"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>启用侧边栏</span>
							</label>
						</div>
						<div class="form-group">
							<label>侧边栏位置</label>
							<select
								value={getState().config.position || "both"}
								onchange={(e) => setConfig(["position"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="left">仅左侧 (left)</option>
								<option value="right">仅右侧 (right)</option>
								<option value="both">双侧边栏 (both)</option>
							</select>
						</div>
						<div class="form-group">
							<label>平板端显示</label>
							<select
								value={getState().config.tabletSidebar || "left"}
								onchange={(e) => setConfig(["tabletSidebar"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="left">左侧栏 (left)</option>
								<option value="right">右侧栏 (right)</option>
							</select>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.showBothSidebarsOnPostPage ?? false}
									onchange={(e) => setConfig(["showBothSidebarsOnPostPage"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>文章详情页双栏</span>
							</label>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:view-sidebar-outline" class="text-lg"></iconify-icon>
					<h3>左侧边栏组件</h3>
				</div>
				<div class="config-card-body">
					<div class="pages-grid">
						{#each getState().config.leftComponents || [] as comp, idx}
							<label class="page-toggle-item" class:page-toggle-off={!comp.enable}>
								<input
									type="checkbox"
									checked={comp.enable ?? true}
									onchange={(e) => {
										const s = getState();
										const newComponents = [...s.config.leftComponents];
										newComponents[idx] = { ...comp, enable: (e.target as HTMLInputElement).checked };
										s.config.leftComponents = newComponents;
										s.config = { ...s.config };
									}}
									class="form-check"
								/>
								<span class="page-toggle-label">{comp.type}</span>
								<span class="page-toggle-key">{comp.position}</span>
							</label>
						{/each}
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:view-sidebar-outline" class="text-lg"></iconify-icon>
					<h3>右侧边栏组件</h3>
				</div>
				<div class="config-card-body">
					<div class="pages-grid">
						{#each getState().config.rightComponents || [] as comp, idx}
							<label class="page-toggle-item" class:page-toggle-off={!comp.enable}>
								<input
									type="checkbox"
									checked={comp.enable ?? true}
									onchange={(e) => {
										const s = getState();
										const newComponents = [...s.config.rightComponents];
										newComponents[idx] = { ...comp, enable: (e.target as HTMLInputElement).checked };
										s.config.rightComponents = newComponents;
										s.config = { ...s.config };
									}}
									class="form-check"
								/>
								<span class="page-toggle-label">{comp.type}</span>
								<span class="page-toggle-key">{comp.position}</span>
							</label>
						{/each}
					</div>
					<p class="config-hint mt-3">提示：更详细的组件配置请在代码模式下编辑</p>
				</div>
			</div>
		</div>
	{:else if activeTab === 'profile'}
		<div class="config-form">
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:person" class="text-lg"></iconify-icon>
					<h3>基本资料</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-group-full">
							<label>头像 URL</label>
							<input
								type="text"
								value={getState().config.avatar || ""}
								oninput={(e) => setConfig(["avatar"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="头像图片地址"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>下班头像 URL</label>
							<input
								type="text"
								value={getState().config.avatarOffWork || ""}
								oninput={(e) => setConfig(["avatarOffWork"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="下班时间显示的头像"
							/>
						</div>
						<div class="form-group">
							<label>名字</label>
							<input
								type="text"
								value={getState().config.name || ""}
								oninput={(e) => setConfig(["name"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="你的名字"
							/>
						</div>
						<div class="form-group">
							<label>显示名字</label>
							<input
								type="text"
								value={getState().config.displayName || ""}
								oninput={(e) => setConfig(["displayName"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="首页显示的名字"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>职业标签</label>
							<input
								type="text"
								value={getState().config.occupation || ""}
								oninput={(e) => setConfig(["occupation"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="[技术博主 / 生活记录者]"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>个性签名（每行一条，支持多条循环）</label>
							<textarea
								value={Array.isArray(getState().config.bio) ? getState().config.bio.join('\n') : ''}
								oninput={(e) => {
									const lines = (e.target as HTMLTextAreaElement).value.split('\n').filter(l => l.trim());
									setConfig(["bio"], lines);
								}}
								class="form-textarea"
								rows={3}
								placeholder="每行一条签名"
							></textarea>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:link" class="text-lg"></iconify-icon>
					<h3>社交链接</h3>
				</div>
				<div class="config-card-body">
					<p class="config-hint mb-3">提示：完整链接列表请在代码模式下编辑</p>
					<div class="form-grid">
						{#each (getState().config.links || []).slice(0, 5) as link, idx}
							<div class="form-group">
								<label>链接 {idx + 1} - 名称</label>
								<input
									type="text"
									value={link.name || ""}
									oninput={(e) => {
										const s = getState();
										const newLinks = [...s.config.links];
										newLinks[idx] = { ...link, name: (e.target as HTMLInputElement).value };
										s.config.links = newLinks;
										s.config = { ...s.config };
									}}
									class="form-input"
									placeholder="名称"
								/>
							</div>
							<div class="form-group">
								<label>图标</label>
								<input
									type="text"
									value={link.icon || ""}
									oninput={(e) => {
										const s = getState();
										const newLinks = [...s.config.links];
										newLinks[idx] = { ...link, icon: (e.target as HTMLInputElement).value };
										s.config.links = newLinks;
										s.config = { ...s.config };
									}}
									class="form-input"
									placeholder="material-symbols:xxx"
								/>
							</div>
							<div class="form-group form-group-full">
								<label>链接地址</label>
								<input
									type="text"
									value={link.url || ""}
									oninput={(e) => {
										const s = getState();
										const newLinks = [...s.config.links];
										newLinks[idx] = { ...link, url: (e.target as HTMLInputElement).value };
										s.config.links = newLinks;
										s.config = { ...s.config };
									}}
									class="form-input"
									placeholder="https://..."
								/>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{:else if activeTab === 'background'}
		<div class="config-form">
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:wallpaper" class="text-lg"></iconify-icon>
					<h3>壁纸模式设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>壁纸模式</label>
							<select
								value={getState().config.mode || "none"}
								onchange={(e) => setConfig(["mode"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="none">纯色背景 (none)</option>
								<option value="banner">横幅壁纸 (banner)</option>
								<option value="overlay">全屏透明 (overlay)</option>
							</select>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.switchable ?? false}
									onchange={(e) => setConfig(["switchable"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>允许切换壁纸模式</span>
							</label>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:image" class="text-lg"></iconify-icon>
					<h3>壁纸图片</h3>
				</div>
				<div class="config-card-body">
					<p class="config-hint mb-3">提示：仅支持单张图片URL编辑，多张图片请在代码模式下配置</p>
					<div class="form-grid">
						<div class="form-group form-group-full">
							<label>桌面壁纸 URL</label>
							<input
								type="text"
								value={Array.isArray(getState().config.src?.desktop) ? getState().config.src.desktop[0] : (getState().config.src?.desktop || "")}
								oninput={(e) => {
									const val = (e.target as HTMLInputElement).value;
									setConfig(["src", "desktop"], val ? [val] : []);
								}}
								class="form-input"
								placeholder="桌面壁纸图片地址"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>移动壁纸 URL</label>
							<input
								type="text"
								value={Array.isArray(getState().config.src?.mobile) ? getState().config.src.mobile[0] : (getState().config.src?.mobile || "")}
								oninput={(e) => {
									const val = (e.target as HTMLInputElement).value;
									setConfig(["src", "mobile"], val ? [val] : []);
								}}
								class="form-input"
								placeholder="移动端壁纸图片地址"
							/>
						</div>
					</div>
				</div>
			</div>

			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:format-color-text" class="text-lg"></iconify-icon>
					<h3>Banner 模式设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.banner?.homeText?.enable ?? true}
									onchange={(e) => setConfig(["banner", "homeText", "enable"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>显示主页横幅文字</span>
							</label>
						</div>
						<div class="form-group form-group-full">
							<label>横幅主标题</label>
							<input
								type="text"
								value={getState().config.banner?.homeText?.title || ""}
								oninput={(e) => setConfig(["banner", "homeText", "title"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="主页横幅主标题"
							/>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.banner?.homeText?.typewriter?.enable ?? true}
									onchange={(e) => setConfig(["banner", "homeText", "typewriter", "enable"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>打字机效果</span>
							</label>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.banner?.waves?.enable?.desktop ?? false}
									onchange={(e) => {
										const checked = (e.target as HTMLInputElement).checked;
										setConfig(["banner", "waves", "enable"], { desktop: checked, mobile: checked });
									}}
									class="form-check"
								/>
								<span>水波纹动画</span>
							</label>
						</div>
					</div>
					<p class="config-hint mt-3">提示：更多高级设置（副标题数组、透明度、模糊度等）请在代码模式下编辑</p>
				</div>
			</div>
		</div>
	{:else if activeTab === 'sakura'}
		<div class="config-form">
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:local-florist" class="text-lg"></iconify-icon>
					<h3>樱花特效设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.enable ?? false}
									onchange={(e) => setConfig(["enable"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>启用樱花特效</span>
							</label>
						</div>
						<div class="form-group">
							<label>樱花数量</label>
							<input
								type="number"
								min={1}
								max={100}
								value={getState().config.sakuraNum ?? 21}
								oninput={(e) => setConfig(["sakuraNum"], parseInt((e.target as HTMLInputElement).value) || 21)}
								class="form-input"
							/>
						</div>
					</div>
					<p class="config-hint mt-3">提示：更多高级设置（尺寸、速度、透明度等）请在代码模式下编辑</p>
				</div>
			</div>
		</div>
	{:else if activeTab === 'relationship'}
		<div class="config-form">
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:favorite" class="text-lg"></iconify-icon>
					<h3>恋爱计时设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-group-full">
							<label>恋爱开始日期</label>
							<input
								type="date"
								value={getState().config.startDate || ""}
								oninput={(e) => setConfig(["startDate"], (e.target as HTMLInputElement).value)}
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>一方名称</label>
							<input
								type="text"
								value={getState().config.name1 || ""}
								oninput={(e) => setConfig(["name1"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="名称1"
							/>
						</div>
						<div class="form-group">
							<label>另一方名称</label>
							<input
								type="text"
								value={getState().config.name2 || ""}
								oninput={(e) => setConfig(["name2"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="名称2"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>一方头像 URL</label>
							<input
								type="text"
								value={getState().config.avatar1 || ""}
								oninput={(e) => setConfig(["avatar1"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="头像1地址"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>另一方头像 URL</label>
							<input
								type="text"
								value={getState().config.avatar2 || ""}
								oninput={(e) => setConfig(["avatar2"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="头像2地址"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>小组件标题</label>
							<input
								type="text"
								value={getState().config.title || ""}
								oninput={(e) => setConfig(["title"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="我和宝宝在一起已经"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	{:else if activeTab === 'announcement'}
		<div class="config-form">
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:campaign" class="text-lg"></iconify-icon>
					<h3>公告设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-group-full">
							<label>公告标题</label>
							<input
								type="text"
								value={getState().config.title || ""}
								oninput={(e) => setConfig(["title"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="公告标题"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>公告内容</label>
							<textarea
								value={getState().config.content || ""}
								oninput={(e) => setConfig(["content"], (e.target as HTMLTextAreaElement).value)}
								class="form-textarea"
								rows={3}
								placeholder="公告内容"
							></textarea>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.closable ?? true}
									onchange={(e) => setConfig(["closable"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>允许关闭公告</span>
							</label>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getState().config.link?.enable ?? false}
									onchange={(e) => setConfig(["link", "enable"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>显示链接</span>
							</label>
						</div>
						<div class="form-group">
							<label>链接文本</label>
							<input
								type="text"
								value={getState().config.link?.text || ""}
								oninput={(e) => setConfig(["link", "text"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="了解更多"
							/>
						</div>
						<div class="form-group">
							<label>链接 URL</label>
							<input
								type="text"
								value={getState().config.link?.url || ""}
								oninput={(e) => setConfig(["link", "url"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="/about/"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	.config-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 12px;
		padding: 6px;
		background: var(--bg-secondary, rgba(0,0,0,0.03));
		border-radius: 12px;
	}
	:global(.dark) .config-tabs {
		background: rgba(255,255,255,0.04);
	}

	.config-tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		border: none;
		background: transparent;
		color: var(--text-secondary, #6b7280);
		white-space: nowrap;
	}
	.config-tab:hover {
		background: var(--btn-plain-bg-hover, rgba(0,0,0,0.06));
		color: var(--text-color, #1f2937);
	}
	:global(.dark) .config-tab:hover {
		background: rgba(255,255,255,0.08);
		color: #e5e7eb;
	}
	.config-tab-active {
		background: hsl(var(--theme-hue, 230), 70%, 50%) !important;
		color: white !important;
	}

	.config-edit-toolbar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.code-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 7px 14px;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		border: 1.5px solid var(--border, #e5e7eb);
		background: var(--card-bg, white);
		color: var(--text-secondary, #6b7280);
		white-space: nowrap;
	}
	.code-toggle-btn:hover {
		border-color: hsl(var(--theme-hue, 230), 60%, 50%);
		color: hsl(var(--theme-hue, 230), 70%, 45%);
	}
	.code-toggle-btn-active {
		border-color: hsl(var(--theme-hue, 230), 70%, 50%) !important;
		color: hsl(var(--theme-hue, 230), 70%, 45%) !important;
		background: color-mix(in srgb, hsl(var(--theme-hue, 230), 70%, 50%) 8%, transparent) !important;
	}
	:global(.dark) .code-toggle-btn {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.7);
	}
	:global(.dark) .code-toggle-btn:hover {
		border-color: hsl(var(--theme-hue, 230), 60%, 60%);
		color: hsl(var(--theme-hue, 230), 70%, 65%);
	}

	.config-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.config-card {
		border-radius: 16px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
		overflow: hidden;
		transition: border-color 0.2s;
	}
	:global(.dark) .config-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255, 255, 255, 0.08);
	}
	.config-card:hover {
		border-color: hsla(var(--theme-hue, 230), 70%, 50%, 0.2);
	}

	.config-card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 20px;
		border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
		color: hsl(var(--theme-hue, 230), 70%, 45%);
		font-weight: 600;
		font-size: 15px;
	}
	:global(.dark) .config-card-header {
		border-bottom-color: rgba(255, 255, 255, 0.06);
	}
	.config-card-header h3 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.config-card-body {
		padding: 18px 20px;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 14px;
	}
	.form-group-full {
		grid-column: 1 / -1;
	}

	.form-group label {
		display: block;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary, #4b5563);
		margin-bottom: 5px;
	}
	:global(.dark) .form-group label {
		color: #d1d5db;
	}

	.hue-value {
		font-weight: 700;
		margin-left: 6px;
		font-variant-numeric: tabular-nums;
	}

	.form-input,
	.form-textarea,
	.form-select {
		width: 100%;
		padding: 8px 12px;
		border: 1.5px solid var(--border, #d1d5db);
		border-radius: 8px;
		font-size: 13px;
		background: var(--bg-color, white);
		color: var(--text-color, #1f2937);
		outline: none;
		transition: border-color 0.2s, box-shadow 0.2s;
		box-sizing: border-box;
		font-family: inherit;
	}
	:global(.dark) .form-input,
	:global(.dark) .form-textarea,
	:global(.dark) .form-select {
		background: #0f0f1a;
		border-color: #374151;
		color: #e5e7eb;
	}
	.form-input:focus,
	.form-textarea:focus,
	.form-select:focus {
		border-color: hsl(var(--theme-hue, 230), 70%, 50%);
		box-shadow: 0 0 0 2px hsla(var(--theme-hue, 230), 70%, 50%, 0.1);
	}
	.form-textarea {
		resize: vertical;
		min-height: 50px;
	}

	.hue-slider-wrap {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.hue-slider {
		flex: 1;
		-webkit-appearance: none;
		appearance: none;
		height: 8px;
		border-radius: 4px;
		background: linear-gradient(
			to right,
			hsl(0, 70%, 50%),
			hsl(60, 70%, 50%),
			hsl(120, 70%, 50%),
			hsl(180, 70%, 50%),
			hsl(240, 70%, 50%),
			hsl(300, 70%, 50%),
			hsl(360, 70%, 50%)
		);
		outline: none;
		cursor: pointer;
	}
	.hue-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--hue-preview, hsl(230, 70%, 50%));
		border: 3px solid white;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		transition: transform 0.15s;
	}
	.hue-slider::-webkit-slider-thumb:hover {
		transform: scale(1.15);
	}
	.hue-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--hue-preview, hsl(230, 70%, 50%));
		border: 3px solid white;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
		cursor: pointer;
	}
	.hue-preview-dot {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		flex-shrink: 0;
		border: 2px solid var(--border, rgba(0,0,0,0.1));
		box-shadow: 0 2px 8px rgba(0,0,0,0.1);
	}
	:global(.dark) .hue-preview-dot {
		border-color: rgba(255,255,255,0.15);
	}

	.form-check-group {
		display: flex;
		align-items: center;
	}
	.form-check-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 13px;
		color: var(--text-color, #1f2937);
		margin-top: 20px;
		font-weight: 500;
	}
	:global(.dark) .form-check-label {
		color: #d1d5db;
	}
	.form-check {
		width: 18px;
		height: 18px;
		accent-color: hsl(var(--theme-hue, 230), 70%, 50%);
		cursor: pointer;
		border-radius: 4px;
	}

	.config-hint {
		margin: 0;
		font-size: 12px;
		color: var(--content-meta, #6b7280);
		line-height: 1.5;
	}
	:global(.dark) .config-hint {
		color: #9ca3af;
	}
	.mt-3 {
		margin-top: 12px;
	}
	.mb-3 {
		margin-bottom: 12px;
	}

	.pages-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 8px;
	}
	.page-toggle-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid var(--border, rgba(0,0,0,0.06));
		background: var(--bg-color, #fafafa);
		cursor: pointer;
		transition: all 0.15s;
	}
	:global(.dark) .page-toggle-item {
		background: rgba(255,255,255,0.03);
		border-color: rgba(255,255,255,0.06);
	}
	.page-toggle-item:hover {
		border-color: hsla(var(--theme-hue, 230), 70%, 50%, 0.3);
		background: color-mix(in srgb, hsl(var(--theme-hue, 230), 70%, 50%) 5%, transparent);
	}
	.page-toggle-off {
		opacity: 0.6;
	}
	.page-toggle-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-color, #1f2937);
		flex: 1;
	}
	:global(.dark) .page-toggle-label {
		color: #d1d5db;
	}
	.page-toggle-key {
		font-size: 11px;
		color: var(--content-meta, #9ca3af);
		font-family: monospace;
	}

	.code-editor-wrap {
		padding: 16px 20px;
	}
	.code-textarea {
		width: 100%;
		min-height: 500px;
		padding: 14px;
		border: 1.5px solid var(--border, #d1d5db);
		border-radius: 10px;
		font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace;
		font-size: 13px;
		line-height: 1.6;
		background: var(--bg-color, #fafafa);
		color: var(--text-color, #1f2937);
		outline: none;
		resize: vertical;
		tab-size: 2;
		box-sizing: border-box;
		white-space: pre;
		overflow: auto;
	}
	:global(.dark) .code-textarea {
		background: #0d0d18;
		border-color: #374151;
		color: #e5e7eb;
	}
	.code-textarea:focus {
		border-color: hsl(var(--theme-hue, 230), 70%, 50%);
		box-shadow: 0 0 0 2px hsla(var(--theme-hue, 230), 70%, 50%, 0.1);
	}
</style>
