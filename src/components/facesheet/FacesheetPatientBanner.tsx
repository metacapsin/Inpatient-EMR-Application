import { Link } from 'react-router-dom';
import { Phone, MapPin, Hash, Calendar, User2, ChevronRight } from 'lucide-react';
import type { FacesheetPatient } from '../../services/patient.service';

function ageFromRawDob(raw: unknown): string | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
    if (age < 0 || age > 130) return null;
    return `${age} yrs`;
}

interface FacesheetPatientBannerProps {
    patient: FacesheetPatient;
    patientListHref?: string;
}

export function FacesheetPatientBanner({ patient, patientListHref = '/app/patients/list' }: FacesheetPatientBannerProps) {
    const age = ageFromRawDob(patient.raw?.dOB);
    const initial = patient.fullName?.trim().charAt(0).toUpperCase() || '?';

    return (
        <header className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_4px_24px_-10px_rgba(0,0,0,0.1)] dark:border-white/10 dark:bg-[#141210] dark:shadow-[0_4px_32px_-12px_rgba(0,0,0,0.5)]">
            <div className="border-b border-gray-100/90 bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent px-5 py-4 dark:border-white/10 dark:from-primary/10 sm:px-6">
                <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400" aria-label="Breadcrumb">
                    <Link to={patientListHref} className="transition-colors hover:text-primary">
                        Patients
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                    <span className="text-gray-700 dark:text-gray-300">Inpatient chart</span>
                </nav>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                        <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-lg font-bold text-primary dark:bg-primary/25 dark:text-primary-200"
                            aria-hidden
                        >
                            {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="truncate text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">{patient.fullName}</h1>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Active inpatient record</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
                <div className="flex items-start gap-3 rounded-xl bg-gray-50/80 px-3 py-2.5 dark:bg-white/[0.04]">
                    <Hash className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">MRN</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-gray-900 dark:text-white">{patient.mrn}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-gray-50/80 px-3 py-2.5 dark:bg-white/[0.04]">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Date of birth</p>
                        <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                            {patient.dOB}
                            {age ? <span className="font-normal text-gray-500 dark:text-gray-400"> · {age}</span> : null}
                        </p>
                    </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-gray-50/80 px-3 py-2.5 dark:bg-white/[0.04]">
                    <User2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Sex</p>
                        <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{patient.sex}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-gray-50/80 px-3 py-2.5 dark:bg-white/[0.04]">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Phone</p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-gray-900 dark:text-white">{patient.mobilePhone}</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-gray-50/80 px-3 py-2.5 sm:col-span-2 lg:col-span-4">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" aria-hidden />
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Address</p>
                        <p className="mt-0.5 text-sm font-medium leading-snug text-gray-800 dark:text-gray-200">{patient.address}</p>
                    </div>
                </div>
            </div>
        </header>
    );
}
