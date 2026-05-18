import type { IoBalanceSummary, IoTimelineRow, IORecord } from '../types/ioRecord.types';

function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function num(v: unknown, fallback = 0): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ''): string {
    return typeof v === 'string' ? v : fallback;
}

export function normalizeBalanceSummary(raw: unknown): IoBalanceSummary {
    const r = isRecord(raw) ? raw : {};
    const intake8 = num(r.intake8hMl ?? r.intake8h ?? r.eightHourIntakeMl);
    const output8 = num(r.output8hMl ?? r.output8h ?? r.eightHourOutputMl);
    const balance8 = num(r.balance8hMl ?? r.balance8h, intake8 - output8);
    const intake24 = num(r.intake24hMl ?? r.intake24h ?? r.twentyFourHourIntakeMl);
    const output24 = num(r.output24hMl ?? r.output24h ?? r.twentyFourHourOutputMl);
    const balance24 = num(r.balance24hMl ?? r.balance24h, intake24 - output24);
    const urine1h = num(r.urineOutputLastHourMl ?? r.urineLastHourMl ?? r.urineOutputLastHour);

    return {
        intake8hMl: intake8,
        output8hMl: output8,
        balance8hMl: balance8,
        intake24hMl: intake24,
        output24hMl: output24,
        balance24hMl: balance24,
        urineOutputLastHourMl: urine1h,
    };
}

export function mapTimelineRows(raw: unknown): IoTimelineRow[] {
    const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.records) ? raw.records : isRecord(raw) && Array.isArray(raw.items) ? raw.items : [];
    const rows = list.map((row, i) => {
        const r = isRecord(row) ? row : {};
        const recordType = str(r.recordType) === 'Output' ? 'Output' : 'Intake';
        const category =
            recordType === 'Intake'
                ? str(r.intakeCategory ?? r.category)
                : str(r.outputCategory ?? r.category);
        return {
            id: str(r.id ?? r._id, `io-${i}`),
            timeIso: str(r.recordedAt ?? r.time ?? r.createdAt, new Date().toISOString()),
            recordType,
            category: category || '—',
            volumeMl: num(r.volumeMl ?? r.volume),
            notes: str(r.notes),
            recordedByName: str(r.recordedByName ?? r.recordedBy ?? '—'),
        };
    });
    return rows.sort((a, b) => new Date(a.timeIso).getTime() - new Date(b.timeIso).getTime());
}

export function mapIoRecord(row: unknown): IORecord | null {
    if (!isRecord(row)) return null;
    const recordType = str(row.recordType) === 'Output' ? 'Output' : 'Intake';
    return {
        id: str(row.id ?? row._id) || undefined,
        patientId: str(row.patientId),
        encounterId: str(row.encounterId),
        tenantId: str(row.tenantId),
        recordType,
        intakeCategory: row.intakeCategory != null ? str(row.intakeCategory) : null,
        fluidType: row.fluidType != null ? str(row.fluidType) : null,
        ratePerHour: row.ratePerHour != null ? num(row.ratePerHour) : null,
        bagVolumeRemaining: row.bagVolumeRemaining != null ? num(row.bagVolumeRemaining) : null,
        outputCategory: row.outputCategory != null ? str(row.outputCategory) : null,
        colorConsistency: row.colorConsistency != null ? str(row.colorConsistency) : null,
        device: row.device != null ? str(row.device) : null,
        volumeMl: num(row.volumeMl),
        recordedAt: str(row.recordedAt, new Date().toISOString()),
        shift: row.shift != null ? str(row.shift) : null,
        notes: row.notes != null ? str(row.notes) : null,
        recordedBy: str(row.recordedBy),
        recordedByName: str(row.recordedByName),
    };
}

export function inferShiftLabel(now = new Date()): string {
    const h = now.getHours();
    if (h >= 7 && h < 15) return 'Day';
    if (h >= 15 && h < 23) return 'Evening';
    return 'Night';
}

export function appendEndTimeToNotes(notes: string, endTime: Date | null): string {
    if (!endTime) return notes.trim();
    const stamp = endTime.toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const prefix = `End: ${stamp}`;
    const base = notes.trim();
    return base ? `${prefix} — ${base}` : prefix;
}
