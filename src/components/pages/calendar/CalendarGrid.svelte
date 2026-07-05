<script lang="ts">
import { onDestroy, onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import type { HolidayEntry } from "@/pages/api/holidays.json";
import type { BirthdayItem, ScheduleItem } from "@/types/config";
import {
	bucketize,
	buildBirthdayEvents,
	buildHolidayEvents,
	buildPostEvents,
	buildScheduleEvents,
	type CalendarEvent,
	type EventBucket,
	type EventType,
	formatYmd,
	type PostMeta,
} from "@/utils/calendar-events";
import { getLunarDayChinese } from "@/utils/lunar-utils";
import { eventTypeMeta } from "./eventTypes";

interface Props {
	holidays?: HolidayEntry[];
	posts?: PostMeta[];
	birthdays?: BirthdayItem[];
	schedules?: ScheduleItem[];
	years?: number[];
	showPosts?: boolean;
	showLunar?: boolean;
}

let {
	holidays = [],
	posts = [],
	birthdays = [],
	schedules = [],
	years = [],
	showPosts = true,
	showLunar = true,
}: Props = $props();

const monthNames = [
	i18n(I18nKey.calendarJanuary),
	i18n(I18nKey.calendarFebruary),
	i18n(I18nKey.calendarMarch),
	i18n(I18nKey.calendarApril),
	i18n(I18nKey.calendarMay),
	i18n(I18nKey.calendarJune),
	i18n(I18nKey.calendarJuly),
	i18n(I18nKey.calendarAugust),
	i18n(I18nKey.calendarSeptember),
	i18n(I18nKey.calendarOctober),
	i18n(I18nKey.calendarNovember),
	i18n(I18nKey.calendarDecember),
];

const weekDays = [
	i18n(I18nKey.calendarSunday),
	i18n(I18nKey.calendarMonday),
	i18n(I18nKey.calendarTuesday),
	i18n(I18nKey.calendarWednesday),
	i18n(I18nKey.calendarThursday),
	i18n(I18nKey.calendarFriday),
	i18n(I18nKey.calendarSaturday),
];

const today = new Date();
const todayKey = formatYmd(today);

let displayYear = $state(today.getFullYear());
let displayMonth = $state(today.getMonth());
let selectedDateKey = $state(todayKey);

const bucket = $derived.by<EventBucket>(() => {
	const list: CalendarEvent[] = [];
	list.push(...buildHolidayEvents(holidays));
	list.push(...buildBirthdayEvents(birthdays, years));
	list.push(...buildScheduleEvents(schedules, years));
	if (showPosts) list.push(...buildPostEvents(posts));
	return bucketize(list);
});

type Cell = {
	key: string;
	dateKey: string;
	day: number;
	isCurrentMonth: boolean;
	isToday: boolean;
	lunarStr: string;
	events: CalendarEvent[];
};

const cells = $derived.by<Cell[]>(() => {
	const firstOfMonth = new Date(displayYear, displayMonth, 1);
	const firstWeekday = firstOfMonth.getDay();
	const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();

	const out: Cell[] = [];

	const prevMonthDays = new Date(displayYear, displayMonth, 0).getDate();
	for (let i = firstWeekday - 1; i >= 0; i--) {
		const d = prevMonthDays - i;
		const year = displayMonth === 0 ? displayYear - 1 : displayYear;
		const month = displayMonth === 0 ? 12 : displayMonth;
		const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
		out.push({
			key: `prev-${dateKey}`,
			dateKey,
			day: d,
			isCurrentMonth: false,
			isToday: dateKey === todayKey,
			lunarStr: showLunar ? getLunarDayChinese(year, month, d) : "",
			events: bucket[dateKey] || [],
		});
	}

	for (let d = 1; d <= daysInMonth; d++) {
		const dateKey = `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
		out.push({
			key: `cur-${dateKey}`,
			dateKey,
			day: d,
			isCurrentMonth: true,
			isToday: dateKey === todayKey,
			lunarStr: showLunar
				? getLunarDayChinese(displayYear, displayMonth + 1, d)
				: "",
			events: bucket[dateKey] || [],
		});
	}

	let nextDay = 1;
	while (out.length < 42) {
		const year = displayMonth === 11 ? displayYear + 1 : displayYear;
		const month = displayMonth === 11 ? 1 : displayMonth + 2;
		const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
		out.push({
			key: `next-${dateKey}`,
			dateKey,
			day: nextDay,
			isCurrentMonth: false,
			isToday: dateKey === todayKey,
			lunarStr: showLunar ? getLunarDayChinese(year, month, nextDay) : "",
			events: bucket[dateKey] || [],
		});
		nextDay++;
	}

	return out;
});

const headerLabel = $derived(
	`${displayYear}${i18n(I18nKey.year)} ${monthNames[displayMonth]}`,
);

const showBackToToday = $derived(
	!(
		displayYear === today.getFullYear() &&
		displayMonth === today.getMonth() &&
		selectedDateKey === todayKey
	),
);

function prevMonth() {
	if (displayMonth === 0) {
		displayMonth = 11;
		displayYear--;
	} else {
		displayMonth--;
	}
}

function nextMonth() {
	if (displayMonth === 11) {
		displayMonth = 0;
		displayYear++;
	} else {
		displayMonth++;
	}
}

function backToToday() {
	displayYear = today.getFullYear();
	displayMonth = today.getMonth();
	selectDate(todayKey);
}

function selectDate(dateKey: string) {
	selectedDateKey = dateKey;
	window.dispatchEvent(
		new CustomEvent("calendar:selected", { detail: dateKey }),
	);
}

function selectCell(cell: Cell) {
	if (!cell.isCurrentMonth) {
		const [y, m] = cell.dateKey.split("-").map((s) => Number.parseInt(s, 10));
		displayYear = y;
		displayMonth = m - 1;
	}
	selectDate(cell.dateKey);
}

function handleExternalSelect(e: Event) {
	const ce = e as CustomEvent<string>;
	const dateKey = ce.detail;
	if (!dateKey) return;
	const [y, m] = dateKey.split("-").map((s) => Number.parseInt(s, 10));
	if (Number.isNaN(y) || Number.isNaN(m)) return;
	displayYear = y;
	displayMonth = m - 1;
	selectedDateKey = dateKey;
	window.dispatchEvent(
		new CustomEvent("calendar:selected", { detail: dateKey }),
	);
}

onMount(() => {
	window.addEventListener("calendar:select-date", handleExternalSelect);
	window.dispatchEvent(
		new CustomEvent("calendar:selected", { detail: selectedDateKey }),
	);
});

onDestroy(() => {
	if (typeof window === "undefined") return;
	window.removeEventListener("calendar:select-date", handleExternalSelect);
});

const MAX_CHIPS_DESKTOP = 3;
function visibleEvents(events: CalendarEvent[]) {
	return events.slice(0, MAX_CHIPS_DESKTOP);
}
function overflowCount(events: CalendarEvent[]) {
	return Math.max(0, events.length - MAX_CHIPS_DESKTOP);
}

function uniqueDots(events: CalendarEvent[]): EventType[] {
	const seen = new Set<EventType>();
	const out: EventType[] = [];
	for (const e of events) {
		if (!seen.has(e.type)) {
			seen.add(e.type);
			out.push(e.type);
		}
	}
	return out;
}
</script>

<section class="calendar-grid-wrap">
	<div class="flex items-center justify-between mb-4">
		<button
			type="button"
			class="nav-btn"
			onclick={prevMonth}
			aria-label="Previous month"
		>
			<Icon icon="material-symbols:chevron-left" />
		</button>

		<div class="text-lg font-bold text-neutral-900 dark:text-neutral-100 select-none">
			{headerLabel}
		</div>

		<div class="flex items-center gap-2">
			{#if showBackToToday}
				<button
					type="button"
					class="back-today-btn"
					onclick={backToToday}
					aria-label={i18n(I18nKey.today)}
				>
					<Icon icon="material-symbols:today" />
					<span class="hidden sm:inline">{i18n(I18nKey.today)}</span>
				</button>
			{/if}
			<button
				type="button"
				class="nav-btn"
				onclick={nextMonth}
				aria-label="Next month"
			>
				<Icon icon="material-symbols:chevron-right" />
			</button>
		</div>
	</div>

	<div class="weekday-row">
		{#each weekDays as wd, i (wd + i)}
			<div
				class="text-center text-xs font-medium uppercase tracking-wide py-2 {i === 0 || i === 6 ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-500 dark:text-neutral-400'}"
			>
				{wd}
			</div>
		{/each}
	</div>

	<div class="cells-grid">
		{#each cells as cell (cell.key)}
			{@const isSelected = cell.dateKey === selectedDateKey}
			<button
				type="button"
				class="day-cell"
				class:is-current={cell.isCurrentMonth}
				class:is-other={!cell.isCurrentMonth}
				class:is-today={cell.isToday}
				class:is-selected={isSelected}
				onclick={() => selectCell(cell)}
			>
				<div class="cell-header">
					<span class="day-num">{cell.day}</span>
					{#if cell.lunarStr}
						<span class="lunar-num">{cell.lunarStr}</span>
					{/if}
				</div>

				<div class="cell-events">
					{#each visibleEvents(cell.events) as ev (ev.title + ev.type)}
						{@const meta = eventTypeMeta[ev.type]}
						<div class="event-chip {meta.chipClass}">
							<span class="chip-bar {meta.barClass}"></span>
							<span class="chip-title truncate">{ev.title}</span>
						</div>
					{/each}
					{#if overflowCount(cell.events) > 0}
						<div class="more-chip">
							+{overflowCount(cell.events)} {i18n(I18nKey.more)}
						</div>
					{/if}
				</div>

				{#if cell.events.length > 0}
					<div class="cell-dots">
						{#each uniqueDots(cell.events) as t (t)}
							{@const meta = eventTypeMeta[t]}
							<span class="dot {meta.dotClass}"></span>
						{/each}
					</div>
				{/if}
			</button>
		{/each}
	</div>
</section>