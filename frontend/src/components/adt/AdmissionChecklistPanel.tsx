import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';

type ChecklistItem = {
    id: string;
    label: string;
    completed: boolean;
    detail?: string;
    overdue?: boolean;
};

type ChecklistResponse = {
    encounterId: string;
    items: ChecklistItem[];
    completedCount: number;
    totalCount: number;
};

async function fetchChecklist(encounterId: string): Promise<ChecklistResponse> {
    const { data } = await api.get<{ data: ChecklistResponse }>(`/api/admissions/${encodeURIComponent(encounterId)}/checklist`);
    return data.data;
}

/**
 * Admission checklist (Bucket C) — computed from real data server-side, not a manually self-checked
 * list. "Allergies reviewed" can also be attested here when the patient genuinely has none on file.
 */
export function AdmissionChecklistPanel({ encounterId }: { encounterId: string }) {
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: ['admission-checklist', encounterId],
        queryFn: () => fetchChecklist(encounterId),
        enabled: Boolean(encounterId),
    });

    if (!encounterId || query.isLoading) return null;
    if (query.isError || !query.data) return null;

    const { items, completedCount, totalCount } = query.data;
    const allergiesItem = items.find((i) => i.id === 'allergies');

    async function reviewAllergies() {
        try {
            await api.post(`/api/admissions/${encodeURIComponent(encounterId)}/allergies-reviewed`, {});
            await queryClient.invalidateQueries({ queryKey: ['admission-checklist', encounterId] });
        } catch {
            toast.error('Could not save allergy review');
        }
    }

    return (
        <div className="rounded-lg border border-gray-200/80 bg-gray-50/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Admission checklist</h4>
                <span className="text-xs text-gray-500">{completedCount}/{totalCount} complete</span>
            </div>
            <ul className="mt-2 space-y-1.5">
                {items.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 text-xs">
                        {item.completed ? (
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                        ) : (
                            <Circle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.overdue ? 'text-red-600' : 'text-gray-400'}`} aria-hidden />
                        )}
                        <span className={item.completed ? 'text-gray-700 dark:text-gray-300' : item.overdue ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
                            {item.label}
                            {item.detail ? <span className="text-gray-400"> · {item.detail}</span> : null}
                            {item.overdue ? ' (overdue)' : ''}
                        </span>
                        {item.id === 'allergies' && !allergiesItem?.completed ? (
                            <button
                                type="button"
                                className="ml-auto shrink-0 text-[11px] font-semibold text-primary hover:underline"
                                onClick={() => void reviewAllergies()}
                            >
                                Mark reviewed — none known
                            </button>
                        ) : null}
                    </li>
                ))}
            </ul>
        </div>
    );
}
