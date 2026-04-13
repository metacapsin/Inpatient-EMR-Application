import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../../lib/httpError';
import * as medApi from '../../../services/medicationManagement.service';
import type { DischargeMedLine } from '../../../types/medicationManagement';
import { Loader2 } from 'lucide-react';

interface DischargeMedsTabProps {
    patientId: string;
}

const emptyLine = (): DischargeMedLine => ({
    name: '',
    dose: '',
    frequency: '',
    duration: '',
    instructions: '',
});

export function DischargeMedsTab({ patientId }: DischargeMedsTabProps) {
    const [lines, setLines] = useState<DischargeMedLine[]>([emptyLine()]);
    const [preparedBy, setPreparedBy] = useState('');
    const [reviewedBy, setReviewedBy] = useState('');
    const [counsellingDone, setCounsellingDone] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await medApi.getDischargeMeds(patientId);
            if (data.medications?.length) {
                setLines(data.medications.map((m) => ({ ...m })));
            } else {
                setLines([emptyLine()]);
            }
            setPreparedBy(data.preparedBy || '');
            setReviewedBy(data.reviewedBy || '');
            setCounsellingDone(Boolean(data.counsellingDone));
        } catch (e) {
            const msg = getApiErrorMessage(e, 'Failed to load discharge medications');
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        void load();
    }, [load]);

    function addRow() {
        setLines((prev) => [...prev, emptyLine()]);
    }

    function removeRow(index: number) {
        setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    }

    function updateLine(index: number, patch: Partial<DischargeMedLine>) {
        setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    }

    function validate(): string | null {
        for (let i = 0; i < lines.length; i++) {
            const r = lines[i];
            if (!r.name.trim() || !r.dose.trim() || !r.frequency.trim() || !r.duration.trim()) {
                return `Row ${i + 1}: name, dose, frequency, and duration are required`;
            }
        }
        if (!preparedBy.trim()) return 'Prepared by is required';
        if (!reviewedBy.trim()) return 'Reviewed by is required';
        return null;
    }

    async function handleSave() {
        if (!patientId) return;
        const v = validate();
        if (v) {
            toast.error(v);
            return;
        }
        setSaving(true);
        try {
            await medApi.postDischarge({
                patientId,
                medications: lines.map((l) => ({
                    name: l.name.trim(),
                    dose: l.dose.trim(),
                    frequency: l.frequency.trim(),
                    duration: l.duration.trim(),
                    instructions: l.instructions.trim(),
                })),
                preparedBy: preparedBy.trim(),
                reviewedBy: reviewedBy.trim(),
                counsellingDone,
            });
            toast.success('Discharge medication list saved');
        } catch (e) {
            toast.error(getApiErrorMessage(e, 'Save failed'));
        } finally {
            setSaving(false);
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
                <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Loading discharge list…
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/80">
                                <tr>
                                    <th className="px-2 py-2">Name</th>
                                    <th className="px-2 py-2">Dose</th>
                                    <th className="px-2 py-2">Frequency</th>
                                    <th className="px-2 py-2">Duration</th>
                                    <th className="px-2 py-2">Instructions</th>
                                    <th className="px-2 py-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {lines.map((row, i) => (
                                    <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                                        <td className="px-2 py-1">
                                            <input
                                                className="h-9 w-36 rounded border border-gray-300 px-1 dark:border-gray-600 dark:bg-gray-800"
                                                value={row.name}
                                                onChange={(e) => updateLine(i, { name: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input
                                                className="h-9 w-24 rounded border border-gray-300 px-1 dark:border-gray-600 dark:bg-gray-800"
                                                value={row.dose}
                                                onChange={(e) => updateLine(i, { dose: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input
                                                className="h-9 w-28 rounded border border-gray-300 px-1 dark:border-gray-600 dark:bg-gray-800"
                                                value={row.frequency}
                                                onChange={(e) => updateLine(i, { frequency: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input
                                                className="h-9 w-24 rounded border border-gray-300 px-1 dark:border-gray-600 dark:bg-gray-800"
                                                value={row.duration}
                                                onChange={(e) => updateLine(i, { duration: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <input
                                                className="h-9 min-w-[140px] rounded border border-gray-300 px-1 dark:border-gray-600 dark:bg-gray-800"
                                                value={row.instructions}
                                                onChange={(e) => updateLine(i, { instructions: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-2 py-1">
                                            <button
                                                type="button"
                                                className="text-xs text-red-600 hover:underline"
                                                onClick={() => removeRow(i)}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button
                        type="button"
                        className="rounded-md border border-dashed border-gray-400 px-3 py-1.5 text-sm dark:border-gray-500"
                        onClick={addRow}
                    >
                        Add medicine
                    </button>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Prepared by
                            </label>
                            <input
                                className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                                value={preparedBy}
                                onChange={(e) => setPreparedBy(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Reviewed by
                            </label>
                            <input
                                className="h-10 w-full rounded-md border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                                value={reviewedBy}
                                onChange={(e) => setReviewedBy(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                                <input
                                    type="checkbox"
                                    checked={counsellingDone}
                                    onChange={(e) => setCounsellingDone(e.target.checked)}
                                />
                                Counselling done
                            </label>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={saving}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        onClick={() => void handleSave()}
                    >
                        {saving ? 'Saving…' : 'Save discharge list'}
                    </button>
                </>
            )}
        </div>
    );
}
