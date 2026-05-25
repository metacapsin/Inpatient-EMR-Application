export function parseAuthDate(iso: string): Date | null {
    if (!iso?.trim()) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function daysUntilEnd(authEndDate: string, nowMs: number = Date.now()): number | null {
    const end = parseAuthDate(authEndDate);
    if (!end) return null;
    const diff = end.getTime() - nowMs;
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function formatAuthPeriod(start: string, end: string): string {
    const s = parseAuthDate(start);
    const e = parseAuthDate(end);
    if (!s && !e) return '—';
    const fmt = (d: Date) => d.toLocaleDateString();
    if (s && e) return `${fmt(s)} – ${fmt(e)}`;
    if (s) return `${fmt(s)} –`;
    return `– ${fmt(e!)}`;
}

export type ExpiryAlertTone = 'none' | 'orange' | 'red';

export function expiryAlertTone(authEndDate: string, status: string, nowMs: number = Date.now()): ExpiryAlertTone {
    if (status !== 'Approved' && status !== 'Pending' && status !== 'Peer-to-Peer Requested') return 'none';
    const days = daysUntilEnd(authEndDate, nowMs);
    if (days === null) return 'none';
    if (days < 1) return 'red';
    if (days < 3) return 'orange';
    return 'none';
}

export function toDateInputValue(iso: string): string {
    const d = parseAuthDate(iso);
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function fromDateInputValue(value: string): string {
    if (!value?.trim()) return '';
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
