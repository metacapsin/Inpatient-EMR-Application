import { useState } from 'react';
import { Plus } from 'lucide-react';
import AppButton from '@/components/ui/AppButton';
import { useCarePlan } from '../state/CarePlanContext';
import { CarePlanDiagnosisCard } from './CarePlanDiagnosisCard';
import { CarePlanAddDiagnosisDialog } from './CarePlanAddDiagnosisDialog';

export function CarePlanDiagnosisList() {
    const { plan, selectedDiagnosisId, setSelectedDiagnosisId } = useCarePlan();
    const [addOpen, setAddOpen] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const diagnoses = plan?.diagnoses || [];

    return (
        <aside className="flex min-h-0 flex-col border-r border-gray-200/90 bg-gray-50/50 dark:border-white/10 dark:bg-[#0c0a08]/40 lg:w-[30%] lg:max-w-[360px] lg:shrink-0">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200/80 px-3 py-2.5 dark:border-white/10">
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">Diagnoses</h2>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{diagnoses.length} on care plan</p>
                </div>
                <AppButton type="button" className="!h-8 !px-2.5 !text-[11px]" onClick={() => setAddOpen(true)}>
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Add
                </AppButton>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 [scrollbar-width:thin]">
                {diagnoses.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
                        No NANDA diagnoses yet. Add from nursing suggestions or search.
                    </p>
                ) : (
                    diagnoses.map((d) => (
                        <CarePlanDiagnosisCard
                            key={d.id}
                            diagnosis={d}
                            selected={d.id === selectedDiagnosisId}
                            collapsed={Boolean(collapsed[d.id])}
                            onToggleCollapse={() =>
                                setCollapsed((c) => ({ ...c, [d.id]: !c[d.id] }))
                            }
                            onSelect={() => setSelectedDiagnosisId(d.id)}
                        />
                    ))
                )}
            </div>
            <CarePlanAddDiagnosisDialog visible={addOpen} onHide={() => setAddOpen(false)} />
        </aside>
    );
}
