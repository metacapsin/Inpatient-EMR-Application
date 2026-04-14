import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getPatientsList, type PatientListItem } from '../../../services/patient.service';
import { MarTab } from './MarTab';
import { PrnStatTab } from './PrnStatTab';
import { PharmacyTab } from './PharmacyTab';
import { DischargeMedsTab } from './DischargeMedsTab';
import SearchableSelect from '@/components/ui/SearchableSelect';

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

export default function MedicationManagementPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const patientId = searchParams.get('patientId') || '';

    const [tab, setTab] = useState<TabId>('mar');
    const [patients, setPatients] = useState<PatientListItem[]>([]);
    const [patientsLoading, setPatientsLoading] = useState(false);

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

    const patientInList = patientId && patients.some((p) => p.id === patientId);

    function setPatientSelection(nextPatientId: string) {
        const next = new URLSearchParams(searchParams);
        if (nextPatientId) next.set('patientId', nextPatientId);
        else next.delete('patientId');
        setSearchParams(next);
    }

    return (
        <div className="space-y-4">
            <div className="panel p-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Medication management</h1>
                <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
                    MAR, PRN/STAT, pharmacy dispensing, and discharge medications. Select a patient to load data. APIs use
                    the shared EMR base URL when <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">VITE_MEDICATION_API_MOCK</code>{' '}
                    is not set to <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">false</code>; otherwise an
                    in-memory mock is used.
                </p>

                <div className="mt-4 max-w-md">
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
                    {tab === 'discharge' ? <DischargeMedsTab patientId={patientId} /> : null}
                </div>
            ) : (
                <div className="panel p-6 text-sm text-gray-600 dark:text-gray-400">
                    Select a patient above to use MAR, PRN/STAT, pharmacy, and discharge medication tools.
                </div>
            )}
        </div>
    );
}
