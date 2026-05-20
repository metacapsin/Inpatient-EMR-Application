import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { toast } from 'sonner';
import type {
    CarePlanDiagnosis,
    CarePlanDocument,
    CarePlanGoal,
    CarePlanGoalStatus,
    CarePlanIntervention,
    FlowsheetCarePlanSuggestion,
    NandaSearchResult,
} from '../types/carePlan.types';
import {
    createCarePlan,
    fetchCarePlan,
    patchGoalStatus,
    saveCarePlan,
    searchNandaDiagnoses,
} from '../api/carePlanWithFallback';
import { validateDiagnosesForSave, todayYmd } from '../utils/carePlanValidation';
import { suggestionsFromFlowsheetSignals } from '../utils/flowsheetSuggestions';

function uid(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type CarePlanSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type CarePlanContextValue = {
    loading: boolean;
    plan: CarePlanDocument | null;
    selectedDiagnosisId: string | null;
    setSelectedDiagnosisId: (id: string | null) => void;
    selectedDiagnosis: CarePlanDiagnosis | null;
    saveState: CarePlanSaveState;
    interdisciplinaryNotes: string;
    setInterdisciplinaryNotes: (v: string) => void;
    suggestions: FlowsheetCarePlanSuggestion[];
    refresh: () => Promise<void>;
    savePlan: () => Promise<void>;
    addDiagnosisFromNanda: (nanda: NandaSearchResult, fields: Partial<CarePlanDiagnosis>) => void;
    updateSelectedDiagnosis: (patch: Partial<CarePlanDiagnosis>) => void;
    addGoal: () => void;
    updateGoal: (goalId: string, patch: Partial<CarePlanGoal>) => void;
    removeGoal: (goalId: string) => void;
    addIntervention: () => void;
    updateIntervention: (interventionId: string, patch: Partial<CarePlanIntervention>) => void;
    removeIntervention: (interventionId: string) => void;
    setGoalStatusOptimistic: (goalId: string, status: CarePlanGoalStatus, evaluationNote?: string) => Promise<void>;
    searchNanda: (q: string) => Promise<NandaSearchResult[]>;
    historySnapshots: CarePlanDocument[];
};

const CarePlanContext = createContext<CarePlanContextValue | null>(null);

export function useCarePlan(): CarePlanContextValue {
    const ctx = useContext(CarePlanContext);
    if (!ctx) throw new Error('useCarePlan must be used within CarePlanProvider');
    return ctx;
}

type CarePlanProviderProps = {
    patientId: string;
    encounterId: string;
    tenantId: string;
    reviewer: { id: string; name: string };
    flowsheetSignals?: { highFallRisk?: boolean; lowBraden?: boolean; painScoreOver7?: boolean };
    children: ReactNode;
};

export function CarePlanProvider({
    patientId,
    encounterId,
    tenantId,
    reviewer,
    flowsheetSignals,
    children,
}: CarePlanProviderProps) {
    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState<CarePlanDocument | null>(null);
    const [selectedDiagnosisId, setSelectedDiagnosisId] = useState<string | null>(null);
    const [interdisciplinaryNotes, setInterdisciplinaryNotes] = useState('');
    const [saveState, setSaveState] = useState<CarePlanSaveState>('idle');
    const [historySnapshots, setHistorySnapshots] = useState<CarePlanDocument[]>([]);
    const baselineRef = useRef('');

    const suggestions = useMemo(
        () => suggestionsFromFlowsheetSignals(flowsheetSignals || {}),
        [flowsheetSignals]
    );

    const markDirty = useCallback(() => {
        setSaveState((s) => (s === 'saving' ? s : 'dirty'));
    }, []);

    const load = useCallback(async () => {
        if (!patientId.trim() || !encounterId.trim()) {
            setPlan(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const doc = await fetchCarePlan(encounterId, patientId, tenantId);
            setPlan(doc ?? null);
            setInterdisciplinaryNotes(doc?.interdisciplinaryNotes || '');
            const firstDx = doc?.diagnoses?.[0]?.id ?? null;
            setSelectedDiagnosisId((cur) => cur || firstDx);
            baselineRef.current = JSON.stringify({ plan: doc, notes: doc?.interdisciplinaryNotes || '' });
            setSaveState('idle');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to load care plan');
            setSaveState('error');
        } finally {
            setLoading(false);
        }
    }, [encounterId, patientId, tenantId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!plan) return;
        const snap = JSON.stringify({ plan, notes: interdisciplinaryNotes });
        if (snap !== baselineRef.current && saveState !== 'saving') {
            setSaveState('dirty');
        }
    }, [plan, interdisciplinaryNotes, saveState]);

    const selectedDiagnosis = useMemo(
        () => plan?.diagnoses.find((d) => d.id === selectedDiagnosisId) ?? null,
        [plan, selectedDiagnosisId]
    );

    const updatePlanDiagnoses = useCallback(
        (updater: (list: CarePlanDiagnosis[]) => CarePlanDiagnosis[]) => {
            setPlan((prev) => {
                if (!prev) return prev;
                return { ...prev, diagnoses: updater(prev.diagnoses) };
            });
            markDirty();
        },
        [markDirty]
    );

    const savePlan = useCallback(async () => {
        if (!plan) return;
        const diagnoses = plan.diagnoses;
        const err = validateDiagnosesForSave(diagnoses);
        if (err) {
            toast.error(err);
            return;
        }
        setSaveState('saving');
        try {
            const payload = {
                tenantId,
                encounterId,
                diagnoses,
                interdisciplinaryNotes,
                lastReviewedBy: reviewer.id,
                lastReviewedByName: reviewer.name,
            };
            let saved: CarePlanDocument;
            if (!plan.version || plan.version < 1) {
                saved = await createCarePlan(
                    { patientId, encounterId, tenantId, diagnoses, interdisciplinaryNotes },
                    reviewer
                );
            } else {
                saved = await saveCarePlan(plan.id, payload, reviewer);
            }
            setPlan(saved);
            setHistorySnapshots((h) => [saved, ...h].slice(0, 12));
            baselineRef.current = JSON.stringify({ plan: saved, notes: saved.interdisciplinaryNotes });
            setSaveState('saved');
            toast.success(`Care plan saved · v${saved.version}`);
            window.setTimeout(() => setSaveState('idle'), 2000);
        } catch (e) {
            setSaveState('error');
            toast.error(e instanceof Error ? e.message : 'Save failed');
        }
    }, [plan, tenantId, encounterId, interdisciplinaryNotes, reviewer, patientId]);

    const addDiagnosisFromNanda = useCallback(
        (nanda: NandaSearchResult, fields: Partial<CarePlanDiagnosis>) => {
            const dx: CarePlanDiagnosis = {
                id: uid('dx'),
                nandaCode: nanda.code,
                nandaLabel: nanda.label,
                relatedTo: fields.relatedTo || '',
                evidencedBy: fields.evidencedBy || '',
                priority: fields.priority || 'Medium',
                goals: fields.goals || [],
                interventions: fields.interventions || [],
                addedAt: new Date().toISOString(),
                addedBy: reviewer.name,
                status: fields.status || 'Active',
            };
            updatePlanDiagnoses((list) => [...list, dx]);
            setSelectedDiagnosisId(dx.id);
            toast.success('Diagnosis added to care plan');
        },
        [reviewer.name, updatePlanDiagnoses]
    );

    const updateSelectedDiagnosis = useCallback(
        (patch: Partial<CarePlanDiagnosis>) => {
            if (!selectedDiagnosisId) return;
            updatePlanDiagnoses((list) =>
                list.map((d) => (d.id === selectedDiagnosisId ? { ...d, ...patch } : d))
            );
        },
        [selectedDiagnosisId, updatePlanDiagnoses]
    );

    const addGoal = useCallback(() => {
        if (!selectedDiagnosisId) return;
        const g: CarePlanGoal = {
            id: uid('goal'),
            statement: '',
            targetDate: todayYmd(),
            status: 'Not Met',
            evaluationNote: '',
        };
        updatePlanDiagnoses((list) =>
            list.map((d) => (d.id === selectedDiagnosisId ? { ...d, goals: [...d.goals, g] } : d))
        );
    }, [selectedDiagnosisId, updatePlanDiagnoses]);

    const updateGoal = useCallback(
        (goalId: string, patch: Partial<CarePlanGoal>) => {
            if (!selectedDiagnosisId) return;
            updatePlanDiagnoses((list) =>
                list.map((d) =>
                    d.id === selectedDiagnosisId
                        ? { ...d, goals: d.goals.map((g) => (g.id === goalId ? { ...g, ...patch } : g)) }
                        : d
                )
            );
        },
        [selectedDiagnosisId, updatePlanDiagnoses]
    );

    const removeGoal = useCallback(
        (goalId: string) => {
            if (!selectedDiagnosisId) return;
            updatePlanDiagnoses((list) =>
                list.map((d) =>
                    d.id === selectedDiagnosisId ? { ...d, goals: d.goals.filter((g) => g.id !== goalId) } : d
                )
            );
        },
        [selectedDiagnosisId, updatePlanDiagnoses]
    );

    const addIntervention = useCallback(() => {
        if (!selectedDiagnosisId) return;
        const i: CarePlanIntervention = {
            id: uid('int'),
            text: '',
            frequency: 'Daily',
            responsibleDiscipline: 'RN',
            status: 'Active',
        };
        updatePlanDiagnoses((list) =>
            list.map((d) =>
                d.id === selectedDiagnosisId ? { ...d, interventions: [...d.interventions, i] } : d
            )
        );
    }, [selectedDiagnosisId, updatePlanDiagnoses]);

    const updateIntervention = useCallback(
        (interventionId: string, patch: Partial<CarePlanIntervention>) => {
            if (!selectedDiagnosisId) return;
            updatePlanDiagnoses((list) =>
                list.map((d) =>
                    d.id === selectedDiagnosisId
                        ? {
                              ...d,
                              interventions: d.interventions.map((i) =>
                                  i.id === interventionId ? { ...i, ...patch } : i
                              ),
                          }
                        : d
                )
            );
        },
        [selectedDiagnosisId, updatePlanDiagnoses]
    );

    const removeIntervention = useCallback(
        (interventionId: string) => {
            if (!selectedDiagnosisId) return;
            updatePlanDiagnoses((list) =>
                list.map((d) =>
                    d.id === selectedDiagnosisId
                        ? { ...d, interventions: d.interventions.filter((i) => i.id !== interventionId) }
                        : d
                )
            );
        },
        [selectedDiagnosisId, updatePlanDiagnoses]
    );

    const setGoalStatusOptimistic = useCallback(
        async (goalId: string, status: CarePlanGoalStatus, evaluationNote?: string) => {
            if (!plan || !selectedDiagnosisId) return;
            updateGoal(goalId, { status, evaluationNote: evaluationNote ?? '' });
            if (plan.version < 1) return;
            try {
                const saved = await patchGoalStatus(
                    plan.id,
                    encounterId,
                    { diagnosisId: selectedDiagnosisId, goalId, status, evaluationNote },
                    reviewer
                );
                setPlan(saved);
                baselineRef.current = JSON.stringify({ plan: saved, notes: saved.interdisciplinaryNotes });
            } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Goal update failed');
                void load();
            }
        },
        [plan, selectedDiagnosisId, updateGoal, encounterId, reviewer, load]
    );

    const value: CarePlanContextValue = {
        loading,
        plan,
        selectedDiagnosisId,
        setSelectedDiagnosisId,
        selectedDiagnosis,
        saveState,
        interdisciplinaryNotes,
        setInterdisciplinaryNotes,
        suggestions,
        refresh: load,
        savePlan,
        addDiagnosisFromNanda,
        updateSelectedDiagnosis,
        addGoal,
        updateGoal,
        removeGoal,
        addIntervention,
        updateIntervention,
        removeIntervention,
        setGoalStatusOptimistic,
        searchNanda: searchNandaDiagnoses,
        historySnapshots,
    };

    return <CarePlanContext.Provider value={value}>{children}</CarePlanContext.Provider>;
}
