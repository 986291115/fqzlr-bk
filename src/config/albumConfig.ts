/**
 * 相册页面配置
 * 用于管理相册展示的内容
 */

export interface Photo {
	url: string;
	alt?: string;
	caption?: string;
}

export interface AlbumItem {
	id: string;
	title: string;
	subtitle?: string;
	cover?: string;
	date: string;
	location?: string;
	photos: string[];
	tags: string[];
	draft?: boolean;
	enabled?: boolean;
}

export interface AlbumPageConfig {
	title?: string;
	description?: string;
	showComment?: boolean;
}

export const albumPageConfig: AlbumPageConfig = {
	title: "相册",
	description: "记录生活中的美好瞬间",
	showComment: true,
};

export const albumConfig: AlbumItem[] = [
	{
		id: "gpt-sheng-tu",
		title: "GPT生图",
		subtitle: "GPT生成的图片",
		cover: "/gallery/gpt-img2-2026/1.webp",
		date: "2026-05-24",
		location: "gpt",
		tags: ["AI", "GPT生图"],
		photos: [
			"/gallery/gpt-img2-2026/1.webp",
			"/gallery/gpt-img2-2026/100.webp",
			"/gallery/gpt-img2-2026/101.webp",
			"/gallery/gpt-img2-2026/102.webp",
			"/gallery/gpt-img2-2026/103.webp",
			"/gallery/gpt-img2-2026/104.webp",
			"/gallery/gpt-img2-2026/16.webp",
			"/gallery/gpt-img2-2026/2.webp",
			"/gallery/gpt-img2-2026/20.webp",
			"/gallery/gpt-img2-2026/24.webp",
			"/gallery/gpt-img2-2026/25.webp",
			"/gallery/gpt-img2-2026/26.webp",
			"/gallery/gpt-img2-2026/27.webp",
			"/gallery/gpt-img2-2026/28.webp",
			"/gallery/gpt-img2-2026/29.webp",
			"/gallery/gpt-img2-2026/3.webp",
			"/gallery/gpt-img2-2026/4.webp",
			"/gallery/gpt-img2-2026/40.webp",
			"/gallery/gpt-img2-2026/41.webp",
			"/gallery/gpt-img2-2026/42.webp",
			"/gallery/gpt-img2-2026/43.webp",
			"/gallery/gpt-img2-2026/44.webp",
			"/gallery/gpt-img2-2026/45.webp",
			"/gallery/gpt-img2-2026/5.webp",
			"/gallery/gpt-img2-2026/50.webp",
			"/gallery/gpt-img2-2026/51.webp",
			"/gallery/gpt-img2-2026/53.webp",
			"/gallery/gpt-img2-2026/6.webp",
			"/gallery/gpt-img2-2026/7.webp",
			"/gallery/gpt-img2-2026/8.webp",
			"/gallery/gpt-img2-2026/80.webp",
		],
		draft: false,
		enabled: true,
	},
	{
		id: "luo-li",
		title: "萝莉",
		subtitle: "进来先电",
		cover: "/gallery/bl-ll-2026/00001.webp",
		date: "2026-05-06",
		location: "碧蓝航线",
		tags: ["碧蓝航线", "萝莉"],
		photos: [
			"/gallery/bl-ll-2026/00001.webp",
			"/gallery/bl-ll-2026/00002.webp",
			"/gallery/bl-ll-2026/00003.webp",
			"/gallery/bl-ll-2026/00004.webp",
			"/gallery/bl-ll-2026/00005.webp",
			"/gallery/bl-ll-2026/00006.webp",
			"/gallery/bl-ll-2026/00007.webp",
			"/gallery/bl-ll-2026/00008.webp",
			"/gallery/bl-ll-2026/00009.webp",
			"/gallery/bl-ll-2026/00010.webp",
			"/gallery/bl-ll-2026/00011.webp",
			"/gallery/bl-ll-2026/00012.webp",
			"/gallery/bl-ll-2026/00013.webp",
			"/gallery/bl-ll-2026/00014.webp",
			"/gallery/bl-ll-2026/00015.webp",
			"/gallery/bl-ll-2026/00016.webp",
			"/gallery/bl-ll-2026/00017.webp",
			"/gallery/bl-ll-2026/00018.webp",
			"/gallery/bl-ll-2026/00019.webp",
			"/gallery/bl-ll-2026/00020.webp",
			"/gallery/bl-ll-2026/00021.webp",
			"/gallery/bl-ll-2026/00022.webp",
			"/gallery/bl-ll-2026/00023.webp",
			"/gallery/bl-ll-2026/00024.webp",
			"/gallery/bl-ll-2026/00025.webp",
			"/gallery/bl-ll-2026/00026.webp",
			"/gallery/bl-ll-2026/00027.webp",
			"/gallery/bl-ll-2026/00028.webp",
			"/gallery/bl-ll-2026/00029.webp",
			"/gallery/bl-ll-2026/00030.webp",
			"/gallery/bl-ll-2026/00031.webp",
			"/gallery/bl-ll-2026/00032.webp",
			"/gallery/bl-ll-2026/00033.webp",
			"/gallery/bl-ll-2026/00034.webp",
			"/gallery/bl-ll-2026/00035.webp",
			"/gallery/bl-ll-2026/00036.webp",
			"/gallery/bl-ll-2026/00037.webp",
			"/gallery/bl-ll-2026/00038.webp",
			"/gallery/bl-ll-2026/00039.webp",
			"/gallery/bl-ll-2026/00040.webp",
			"/gallery/bl-ll-2026/00041.webp",
			"/gallery/bl-ll-2026/00042.webp",
			"/gallery/bl-ll-2026/00043.webp",
			"/gallery/bl-ll-2026/00044.webp",
			"/gallery/bl-ll-2026/00045.webp",
			"/gallery/bl-ll-2026/00046.webp",
			"/gallery/bl-ll-2026/00047.webp",
			"/gallery/bl-ll-2026/00048.webp",
			"/gallery/bl-ll-2026/00049.webp",
			"/gallery/bl-ll-2026/00050.webp",
			"/gallery/bl-ll-2026/00051.webp",
			"/gallery/bl-ll-2026/00052.webp",
			"/gallery/bl-ll-2026/00053.webp",
			"/gallery/bl-ll-2026/00054.webp",
			"/gallery/bl-ll-2026/00055.webp",
			"/gallery/bl-ll-2026/00056.webp",
			"/gallery/bl-ll-2026/00057.webp",
			"/gallery/bl-ll-2026/00058.webp",
			"/gallery/bl-ll-2026/00059.webp",
			"/gallery/bl-ll-2026/00060.webp",
			"/gallery/bl-ll-2026/00061.webp",
			"/gallery/bl-ll-2026/00062.webp",
			"/gallery/bl-ll-2026/00063.webp",
			"/gallery/bl-ll-2026/00064.webp",
			"/gallery/bl-ll-2026/00065.webp",
			"/gallery/bl-ll-2026/00066.webp",
			"/gallery/bl-ll-2026/00067.webp",
			"/gallery/bl-ll-2026/00068.webp",
			"/gallery/bl-ll-2026/00069.webp",
			"/gallery/bl-ll-2026/00070.webp",
			"/gallery/bl-ll-2026/00071.webp",
			"/gallery/bl-ll-2026/00072.webp",
			"/gallery/bl-ll-2026/00073.webp",
			"/gallery/bl-ll-2026/00074.webp",
			"/gallery/bl-ll-2026/00075.webp",
			"/gallery/bl-ll-2026/00076.webp",
			"/gallery/bl-ll-2026/00077.webp",
			"/gallery/bl-ll-2026/00078.webp",
			"/gallery/bl-ll-2026/00079.webp",
			"/gallery/bl-ll-2026/00080.webp",
			"/gallery/bl-ll-2026/00081.webp",
			"/gallery/bl-ll-2026/00082.webp",
			"/gallery/bl-ll-2026/00083.webp",
			"/gallery/bl-ll-2026/00084.webp",
			"/gallery/bl-ll-2026/00085.webp",
		],
		draft: false,
		enabled: true,
	},
	{
		id: "ming-chao",
		title: "鸣潮",
		subtitle: "鸣潮相册",
		cover: "/gallery/mc-2026/00001.webp",
		date: "2026-05-11",
		location: "鸣潮",
		tags: ["鸣潮"],
		photos: [
			"/gallery/mc-2026/00001.webp",
			"/gallery/mc-2026/00003.webp",
			"/gallery/mc-2026/00004.webp",
		],
		draft: false,
		enabled: true,
	},
];

export function getEnabledAlbums(): AlbumItem[] {
	const enabled = albumConfig.filter((a) => a.enabled !== false && a.draft !== true);
	return enabled.sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);
}

export function getAlbumById(id: string): AlbumItem | undefined {
	return albumConfig.find((a) => a.id === id);
}
