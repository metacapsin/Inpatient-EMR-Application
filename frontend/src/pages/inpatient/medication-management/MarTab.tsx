import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../../lib/httpError';
import * as medApi from '../../../services/medicationManagement.service';
import type { MarRow, PatientMedicationRow } from '../../../types/medicationManagement';
import { Loader2 } from 'lucide-react';

interface MarTabProps {
    patientId: string;
    defaultGivenBy: string;
}

export function MarTab({ patientId, defaultGivenBy }: MarTabProps) {
    const [medications, setMedications] = useState<PatientMedicationRow[]>([]);
    const [marRows, setMarRows] = useState<MarRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [giveTarget, setGiveTarget] = useState<MarRow | null>(null);
    const [givenTime, setGivenTime] = useState('');
    const [givenBy, setGivenBy] = useState(defaultGivenBy);
    const [remarks, setRemarks] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError(null);
        try {
            const [meds, mar] = await Promise.all([medApi.getPatientMedications(patientId), medApi.getMar(patientId)]);
            setMedications(meds);
            setMarRows(mar);
        } catch (e) {
            const msg = getApiErrorMessage(e, 'Failed to load MAR data');
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        setGivenBy(defaultGivenBy);
    }, [defaultGivenBy]);

    function openGive(row: MarRow) {
        setGiveTarget(row);
        const now = new Date();
        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setGivenTime(local);
        setRemarks('');
    }

    async function confirmGive() {
        if (!giveTarget || !patientId) return;
        if (!givenBy.trim()) {
            toast.error('Given by is required');
            return;
        }
        setSubmitting(true);
        try {
            const givenIso = givenTime ? new Date(givenTime).toISOString() : new Date().toISOString();
            const updated = await medApi.postMar({
                patientId,
                medicationId: giveTarget.medicationId,
                scheduledTime: giveTarget.scheduledTime,
                givenTime: givenIso,
                givenBy: givenBy.trim(),
                status: 'given',
                remarks: remarks.trim() || undefined,
            });
            setMarRows(updated);
            setGiveTarget(null);
            toast.success('Medication administration recorded');
            void medApi.getPatientMedications(patientId).then(setMedications).catch(() => {});
        } catch (e) {
            toast.error(getApiErrorMessage(e, 'Failed to record administration'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                    <span>Loading medications and MAR…</span>
                </div>
            ) : (
                <>
                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Active medications</h3>
                        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800/80">
                                    <tr>
                                        <th className="px-3 py-2">Name</th>
                                        <th className="px-3 py-2">Dose</th>
                                        <th className="px-3 py-2">Route</th>
                                        <th className="px-3 py-2">Frequency</th>
                                        <th className="px-3 py-2">Next due</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {medications.map((m) => (
                                        <tr key={m.id} className="border-t border-gray-100 dark:border-gray-700">
                                            <td className="px-3 py-2">{m.name}</td>
                                            <td className="px-3 py-2">{m.dose || '—'}</td>
                                            <td className="px-3 py-2">{m.route || '—'}</td>
                                            <td className="px-3 py-2">{m.frequency || '—'}</td>
                                            <td className="px-3 py-2">
                                                {m.nextScheduledTime
                                                    ? new Date(m.nextScheduledTime).toLocaleString()
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {medications.length === 0 ? (
                                <p className="p-4 text-sm text-gray-500">No medications for this patient.</p>
                            ) : null}
                        </div>
                    </div>

                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Medication administration (MAR)</h3>
                        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800/80">
                                    <tr>
                                        <th className="px-3 py-2">Medication</th>
                                        <th className="px-3 py-2">Scheduled</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2">Given</th>
                                        <th className="px-3 py-2">By</th>
                                        <th className="px-3 py-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {marRows.map((r) => (
                                        <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                                            <td className="px-3 py-2">{r.medicationName}</td>
                                            <td className="px-3 py-2">{new Date(r.scheduledTime).toLocaleString()}</td>
                                            <td className="px-3 py-2 capitalize">{r.status}</td>
                                            <td className="px-3 py-2">
                                                {r.givenTime ? new Date(r.givenTime).toLocaleString() : '—'}
                                            </td>
                                            <td className="px-3 py-2">{r.givenBy || '—'}</td>
                                            <td className="px-3 py-2">
                                                {r.status === 'due' ? (
                                                    <button
                                                        type="button"
                                                        className="rounded bg-primary px-2 py-1 text-xs font-medium text-white"
                                                        onClick={() => openGive(r)}
                                                    >
                                                        Give
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {marRows.length === 0 ? (
                                <p className="p-4 text-sm text-gray-500">No MAR rows.</p>
                            ) : null}
                        </div>
                    </div>
                </>
            )}

            {giveTarget ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    role="dialog"
                    aria-modal
                    aria-labelledby="mar-give-title"
                >
                    <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg dark:bg-gray-900">
                        <h4 id="mar-give-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Record administration
                        </h4>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{giveTarget.medicationName}</p>
                        <div className="mt-4 space-y-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Given time
                                </label>
                                <input
                                    type="datetime-local"
                                    className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                                    value={givenTime}
                                    onChange={(e) => setGivenTime(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Given by
                                </label>
                                <input
                                    type="text"
                                    className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                                    value={givenBy}
                                    onChange={(e) => setGivenBy(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Remarks
                                </label>
                                <input
                                    type="text"
                                    className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
                                onClick={() => setGiveTarget(null)}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                                onClick={() => void confirmGive()}
                                disabled={submitting}
                            >
                                {submitting ? 'Saving…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
