import { Lunar, Solar } from "lunar-typescript";
import type { SolarOrLunarDate } from "@/types/config";

export function getLunarDayChinese(
	year: number,
	month: number,
	day: number,
): string {
	try {
		return Solar.fromYmd(year, month, day).getLunar().getDayInChinese();
	} catch {
		return "";
	}
}

export function getLunarMonthDayChinese(
	year: number,
	month: number,
	day: number,
): string {
	try {
		const lunar = Solar.fromYmd(year, month, day).getLunar();
		return `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
	} catch {
		return "";
	}
}

export function lunarMonthDayToSolar(
	solarYear: number,
	lunarMonth: number,
	lunarDay: number,
): string | null {
	try {
		const lunar = Lunar.fromYmd(solarYear, lunarMonth, lunarDay);
		const solar = lunar.getSolar();
		if (solar.getYear() === solarYear) {
			return solar.toYmd();
		}
		const lunarNext = Lunar.fromYmd(solarYear + 1, lunarMonth, lunarDay);
		const solarNext = lunarNext.getSolar();
		if (solarNext.getYear() === solarYear) {
			return solarNext.toYmd();
		}
		const lunarPrev = Lunar.fromYmd(solarYear - 1, lunarMonth, lunarDay);
		const solarPrev = lunarPrev.getSolar();
		if (solarPrev.getYear() === solarYear) {
			return solarPrev.toYmd();
		}
		return null;
	} catch {
		return null;
	}
}

export function resolveYearlyDate(
	date: SolarOrLunarDate,
	solarYear: number,
): string | null {
	if (date.type === "solar") {
		const ymd = `${solarYear}-${String(date.month).padStart(2, "0")}-${String(
			date.day,
		).padStart(2, "0")}`;
		const d = new Date(ymd);
		if (
			d.getFullYear() === solarYear &&
			d.getMonth() + 1 === date.month &&
			d.getDate() === date.day
		) {
			return ymd;
		}
		return null;
	}
	return lunarMonthDayToSolar(solarYear, date.month, date.day);
}