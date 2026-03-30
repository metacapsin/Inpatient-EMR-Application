import { lazy, Suspense, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, IRootState } from '../../store';
import { fetchFacesheetPatient } from '../../store/facesheetSlice';
import { Loader2 } from 'lucide-react';
import { FacesheetPatientBanner } from '../../components/facesheet/FacesheetPatientBanner';
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

function ModuleFallback() {
    return (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6">
            <Loader2 className="h-9 w-9 animate-spin text-primary/80" aria-hidden />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading clinical module…</p>
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
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                <div className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
                <div className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
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
                        className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:opacity-95"
                    >
                        Back to patient list
                    </Link>
                }
            />
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1 flex-col gap-5 text-gray-900 dark:text-gray-100">
            {patient ? (
                <>
                    <FacesheetPatientBanner patient={patient} />
                    <FacesheetModuleTabs base={base} className="lg:hidden" />
                </>
            ) : (
                <FacesheetEmptyState
                    title="No patient data"
                    description="We could not display a header for this record. You can still open chart modules from the sidebar."
                />
            )}

            <section
                className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)] dark:border-white/10 dark:bg-[#141210] dark:shadow-[0_4px_32px_-12px_rgba(0,0,0,0.45)]"
                aria-label="Clinical module"
            >
                <div className="border-b border-gray-100 px-5 py-3 dark:border-white/10 sm:px-6">
                    <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Active module</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Content below is scoped to this encounter. Use the chart sidebar or module bar to switch sections.
                    </p>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
                    <Suspense fallback={<ModuleFallback />}>
                        <Routes>
                            <Route index element={<Navigate to="demographic" replace />} />
                            <Route path="demographic" element={<Demographic />} />
                            <Route path="vitals" element={<Vitals />} />
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
                            <Route path="*" element={<Navigate to="demographic" replace />} />
                        </Routes>
                    </Suspense>
                </div>
            </section>
        </div>
    );
};

export default FacesheetPage;
