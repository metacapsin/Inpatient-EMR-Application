import { useId, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import AppButton from '@/components/ui/AppButton';
import {
    CARE_PLAN_DISCIPLINES,
    CARE_PLAN_GOAL_STATUSES,
    CARE_PLAN_INTERVENTION_FREQUENCIES,
    CARE_PLAN_INTERVENTION_STATUSES,
    CARE_PLAN_DIAGNOSIS_STATUSES,
    CARE_PLAN_PRIORITIES,
} from '../constants/carePlanOptions';
import { useCarePlan } from '../state/CarePlanContext';
import { isPastTargetDate } from '../utils/carePlanValidation';
import { CarePlanTabStrip, type CarePlanTabId } from './CarePlanTabStrip';
import {
    CarePlanDropdown,
    CarePlanDateField,
    CarePlanTextarea,
    CARE_PLAN_SECTION_CARD_CLASS,
    CarePlanFieldRow,
} from './CarePlanStyledFields';

function parseCalDate(ymd: string): Date | null {
    if (!ymd) return null;
    const d = new Date(`${ymd}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function CarePlanDetailTabs() {
    const baseId = useId();
    const [tab, setTab] = useState<CarePlanTabId>('goals');
    const {
        selectedDiagnosis,
        updateSelectedDiagnosis,
        addGoal,
        updateGoal,
        removeGoal,
        addIntervention,
        updateIntervention,
        removeIntervention,
        setGoalStatusOptimistic,
        historySnapshots,
        plan,
    } = useCarePlan();

    if (!selectedDiagnosis) {
        return (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-gray-500 dark:text-gray-400">
                Select a diagnosis from the list to manage goals and interventions.
            </div>
        );
    }

    const historyEvents = historySnapshots.map((snap) => ({
        version: snap.version,
        at: snap.lastReviewedAt,
        by: snap.lastReviewedByName,
        count: snap.diagnoses.length,
    }));

    return (
        <div className="flex min-h-0 flex-1 flex-col p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">{selectedDiagnosis.nandaLabel}</h2>
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{selectedDiagnosis.nandaCode}</p>
                </div>
                <div className="flex min-w-[12rem] flex-wrap gap-2 sm:min-w-[16rem]">
                    <CarePlanDropdown
                        fieldId={`${baseId}-dx-priority`}
                        label="Priority"
                        value={selectedDiagnosis.priority}
                        options={CARE_PLAN_PRIORITIES.map((p) => ({ label: p, value: p }))}
                        onChange={(v) => updateSelectedDiagnosis({ priority: String(v) as typeof selectedDiagnosis.priority })}
                    />
                    <CarePlanDropdown
                        fieldId={`${baseId}-dx-status`}
                        label="Status"
                        value={selectedDiagnosis.status}
                        options={CARE_PLAN_DIAGNOSIS_STATUSES.map((s) => ({ label: s, value: s }))}
                        onChange={(v) => updateSelectedDiagnosis({ status: String(v) as typeof selectedDiagnosis.status })}
                    />
                </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <CarePlanTextarea
                    fieldId={`${baseId}-related`}
                    label="Related to"
                    value={selectedDiagnosis.relatedTo}
                    onChange={(v) => updateSelectedDiagnosis({ relatedTo: v })}
                />
                <CarePlanTextarea
                    fieldId={`${baseId}-evidence`}
                    label="Evidenced by"
                    value={selectedDiagnosis.evidencedBy}
                    onChange={(v) => updateSelectedDiagnosis({ evidencedBy: v })}
                />
            </div>

            <CarePlanTabStrip tab={tab} onTabChange={setTab} />

            {tab === 'goals' ? (
                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
                    <div className="mb-2 flex justify-end">
                        <AppButton type="button" onClick={addGoal}>
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            Add goal
                        </AppButton>
                    </div>
                    <div className="space-y-3">
                        {selectedDiagnosis.goals.map((g) => (
                            <div key={g.id} className={CARE_PLAN_SECTION_CARD_CLASS}>
                                <CarePlanTextarea
                                    fieldId={`${baseId}-goal-${g.id}`}
                                    label="Goal statement"
                                    value={g.statement}
                                    onChange={(v) => updateGoal(g.id, { statement: v })}
                                />
                                <CarePlanFieldRow className="mt-3 !grid-cols-1 sm:!grid-cols-3">
                                    <CarePlanDateField
                                        fieldId={`${baseId}-goal-date-${g.id}`}
                                        label="Target date"
                                        value={parseCalDate(g.targetDate)}
                                        hasError={isPastTargetDate(g.targetDate)}
                                        onChange={(d) => {
                                            if (!d) return;
                                            updateGoal(g.id, { targetDate: d.toISOString().slice(0, 10) });
                                        }}
                                    />
                                    <CarePlanDropdown
                                        fieldId={`${baseId}-goal-status-${g.id}`}
                                        label="Status"
                                        value={g.status}
                                        options={CARE_PLAN_GOAL_STATUSES.map((s) => ({ label: s, value: s }))}
                                        onChange={(v) =>
                                            void setGoalStatusOptimistic(g.id, String(v) as typeof g.status, g.evaluationNote)
                                        }
                                    />
                                    <div className="flex items-end justify-end">
                                        <button
                                            type="button"
                                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200/80 px-2 text-[11px] font-semibold text-rose-800 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-200 dark:hover:bg-rose-950/40"
                                            onClick={() => removeGoal(g.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                            Remove
                                        </button>
                                    </div>
                                </CarePlanFieldRow>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {tab === 'interventions' ? (
                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
                    <div className="mb-2 flex justify-end">
                        <AppButton type="button" onClick={addIntervention}>
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            Add intervention
                        </AppButton>
                    </div>
                    <div className="space-y-3">
                        {selectedDiagnosis.interventions.map((i) => (
                            <div key={i.id} className={CARE_PLAN_SECTION_CARD_CLASS}>
                                <CarePlanTextarea
                                    fieldId={`${baseId}-int-${i.id}`}
                                    label="Intervention"
                                    value={i.text}
                                    onChange={(v) => updateIntervention(i.id, { text: v })}
                                />
                                <CarePlanFieldRow className="mt-3">
                                    <CarePlanDropdown
                                        fieldId={`${baseId}-int-freq-${i.id}`}
                                        label="Frequency"
                                        value={i.frequency}
                                        options={CARE_PLAN_INTERVENTION_FREQUENCIES.map((f) => ({ label: f, value: f }))}
                                        onChange={(v) =>
                                            updateIntervention(i.id, {
                                                frequency: String(v) as typeof i.frequency,
                                            })
                                        }
                                    />
                                    <CarePlanDropdown
                                        fieldId={`${baseId}-int-disc-${i.id}`}
                                        label="Discipline"
                                        value={i.responsibleDiscipline}
                                        options={CARE_PLAN_DISCIPLINES.map((d) => ({ label: d, value: d }))}
                                        onChange={(v) =>
                                            updateIntervention(i.id, {
                                                responsibleDiscipline: String(v) as typeof i.responsibleDiscipline,
                                            })
                                        }
                                    />
                                    <CarePlanDropdown
                                        fieldId={`${baseId}-int-st-${i.id}`}
                                        label="Status"
                                        value={i.status}
                                        options={CARE_PLAN_INTERVENTION_STATUSES.map((s) => ({ label: s, value: s }))}
                                        onChange={(v) =>
                                            updateIntervention(i.id, { status: String(v) as typeof i.status })
                                        }
                                    />
                                </CarePlanFieldRow>
                                <div className="mt-2 flex justify-end">
                                    <button
                                        type="button"
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200/80 px-2 text-[11px] font-semibold text-rose-800 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-200 dark:hover:bg-rose-950/40"
                                        onClick={() => removeIntervention(i.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {tab === 'evaluation' ? (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto [scrollbar-width:thin]">
                    {selectedDiagnosis.goals.map((g) => (
                        <div key={g.id} className={CARE_PLAN_SECTION_CARD_CLASS}>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{g.statement || '—'}</p>
                            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                                Target {g.targetDate} · {g.status}
                            </p>
                            <div className="mt-2">
                                <CarePlanTextarea
                                    fieldId={`${baseId}-eval-${g.id}`}
                                    label="Evaluation note"
                                    value={g.evaluationNote}
                                    rows={3}
                                    placeholder="Daily evaluation — patient response, barriers, revisions…"
                                    onChange={(v) => updateGoal(g.id, { evaluationNote: v })}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {tab === 'history' ? (
                <div className="min-h-0 flex-1 overflow-y-auto text-xs [scrollbar-width:thin]">
                    {historyEvents.length ? (
                        <ul className="space-y-2 border-l-2 border-primary/30 pl-3">
                            {historyEvents.map((item, idx) => (
                                <li key={`${item.version}-${idx}`} className="relative">
                                    <span className="absolute -left-[0.4rem] top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden />
                                    <p className="font-semibold text-gray-900 dark:text-gray-100">Version {item.version}</p>
                                    <p className="text-gray-500 dark:text-gray-400">
                                        {item.by} · {item.count} diagnoses
                                        {item.at ? ` · ${format(new Date(item.at), 'MM/dd/yy HH:mm')}` : ''}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : plan?.lastReviewedAt ? (
                        <p className="text-gray-500 dark:text-gray-400">
                            Last reviewed {plan.lastReviewedByName} at{' '}
                            {format(new Date(plan.lastReviewedAt), 'MM/dd/yy HH:mm')}
                        </p>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400">Version history appears after the first save.</p>
                    )}
                </div>
            ) : null}
        </div>
    );
}
