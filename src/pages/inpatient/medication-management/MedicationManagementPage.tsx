import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { getPatientsList, type PatientListItem } from '../../../services/patient.service';
import { listActiveEncounters, type ActiveEncounterRow } from '../../../services/adt.service';
import { MarTab } from './MarTab';
import { PrnStatTab } from './PrnStatTab';
import { PharmacyTab } from './PharmacyTab';
import { DischargeMedsTab } from './DischargeMedsTab';
import SearchableSelect from '@/components/ui/SearchableSelect';
import type { IRootState } from '../../../store';
import { selectAdtEncounter } from '../../../store/adtEncounterSlice';

type TabId = 'mar' | 'prn' | 'pharmacy' | 'discharge';

function displayStaffName(): string {
    try {
        const raw = localStorage.getItem('user');
        if (!raw) return 'Staff';
        const u = JSON.parse(raw) as Record<string, unknown>;
        const sub = (u.user as Record<string, unknown>) || u;
        const first = String(sub.firstName || sub.FirstName || '').trim();
        const last = String(sub.lastName || sub.LastName || '').trim();
        const name = [first, last].filter(Boolean).join(' ').trim();
        return name || String(sub.email || sub.userName || 'Staff').trim() || 'Staff';
    } catch {
        return 'Staff';
    }
}

function formatEncounterLabel(enc: ActiveEncounterRow): string {
    const idTail = enc.id.length > 8 ? enc.id.slice(-8) : enc.id;
    const name = enc.patientName ? String(enc.patientName) : '';
    return name ? `${name} · …${idTail}` : `…${idTail}`;
}

export default function MedicationManagementPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const patientId = searchParams.get('patientId') || '';
    const encounterId = searchParams.get('encounterId') || '';

    const [tab, setTab] = useState<TabId>('mar');
    const [patients, setPatients] = useState<PatientListItem[]>([]);
    const [patientsLoading, setPatientsLoading] = useState(false);
    const [encounters, setEncounters] = useState<ActiveEncounterRow[]>([]);
    const [encountersLoading, setEncountersLoading] = useState(false);

    const adtSession = useSelector((s: IRootState) => selectAdtEncounter(s, patientId));

    const staffName = useMemo(() => displayStaffName(), []);

    useEffect(() => {
        let cancelled = false;
        setPatientsLoading(true);
        void getPatientsList({
            page: 1,
            limit: 500,
            status: 'active',
            sortBy: 'patient',
            sortOrder: 'asc',
        })
            .then((res) => {
                if (!cancelled) setPatients(res.items);
            })
            .catch(() => {
                if (!cancelled) toast.error('Could not load patients');
            })
            .finally(() => {
                if (!cancelled) setPatientsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!patientId) {
            setEncounters([]);
            return;
        }
        let cancelled = false;
        setEncountersLoading(true);
        void listActiveEncounters({ patientId })
            .then((res) => {
                if (cancelled) return;
                if (res.ok) setEncounters(res.data);
                else toast.error(res.message);
            })
            .catch(() => {
                if (!cancelled) toast.error('Could not load active encounters');
            })
            .finally(() => {
                if (!cancelled) setEncountersLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [patientId]);

    useEffect(() => {
        if (!patientId || encounterId || encounters.length !== 1) return;
        const only = encounters[0]?.id;
        if (!only) return;
        const next = new URLSearchParams(searchParams);
        next.set('encounterId', only);
        setSearchParams(next, { replace: true });
    }, [patientId, encounterId, encounters, searchParams, setSearchParams]);

    useEffect(() => {
        if (!patientId || encounterId || !adtSession?.encounterId?.trim()) return;
        const next = new URLSearchParams(searchParams);
        next.set('encounterId', adtSession.encounterId.trim());
        setSearchParams(next, { replace: true });
    }, [patientId, encounterId, adtSession?.encounterId, searchParams, setSearchParams]);

    const patientInList = patientId && patients.some((p) => p.id === patientId);
    const encounterInList = encounterId && encounters.some((e) => e.id === encounterId);

    function setPatientSelection(nextPatientId: string) {
        const next = new URLSearchParams(searchParams);
        if (nextPatientId) next.set('patientId', nextPatientId);
        else next.delete('patientId');
        next.delete('encounterId');
        setSearchParams(next);
    }

    function setEncounterSelection(nextEncounterId: string) {
        const next = new URLSearchParams(searchParams);
        if (nextEncounterId) next.set('encounterId', nextEncounterId);
        else next.delete('encounterId');
        setSearchParams(next);
    }

    return (
        <div className="space-y-4">
            <div className="panel p-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Medication management</h1>
                <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                    MAR, PRN/STAT, pharmacy dispensing, and discharge medications. Discharge medication documents are saved per{' '}
                    <strong>encounter</strong> (inpatient admission). Select a patient, then an active encounter, before using the
                    discharge meds tab.
                </p>

                <div className="mt-4 grid max-w-2xl gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Patient</label>
                        <SearchableSelect
                            allowEmpty
                            emptyRowLabel={patientsLoading ? 'Loading patients…' : 'Select patient…'}
                            placeholder={patientsLoading ? 'Loading patients…' : 'Select patient…'}
                            disabled={patientsLoading}
                            value={patientId || ''}
                            pinnedOptions={
                                patientId && !patientInList
                                    ? [
                                          {
                                              value: patientId,
                                              label: `Current selection · ${patientId.slice(-12)}…`,
                                              keywords: patientId,
                                          },
                                      ]
                                    : []
                            }
                            options={patients.map((p) => ({
                                value: p.id,
                                label: `${p.name}${p.mrn ? ` · MRN ${p.mrn}` : ''}`,
                                keywords: `${p.name} ${p.mrn || ''} ${p.id}`,
                            }))}
                            onChange={(v) => setPatientSelection(String(v))}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Encounter</label>
                        <SearchableSelect
                            allowEmpty
                            emptyRowLabel={
                                !patientId
                                    ? 'Select a patient first…'
                                    : encountersLoading
                                      ? 'Loading encounters…'
                                      : 'Select active encounter…'
                            }
                            placeholder="Select active encounter…"
                            disabled={!patientId || encountersLoading}
                            value={encounterId || ''}
                            pinnedOptions={
                                encounterId && !encounterInList && patientId
                                    ? [
                                          {
                                              value: encounterId,
                                              label: `Current selection · …${encounterId.slice(-8)}`,
                                              keywords: encounterId,
                                          },
                                      ]
                                    : []
                            }
                            options={encounters.map((enc) => ({
                                value: enc.id,
                                label: formatEncounterLabel(enc),
                                keywords: `${enc.id} ${enc.patientName || ''}`,
                            }))}
                            onChange={(v) => setEncounterSelection(String(v))}
                        />
                        {patientId && !encountersLoading && encounters.length === 0 ? (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                No active encounter — discharge meds cannot be saved until the patient is admitted.
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            {patientId ? (
                <div className="panel p-4">
                    <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
                        {(
                            [
                                ['mar', 'MAR'],
                                ['prn', 'PRN / STAT'],
                                ['pharmacy', 'Pharmacy'],
                                ['discharge', 'Discharge meds'],
                            ] as const
                        ).map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                className={`rounded px-3 py-1 text-sm ${
                                    tab === id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'
                                }`}
                                onClick={() => setTab(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {tab === 'mar' ? <MarTab patientId={patientId} defaultGivenBy={staffName} /> : null}
                    {tab === 'prn' ? <PrnStatTab patientId={patientId} defaultGivenBy={staffName} /> : null}
                    {tab === 'pharmacy' ? <PharmacyTab patientId={patientId} defaultDispensedBy={staffName} /> : null}
                    {tab === 'discharge' ? (
                        <DischargeMedsTab patientId={patientId} encounterId={encounterId.trim() || undefined} />
                    ) : null}
                </div>
            ) : (
                <div className="panel p-6 text-sm text-gray-600 dark:text-gray-400">
                    Select a patient above to use MAR, PRN/STAT, pharmacy, and discharge medication tools.
                </div>
            )}
        </div>
    );
}
