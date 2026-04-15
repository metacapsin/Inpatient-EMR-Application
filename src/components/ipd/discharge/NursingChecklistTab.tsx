import React, { memo, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ChecklistTask } from '../../../types/dischargeReadiness';
import { useDischargeReadinessOptional } from '../../../contexts/DischargeReadinessContext';

type Props = {
    tasks: ChecklistTask[];
    canEdit: boolean;
    onUpdateTask: (taskId: string, patch: Partial<Pick<ChecklistTask, 'completed' | 'notes'>>) => Promise<boolean>;
};

function TaskRow({
    t,
    canEdit,
    onUpdateTask,
    highlight,
}: {
    t: ChecklistTask;
    canEdit: boolean;
    onUpdateTask: Props['onUpdateTask'];
    highlight: boolean;
}) {
    const [notesLocal, setNotesLocal] = useState(t.notes);

    useEffect(() => {
        setNotesLocal(t.notes);
    }, [t.notes]);

    const showHighlight = highlight && t.blocksDischarge && !t.completed;

    return (
        <li
            className={cn(
                'rounded-lg border p-3 dark:border-gray-700',
                showHighlight
                    ? 'border-amber-400 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/25'
                    : 'border-gray-200 dark:border-gray-700',
            )}
        >
            <div className="flex items-start gap-3">
                <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                    checked={t.completed}
                    disabled={!canEdit}
                    onChange={(e) => void onUpdateTask(t.id, { completed: e.target.checked })}
                />
                <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">{t.label}</div>
                    {t.blocksDischarge ? (
                        <span className="mt-1 inline-block text-xs font-medium text-amber-800 dark:text-amber-200">
                            Required for discharge
                        </span>
                    ) : null}
                    <textarea
                        className="mt-2 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        rows={2}
                        placeholder="Notes"
                        disabled={!canEdit}
                        value={notesLocal}
                        onChange={(e) => setNotesLocal(e.target.value)}
                        onBlur={() => {
                            if (notesLocal !== t.notes) void onUpdateTask(t.id, { notes: notesLocal });
                        }}
                    />
                </div>
            </div>
        </li>
    );
}

function NursingChecklistTabInner({ tasks, canEdit, onUpdateTask }: Props) {
    const ctx = useDischargeReadinessOptional();
    const highlight = useMemo(() => {
        const g = ctx?.snapshot.gates.find((x) => x.id === 'gate-nursing-checklist');
        return Boolean(g && !g.resolved && g.severity === 'hard');
    }, [ctx?.snapshot]);

    return (
        <div className="space-y-3" data-nursing-checklist-tab>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Required items must be completed before the clinical discharge track clears. Incomplete items appear as hard blockers in the
                readiness header.
            </p>
            <ul className="space-y-3">
                {tasks.map((t) => (
                    <TaskRow key={t.id} t={t} canEdit={canEdit} onUpdateTask={onUpdateTask} highlight={highlight} />
                ))}
            </ul>
            {!canEdit ? <p className="text-sm text-gray-500">Your role cannot update the nursing checklist.</p> : null}
        </div>
    );
}

export const NursingChecklistTab = memo(NursingChecklistTabInner);
