import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import type { CDIWorklistRecord } from '../types/cdi.types';
import { MOCK_PHYSICIANS } from '../types/cdi.types';
import { answerCdiQuery, fetchPhysicianCdiInbox } from '../services/cdi.service';
import NewDropdown from '@/components/ui/NewDropdown';

type Props = {
    tenantId: string;
    defaultPhysicianId?: string;
};

export function PhysicianQueryInbox({ tenantId, defaultPhysicianId }: Props) {
    const [physicianId, setPhysicianId] = useState(defaultPhysicianId || MOCK_PHYSICIANS[0].id);
    const [rows, setRows] = useState<CDIWorklistRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [responses, setResponses] = useState<Record<string, { optionId: string; freeText: string }>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchPhysicianCdiInbox(tenantId, physicianId);
            if (res.ok) setRows(res.data);
            else toast.error(res.message);
        } finally {
            setLoading(false);
        }
    }, [tenantId, physicianId]);

    useEffect(() => {
        void load();
    }, [load]);

    const physicianOptions = MOCK_PHYSICIANS.map((p) => ({ label: p.name, value: p.id }));

    const submitResponse = async (row: CDIWorklistRecord) => {
        const draft = responses[row.queryId] ?? { optionId: '', freeText: '' };
        if (!draft.freeText.trim() && !draft.optionId) {
            toast.error('Select an option or enter a response.');
            return;
        }
        setBusyId(row.queryId);
        try {
            const res = await answerCdiQuery(tenantId, row.queryId, draft.optionId, draft.freeText.trim());
            if (!res.ok) {
                toast.error(res.message);
                return;
            }
            toast.success('Response submitted');
            await load();
        } finally {
            setBusyId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading physician inbox…
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="max-w-xs">
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Physician (mock)
                </label>
                <NewDropdown
                    options={physicianOptions}
                    value={physicianId}
                    onChange={(v) => setPhysicianId(String(v))}
                    placeholder="Select physician"
                />
            </div>

            {rows.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No open queries in inbox.</p>
            ) : (
                rows.map((row) => {
                    const locked = row.responseLocked;
                    const draft = responses[row.queryId] ?? {
                        optionId: row.selectedOptionId,
                        freeText: row.physicianResponse,
                    };
                    return (
                        <div
                            key={row.queryId}
                            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#161412]/80"
                        >
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Query Type</p>
                                    <p className="text-sm text-gray-900 dark:text-white">{row.queryType}</p>
                                </div>
                                <div className="sm:col-span-2">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                        Clinical Scenario
                                    </p>
                                    <p className="text-sm text-gray-800 dark:text-gray-200">
                                        {row.clinicalScenario || '—'}
                                    </p>
                                </div>
                                <div className="sm:col-span-2">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Question</p>
                                    <p className="text-sm text-gray-800 dark:text-gray-200">
                                        {row.questionToPhysician || '—'}
                                    </p>
                                </div>
                                <div className="sm:col-span-2">
                                    <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                        Options to Select
                                    </p>
                                    <div className="space-y-2">
                                        {row.optionsProvided.map((opt) => (
                                            <label
                                                key={opt.id}
                                                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                                                    locked
                                                        ? 'border-gray-100 opacity-70 dark:border-white/5'
                                                        : 'border-gray-200 dark:border-white/10'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={`opt-${row.queryId}`}
                                                    checked={draft.optionId === opt.id}
                                                    disabled={locked}
                                                    onChange={() =>
                                                        setResponses((r) => ({
                                                            ...r,
                                                            [row.queryId]: { ...draft, optionId: opt.id },
                                                        }))
                                                    }
                                                />
                                                {opt.text}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">
                                        Physician Free-Text Response
                                    </label>
                                    <Textarea
                                        value={draft.freeText}
                                        onChange={(e) =>
                                            setResponses((r) => ({
                                                ...r,
                                                [row.queryId]: { ...draft, freeText: e.target.value },
                                            }))
                                        }
                                        disabled={locked}
                                        rows={3}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                            <div className="mt-3">
                                <Button
                                    type="button"
                                    disabled={locked || busyId === row.queryId}
                                    onClick={() => void submitResponse(row)}
                                >
                                    {locked ? 'Response submitted' : 'Sign & Submit Response'}
                                </Button>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
