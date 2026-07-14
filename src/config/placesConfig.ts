/**
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
	url?: string;
	urlLabel?: string;
	photos?: string[];
	tags?: string[];
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
	{
		id: "2026-01-30-zhejiang-hangzhou",
		date: "2026-01-30",
		province: "浙江",
		city: "杭州",
		experience: "困死了",
		visitCount: 99,
		lat: 30.2741,
		lng: 120.1551,
		tags: ["旅行", "工作"],
		enabled: true,
	},
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
