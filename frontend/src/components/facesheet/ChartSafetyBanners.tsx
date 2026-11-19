import { useQuery } from '@tanstack/react-query';
import { Biohazard, ShieldAlert } from 'lucide-react';
import api, { patientDataAPI } from '../../services/api';
import { asRecord, unwrapList } from '../../lib/apiPayload';

interface AllergyBannerItem {
    name: string;
    severity: string;
    criticality: string;
}

function first(v: unknown): string {
    if (Array.isArray(v)) return first(v[0]);
    if (typeof v === 'string') return v.trim();
    return '';
}

/** Active allergies from GET /Patient/getAllAllergyList (legacy nested shape, status flag = active). */
async function fetchActiveAllergies(patientId: string): Promise<AllergyBannerItem[]> {
    const { data } = await patientDataAPI.getAllAllergyList(patientId);
    const rows = unwrapList(data);
    const out: AllergyBannerItem[] = [];
    for (const item of rows) {
        const row = asRecord(item);
        if (!row) continue;
        if (row.status === false) continue;
        const allergen = asRecord(Array.isArray(row.Allergen) ? row.Allergen[0] : undefined);
        const name = first(allergen?.Name) || (typeof row.allergen === 'string' ? row.allergen : '');
        if (!name) continue;
        const sev = asRecord(Array.isArray(row.Severity) ? row.Severity[0] : undefined);
        out.push({
            name,
            severity: first(sev?.Description) || (typeof row.severity === 'string' ? row.severity : ''),
            criticality: typeof row.criticality === 'string' ? row.criticality : '',
        });
    }
    return out;
}

interface IsolationState {
    active: boolean;
    isolationType: string;
    infectionType: string;
}

/**
 * Isolation status from the real HAI event log (GET /api/HAIEvent/encounter/:id). Latest event per
 * infection type decides whether precautions are still active; `infection_resolved` clears them.
 * Calls the endpoint directly so the mock-default HAI service cannot inject sample precautions.
 */
async function fetchIsolation(encounterId: string): Promise<IsolationState> {
    const { data } = await api.get<unknown>(`/api/HAIEvent/encounter/${encodeURIComponent(encounterId)}`);
    const rows = unwrapList(data)
        .map(asRecord)
        .filter((r): r is Record<string, unknown> => Boolean(r));
    // API returns newest first; walk oldest → newest so the last write wins.
    const latest = new Map<string, Record<string, unknown>>();
    for (const r of [...rows].reverse()) {
        const key = typeof r.infectionType === 'string' ? r.infectionType : '';
        latest.set(key, r);
    }
    for (const r of latest.values()) {
        const type = typeof r.eventType === 'string' ? r.eventType : '';
        const status = typeof r.status === 'string' ? r.status.toLowerCase() : '';
        if (type === 'infection_resolved' || status === 'resolved') continue;
        const isolationType = typeof r.isolationType === 'string' ? r.isolationType : '';
        if (type === 'isolation_started' || isolationType) {
            return { active: true, isolationType, infectionType: typeof r.infectionType === 'string' ? r.infectionType : '' };
        }
    }
    return { active: false, isolationType: '', infectionType: '' };
}

export interface ChartSafetyBannersProps {
    patientId: string;
    encounterId?: string;
}

/**
 * Allergy and isolation strip under the encounter header. Renders nothing while loading or when
 * neither applies; failures are shown as a quiet "unknown" marker rather than hidden, because an
 * absent allergy banner must never be mistaken for "no known allergies".
 */
export function ChartSafetyBanners({ patientId, encounterId }: ChartSafetyBannersProps) {
    const allergies = useQuery({
        queryKey: ['chart-safety', 'allergies', patientId],
        queryFn: () => fetchActiveAllergies(patientId),
        enabled: Boolean(patientId),
        staleTime: 30_000,
    });
    const isolation = useQuery({
        queryKey: ['chart-safety', 'isolation', encounterId ?? ''],
        queryFn: () => fetchIsolation(encounterId!),
        enabled: Boolean(encounterId),
        staleTime: 30_000,
    });

    const allergyList = allergies.data ?? [];
    const showAllergy = allergies.isError || allergyList.length > 0;
    const showIsolation = Boolean(encounterId) && (isolation.isError || isolation.data?.active);
    if (!showAllergy && !showIsolation) return null;

    return (
        <div
            className="flex flex-wrap items-center gap-2 border-b border-emr-border bg-white px-4 py-1.5 text-xs dark:border-white/10 dark:bg-[#141210]"
            aria-label="Patient safety alerts"
        >
            {showAllergy ? (
                <span
                    className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
                        allergies.isError
                            ? 'border-gray-200 bg-gray-50 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200'
                            : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100'
                    }`}
                    title={allergies.isError ? 'Allergy list could not be loaded' : allergyList.map((a) => a.name).join(', ')}
                >
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="shrink-0">Allergies</span>
                    <span className="truncate font-normal">
                        {allergies.isError
                            ? 'unknown (failed to load)'
                            : allergyList
                                  .slice(0, 4)
                                  .map((a) => (a.severity ? `${a.name} (${a.severity})` : a.name))
                                  .join(' · ') + (allergyList.length > 4 ? ` +${allergyList.length - 4} more` : '')}
                    </span>
                </span>
            ) : null}
            {showIsolation ? (
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
                        isolation.isError
                            ? 'border-gray-200 bg-gray-50 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200'
                            : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100'
                    }`}
                >
                    <Biohazard className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>Isolation</span>
                    <span className="font-normal">
                        {isolation.isError
                            ? 'status unknown'
                            : [isolation.data?.isolationType, isolation.data?.infectionType].filter(Boolean).join(' · ') || 'precautions active'}
                    </span>
                </span>
            ) : null}
        </div>
    );
}
