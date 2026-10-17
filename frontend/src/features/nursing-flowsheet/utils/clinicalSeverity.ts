import type { ClinicalSeverity, NursingFlowsheetDocument } from '../types/nursingFlowsheet.types';
import { gcsTotal } from '../types/nursingFlowsheet.types';

/** Rule engine — paths use backend section names (e.g. `gastrointestinal`). */
export function fieldClinicalSeverity(path: string, doc: NursingFlowsheetDocument): ClinicalSeverity {
    const n = doc.neurological;
    const gcs = gcsTotal(n.gcsE, n.gcsV, n.gcsM);
    if (path.startsWith('neurological')) {
        if (path === 'neurological.gcsTotal' || path.includes('gcs')) {
            if (gcs != null && gcs <= 8) return 'critical';
            if (gcs != null && gcs <= 12) return 'warning';
        }
        if (n.levelOfConsciousness === 'Unresponsive' || n.levelOfConsciousness === 'Responds to Pain') return 'critical';
    }
    const r = doc.respiratory;
    if (path.startsWith('respiratory')) {
        const spo2 = r.spo2Percent;
        if (spo2 != null && spo2 < 90) return 'critical';
        if (spo2 != null && spo2 < 92) return 'critical';
        if (spo2 != null && spo2 < 94) return 'warning';
    }
    const c = doc.cardiovascular;
    if (path.startsWith('cardiovascular')) {
        if (c.capillaryRefill === '>4 sec') return 'critical';
        if (c.capillaryRefill === '2–4 sec') return 'warning';
        const hr = c.heartRate;
        if (hr != null && (hr < 50 || hr > 120)) return 'warning';
    }
    const p = doc.pain;
    if (path.startsWith('pain')) {
        const v = p.intensity0to10;
        if (v != null && v >= 7) return 'critical';
        if (v != null && v >= 4) return 'warning';
    }
    const sk = doc.integumentary;
    if (path.startsWith('integumentary')) {
        const b = sk.bradenScore;
        if (b != null && b <= 12) return 'critical';
        if (b != null && b <= 16) return 'warning';
    }
    return 'normal';
}

export function severityBorderClass(sev: ClinicalSeverity): string {
    if (sev === 'critical') return 'ring-2 ring-red-500/70 bg-red-50/90 dark:bg-red-950/30';
    if (sev === 'warning') return 'ring-1 ring-amber-500/60 bg-amber-50/80 dark:bg-amber-950/25';
    return '';
}

/** GCS total display coloring: 13–15 green, 9–12 yellow, ≤8 red */
export function gcsTotalSeverity(total: number | null): ClinicalSeverity {
    if (total == null) return 'normal';
    if (total <= 8) return 'critical';
    if (total <= 12) return 'warning';
    return 'normal';
}
