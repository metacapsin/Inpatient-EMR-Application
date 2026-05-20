import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, IRootState } from '../../store';
import { fetchFacesheetPatient } from '../../store/facesheetSlice';
import { mergeActiveEncountersFromServer } from '../../store/adtEncounterSlice';
import { activeEncounterRowsToAdtMergePayload, listActiveEncounters } from '../../services/adt.service';
import { Loader2 } from 'lucide-react';
import { EncounterHeader } from '../../components/facesheet/EncounterHeader';
import { ModuleContainer } from '../../components/facesheet/ModuleContainer';
import { FacesheetModuleTabs } from '../../components/facesheet/FacesheetModuleTabs';
import { FacesheetEmptyState } from '../../components/facesheet/FacesheetEmptyState';
import { FacesheetChartNav } from '../../components/Layouts/FacesheetChartNav';

const Demographic = lazy(() => import('../patient/Demographic'));
const Vitals = lazy(() => import('../patient/Vitals'));
const History = lazy(() => import('../patient/History'));
const Diagnoses = lazy(() => import('../patient/Diagnoses'));
const Medications = lazy(() => import('../patient/Medications'));
const Prescriptions = lazy(() => import('../patient/Prescriptions'));
const Allergies = lazy(() => import('../patient/Allergies'));
const Immunizations = lazy(() => import('../patient/Immunizations'));
const Labs = lazy(() => import('../patient/Labs'));
const LabOrders = lazy(() => import('../patient/LabOrders'));
const Documents = lazy(() => import('../patient/Documents'));
const Notes = lazy(() => import('../patient/Notes'));
const PreventiveScreening = lazy(() => import('../patient/PreventiveScreening'));
const VisitorsContacts = lazy(() => import('../patient/VisitorsContacts'));
const PatientLocation = lazy(() => import('../patient/PatientLocation'));
const Adt = lazy(() => import('../patient/Adt'));
const NursingFlowsheetPage = lazy(() => import('./NursingFlowsheetPage'));
const CarePlanFacesheetRedirect = lazy(() =>
    import('../inpatient/CarePlanPage').then((m) => ({ default: m.CarePlanFacesheetRedirect }))
);
const DietaryTab = lazy(() => import('./DietaryTab'));
const Radiology = lazy(() => import('../patient/Radiology'));

function ModuleFallback() {
    return (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary/80" aria-hidden />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading module…</p>
        </div>
    );
}

const FacesheetPage = () => {
    const { id } = useParams<{ id: string }>();
    const dispatch = useDispatch<AppDispatch>();
    const { patient, loading, error } = useSelector((s: IRootState) => s.facesheet);

    useEffect(() => {
        if (!id?.trim()) return;
        dispatch(fetchFacesheetPatient(id.trim()));
    }, [id, dispatch]);

    useEffect(() => {
        const pid = id?.trim();
        if (!pid) return;
        let cancelled = false;
        void (async () => {
            const res = await listActiveEncounters({ patientId: pid });
            if (cancelled || !res.ok) return;
            dispatch(mergeActiveEncountersFromServer(activeEncounterRowsToAdtMergePayload(res.data)));
        })();
        return () => {
            cancelled = true;
        };
    }, [id, dispatch]);

    if (!id?.trim()) {
        return <Navigate to="/app/patients/list" replace />;
    }

    const base = `/app/facesheet/${encodeURIComponent(id.trim())}`;

    if (loading && !patient) {
        return (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-2">
                <div className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
                <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden text-gray-900 dark:text-gray-100">
            {patient ? (
                <div className="flex shrink-0 flex-col">
                    <EncounterHeader patient={patient} />
                    <FacesheetModuleTabs
                        base={base}
                        className="shrink-0 border-b border-emr-border bg-emr-sidebar px-2 py-2 dark:border-white/10 lg:hidden"
                    />
                </div>
            ) : error ? (
                <div className="shrink-0 border-b border-amber-200/80 bg-amber-50 px-4 py-2.5 dark:border-amber-800/40 dark:bg-amber-950/30">
                    <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                        Patient header unavailable
                    </p>
                    <p className="mt-0.5 text-xs text-amber-900/90 dark:text-amber-200/90">{error}</p>
                    <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
                        Chart modules below are still available (e.g. lab orders, radiology).
                    </p>
                </div>
            ) : (
                <FacesheetEmptyState
                    title="No patient data"
                    description="We could not display a header for this record. You can still open chart modules from the sidebar."
                />
            )}

            <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden border-t border-emr-border dark:border-white/10">
                <FacesheetChartNav />
                <ModuleContainer>
                    <Suspense fallback={<ModuleFallback />}>
                    <Routes>
                        <Route index element={<Navigate to="demographic" replace />} />
                        <Route path="demographic" element={<Demographic />} />
                        <Route path="dietary" element={<DietaryTab />} />
                        <Route path="vitals" element={<Vitals />} />
                        <Route path="location" element={<PatientLocation />} />
                        <Route path="adt" element={<Adt />} />
                        <Route path="history" element={<History />} />
                        <Route path="diagnoses" element={<Diagnoses />} />
                        <Route path="medications" element={<Medications />} />
                        <Route path="prescriptions" element={<Prescriptions />} />
                        <Route path="allergies" element={<Allergies />} />
                        <Route path="immunizations" element={<Immunizations />} />
                        <Route path="risk-assessments" element={<Navigate to={`${base}/clinical/nursing-flowsheet?sub=risk`} replace />} />
                        <Route path="clinical/nursing-flowsheet" element={<NursingFlowsheetPage />} />
                        <Route path="clinical/care-plan" element={<CarePlanFacesheetRedirect />} />
                        <Route path="labs" element={<Labs />} />
                        <Route path="lab-orders" element={<LabOrders />} />
                        <Route path="radiology" element={<Radiology />} />
                        <Route path="clinical/unified-orders" element={<Navigate to="../../radiology" replace />} />
                        <Route path="documents" element={<Documents />} />
                        <Route path="notes" element={<Notes />} />
                        <Route path="preventive-screening" element={<PreventiveScreening />} />
                        <Route path="visitors-contacts" element={<VisitorsContacts />} />
                        <Route path="*" element={<Navigate to="demographic" replace />} />
                    </Routes>
                </Suspense>
                </ModuleContainer>
            </div>
        </div>
    );
};

export default FacesheetPage;
