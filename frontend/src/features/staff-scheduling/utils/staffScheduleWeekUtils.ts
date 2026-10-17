import { addDays, endOfWeek, format, isSameDay, startOfWeek } from 'date-fns';
import type { ShiftType, StaffShift } from '../../../types/staffScheduling.types';

export type CalendarViewMode = 'day' | 'week' | 'month';

export function ymd(d: Date): string {
    return format(d, 'yyyy-MM-dd');
}

export function weekStartMonday(d: Date): Date {
    return startOfWeek(d, { weekStartsOn: 1 });
}

export function weekDaysFrom(weekStart: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatWeekRangeLabel(weekStart: Date): string {
    const end = endOfWeek(weekStart, { weekStartsOn: 1 });
    const sameMonth = weekStart.getMonth() === end.getMonth();
    if (sameMonth) {
        return `${format(weekStart, 'MMM d')} – ${format(end, 'd, yyyy')}`;
    }
    return `${format(weekStart, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

export function shiftOnDay(shift: StaffShift, day: Date): boolean {
    const start = new Date(shift.startAt);
    return isSameDay(start, day);
}

export function formatShiftTimeRange(shift: StaffShift, shiftType?: ShiftType): string {
    const start = new Date(shift.startAt);
    const end = new Date(shift.endAt);
    const fmt = (d: Date) => format(d, 'HH:mm');
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        return `${fmt(start)} - ${fmt(end)}`;
    }
    if (shiftType) return `${shiftType.startTime} - ${shiftType.endTime}`;
    return '';
}

export function shiftCardTitle(wardName: string, shiftType?: ShiftType): string {
    const typeShort = shiftType?.label.split('(')[0]?.trim() ?? 'Shift';
    return `${wardName} - ${typeShort}`;
}

export interface ShiftCardTheme {
    bg: string;
    border: string;
    text: string;
    dot: string;
}

export function themeForShiftType(shiftTypeId: string): ShiftCardTheme {
    switch (shiftTypeId) {
        case 'st-evening':
            return {
                bg: 'bg-emerald-50 dark:bg-emerald-950/40',
                border: 'border-emerald-200/90 dark:border-emerald-800/60',
                text: 'text-emerald-900 dark:text-emerald-100',
                dot: 'bg-emerald-500',
            };
        case 'st-night':
            return {
                bg: 'bg-violet-50 dark:bg-violet-950/40',
                border: 'border-violet-200/90 dark:border-violet-800/60',
                text: 'text-violet-900 dark:text-violet-100',
                dot: 'bg-violet-500',
            };
        default:
            return {
                bg: 'bg-sky-50 dark:bg-sky-950/40',
                border: 'border-sky-200/90 dark:border-sky-800/60',
                text: 'text-sky-900 dark:text-sky-100',
                dot: 'bg-sky-500',
            };
    }
}

export function initialsFromName(name: string): string {
    const parts = name.replace(/,.*$/, '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

export function avatarHue(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 17) % 360;
    return `hsl(${h} 55% 42%)`;
}
