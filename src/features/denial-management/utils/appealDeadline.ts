export function daysUntil(isoDate: string): number | null {
    if (!isoDate.trim()) return null;
    const target = new Date(isoDate);
    if (Number.isNaN(target.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export type AppealDeadlineTone = 'none' | 'yellow' | 'red';

export function appealDeadlineTone(isoDate: string): AppealDeadlineTone {
    const days = daysUntil(isoDate);
    if (days === null) return 'none';
    if (days < 3) return 'red';
    if (days < 7) return 'yellow';
    return 'none';
}
