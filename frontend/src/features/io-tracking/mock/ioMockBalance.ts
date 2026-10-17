import type { IoBalanceSummary, IoTimelineRow, IORecord } from '../types/ioRecord.types';

function sumVolumeInWindow(records: IORecord[], sinceMs: number, type: 'Intake' | 'Output'): number {
    return records
        .filter((r) => r.recordType === type && new Date(r.recordedAt).getTime() >= sinceMs)
        .reduce((acc, r) => acc + r.volumeMl, 0);
}

export function computeMockBalance(records: IORecord[]): IoBalanceSummary {
    const now = Date.now();
    const since8h = now - 8 * 60 * 60 * 1000;
    const since24h = now - 24 * 60 * 60 * 1000;
    const since1h = now - 60 * 60 * 1000;

    const intake8hMl = sumVolumeInWindow(records, since8h, 'Intake');
    const output8hMl = sumVolumeInWindow(records, since8h, 'Output');
    const intake24hMl = sumVolumeInWindow(records, since24h, 'Intake');
    const output24hMl = sumVolumeInWindow(records, since24h, 'Output');

    const urineOutputLastHourMl = records
        .filter(
            (r) =>
                r.recordType === 'Output' &&
                r.outputCategory === 'Urine' &&
                new Date(r.recordedAt).getTime() >= since1h
        )
        .reduce((acc, r) => acc + r.volumeMl, 0);

    return {
        intake8hMl,
        output8hMl,
        balance8hMl: intake8hMl - output8hMl,
        intake24hMl,
        output24hMl,
        balance24hMl: intake24hMl - output24hMl,
        urineOutputLastHourMl,
    };
}

export function recordsToTimelineRows(records: IORecord[]): IoTimelineRow[] {
    return [...records]
        .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
        .map((r) => ({
            id: r.id ?? `io-${r.recordedAt}`,
            timeIso: r.recordedAt,
            recordType: r.recordType,
            category:
                r.recordType === 'Intake'
                    ? String(r.intakeCategory ?? '—')
                    : String(r.outputCategory ?? '—'),
            volumeMl: r.volumeMl,
            notes: r.notes ?? '',
            recordedByName: r.recordedByName,
        }));
}
