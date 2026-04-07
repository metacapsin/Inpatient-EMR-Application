import { lazy, Suspense, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, IRootState } from '../../store';
import { fetchFacesheetPatient } from '../../store/facesheetSlice';
import { Loader2 } from 'lucide-react';
import { EncounterHeader } from '../../components/facesheet/EncounterHeader';
import { ModuleContainer } from '../../components/facesheet/ModuleContainer';
import { FacesheetModuleTabs } from '../../components/facesheet/FacesheetModuleTabs';
import { FacesheetEmptyState } from '../../components/facesheet/FacesheetEmptyState';

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
const Pharmacies = lazy(() => import('../patient/Pharmacies'));
const PharmacyMessage = lazy(() => import('../patient/PharmacyMessage'));
const VisitorsContacts = lazy(() => import('../patient/VisitorsContacts'));
const PatientLocation = lazy(() => import('../patient/PatientLocation'));
const Adt = lazy(() => import('../patient/Adt'));

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

    if (error && !patient) {
        return (
            <FacesheetEmptyState
                title="Unable to open this chart"
                description={error}
                action={
                    <Link
                        to="/app/patients/list"
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                    >
                        Back to patient list
                    </Link>
                }
            />
        );
    }

    return (
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-2 overflow-hidden text-gray-900 dark:text-gray-100">
            {patient ? (
                <div className="z-20 flex shrink-0 flex-col gap-2">
                    <EncounterHeader patient={patient} />
                    <FacesheetModuleTabs base={base} className="lg:hidden" />
                </div>
            ) : (
                <FacesheetEmptyState
                    title="No patient data"
                    description="We could not display a header for this record. You can still open chart modules from the sidebar."
                />
            )}

            <ModuleContainer>
                <Suspense fallback={<ModuleFallback />}>
                    <Routes>
                        <Route index element={<Navigate to="demographic" replace />} />
                        <Route path="demographic" element={<Demographic />} />
                        <Route path="vitals" element={<Vitals />} />
                        <Route path="location" element={<PatientLocation />} />
                        <Route path="adt" element={<Adt />} />
                        <Route path="history" element={<History />} />
                        <Route path="diagnoses" element={<Diagnoses />} />
                        <Route path="medications" element={<Medications />} />
                        <Route path="prescriptions" element={<Prescriptions />} />
                        <Route path="allergies" element={<Allergies />} />
                        <Route path="immunizations" element={<Immunizations />} />
                        <Route path="labs" element={<Labs />} />
                        <Route path="lab-orders" element={<LabOrders />} />
                        <Route path="documents" element={<Documents />} />
                        <Route path="notes" element={<Notes />} />
                        <Route path="preventive-screening" element={<PreventiveScreening />} />
                        <Route path="pharmacies" element={<Pharmacies />} />
                        <Route path="pharmacy-message" element={<PharmacyMessage />} />
                        <Route path="visitors-contacts" element={<VisitorsContacts />} />
                        <Route path="*" element={<Navigate to="demographic" replace />} />
                    </Routes>
                </Suspense>
            </ModuleContainer>
        </div>
    );
};

export default FacesheetPage;
