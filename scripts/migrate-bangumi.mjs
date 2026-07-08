import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = path.resolve(__dirname, "../src/content/bangumi");
const outputFile = path.resolve(__dirname, "../src/config/bangumiConfig.ts");

const categories = ["anime", "book", "game", "music"];

function pinyinToId(text) {
	return text
		.replace(/[\s]+/g, "")
		.replace(/[，。！？、；：""''（）【】《》—…·]/g, "")
		.replace(/[^\w\u4e00-\u9fa5]/g, "")
		.toLowerCase();
}

function formatDate(date) {
	if (!date) return "";
	const d = new Date(date);
	if (isNaN(d.getTime())) return String(date);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function extractComment(content, category) {
	const trimmed = content.trim();
	if (!trimmed) return undefined;

	if (category === "book") {
		const introMatch = trimmed.match(/\*\*简介\*\*：\s*([\s\S]*?)(?=\n---|\n#|$)/);
		if (introMatch) {
			const intro = introMatch[1].trim();
			if (intro) return intro;
		}
	}

	const firstLine = trimmed.split("\n")[0]?.trim();
	if (firstLine && !firstLine.startsWith(">") && !firstLine.startsWith("#")) {
		return firstLine;
	}

	return undefined;
}

function readAllMdFiles() {
	const files = [];

	function walk(dir) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				files.push(fullPath);
			}
		}
	}

	for (const cat of categories) {
		const catDir = path.join(baseDir, cat);
		if (fs.existsSync(catDir)) {
			walk(catDir);
		}
	}

	return files;
}

function detectCategory(filePath) {
	const relativePath = path.relative(baseDir, filePath);
	const parts = relativePath.split(path.sep);
	return parts[0];
}

function isAnimeCategory(tags = []) {
	const animeTags = ["动画", "动漫", "日本动画", "国产动画", "动画电影"];
	return tags.some((tag) => animeTags.some((at) => tag.includes(at)));
}

function parseFiles() {
	const files = readAllMdFiles();
	const items = [];

	for (const filePath of files) {
		const fileName = path.basename(filePath, ".md");
		const fileContent = fs.readFileSync(filePath, "utf-8");
		const { data, content } = matter(fileContent);

		const dirCategory = detectCategory(filePath);
		let category = data.category || dirCategory;

		if (category === "anime" && !isAnimeCategory(data.tags || [])) {
			category = "real";
		}

		const id = pinyinToId(fileName);

		const comment = data.comment || extractComment(content, category);

		const item = {
			id: id || fileName,
			title: data.title || fileName,
		};

		if (data.name_cn) item.name_cn = data.name_cn;
		item.category = category;
		if (data.subcategory) item.subcategory = data.subcategory;
		item.status = typeof data.status === "number" ? data.status : Number(data.status) || 1;
		if (data.score !== undefined) item.score = typeof data.score === "number" ? data.score : Number(data.score);
		item.image = data.image || "";
		item.tags = data.tags || [];
		if (comment) item.comment = comment;
		item.published = formatDate(data.published) || formatDate(new Date());
		if (data.link) item.link = data.link;
		if (data.artist) item.artist = data.artist;
		if (data.audioUrl) item.audioUrl = data.audioUrl;
		if (data.lrcUrl) item.lrcUrl = data.lrcUrl;
		if (data.metingServer) item.metingServer = data.metingServer;
		if (data.metingId) item.metingId = data.metingId;
		item.enabled = data.enabled !== false;

		items.push(item);
	}

	return items;
}

function generateTsFile(items) {
	const itemsStr = items
		.map((item) => {
			const lines = ["\t{"];
			lines.push(`\t\tid: "${item.id}",`);
			lines.push(`\t\ttitle: ${JSON.stringify(item.title)},`);
			if (item.name_cn) lines.push(`\t\tname_cn: ${JSON.stringify(item.name_cn)},`);
			lines.push(`\t\tcategory: "${item.category}",`);
			if (item.subcategory) lines.push(`\t\tsubcategory: "${item.subcategory}",`);
			lines.push(`\t\tstatus: ${item.status},`);
			if (item.score !== undefined) lines.push(`\t\tscore: ${item.score},`);
			lines.push(`\t\timage: ${JSON.stringify(item.image)},`);
			lines.push(`\t\ttags: [${item.tags.map((t) => JSON.stringify(t)).join(", ")}],`);
			if (item.comment) lines.push(`\t\tcomment: ${JSON.stringify(item.comment)},`);
			lines.push(`\t\tpublished: "${item.published}",`);
			if (item.link) lines.push(`\t\tlink: ${JSON.stringify(item.link)},`);
			if (item.artist) lines.push(`\t\tartist: ${JSON.stringify(item.artist)},`);
			if (item.audioUrl) lines.push(`\t\taudioUrl: ${JSON.stringify(item.audioUrl)},`);
			if (item.lrcUrl) lines.push(`\t\tlrcUrl: ${JSON.stringify(item.lrcUrl)},`);
			if (item.metingServer) lines.push(`\t\tmetingServer: ${JSON.stringify(item.metingServer)},`);
			if (item.metingId) lines.push(`\t\tmetingId: ${JSON.stringify(item.metingId)},`);
			lines.push(`\t\tenabled: ${item.enabled},`);
			lines.push("\t},");
			return lines.join("\n");
		})
		.join("\n");

	return `/**
 * 番剧/影视收藏页面配置
 * 用于管理番剧、书籍、游戏、音乐收藏
 */

export type BangumiCategory = "anime" | "book" | "game" | "music" | "real";
export type BangumiSubcategory = "movie" | "tv" | "anime" | "documentary" | "game";

export interface BangumiItem {
\tid: string;
\ttitle: string;
\tname_cn?: string;
\tcategory: BangumiCategory;
\tsubcategory?: BangumiSubcategory;
\tstatus: number;
\tscore?: number;
\timage: string;
\ttags: string[];
\tcomment?: string;
\tpublished: string;
\tlink?: string;
\tartist?: string;
\taudioUrl?: string;
\tlrcUrl?: string;
\tmetingServer?: string;
\tmetingId?: string;
\tenabled?: boolean;
}

export interface BangumiPageConfig {
\ttitle?: string;
\tdescription?: string;
\tshowComment?: boolean;
\titemsPerPage?: number;
\titemsPerPageMobile?: number;
}

export const bangumiPageConfig: BangumiPageConfig = {
\ttitle: "番剧",
\tdescription: "记录我看过的动漫、书籍、游戏和音乐",
\tshowComment: true,
\titemsPerPage: 12,
\titemsPerPageMobile: 6,
};

export const bangumiConfig: BangumiItem[] = [
${itemsStr}
];

export function getAllBangumi(): BangumiItem[] {
\treturn bangumiConfig.filter((item) => item.enabled !== false);
}

export function getBangumiByCategory(category: BangumiCategory): BangumiItem[] {
\treturn getAllBangumi()
\t\t.filter((item) => item.category === category)
\t\t.sort(
\t\t\t(a, b) =>
\t\t\t\tnew Date(b.published).getTime() - new Date(a.published).getTime(),
\t\t);
}

export function getBangumiByStatus(status: number): BangumiItem[] {
\treturn getAllBangumi().filter((item) => item.status === status);
}

export function getBangumiStats() {
\tconst all = getAllBangumi();
\tconst stats: Record<BangumiCategory, number> = {
\t\tanime: 0,
\t\tbook: 0,
\t\tgame: 0,
\t\tmusic: 0,
\t\treal: 0,
\t};
\tall.forEach((item) => {
\t\tstats[item.category] = (stats[item.category] || 0) + 1;
\t});
\treturn stats;
}
`;
}

const items = parseFiles();
console.log(`共解析 ${items.length} 个条目`);
console.log(`分类统计：`);
const stats = {};
for (const item of items) {
	stats[item.category] = (stats[item.category] || 0) + 1;
}
for (const [cat, count] of Object.entries(stats)) {
	console.log(`  ${cat}: ${count}`);
}

const tsContent = generateTsFile(items);
fs.writeFileSync(outputFile, tsContent, "utf-8");
console.log(`\n已写入 ${outputFile}`);
