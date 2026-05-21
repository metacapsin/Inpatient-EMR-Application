import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileSignature, FileStack, ClipboardCheck } from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import { CONSENT_PAGE_HEADER_CLASS } from '../constants/consentLayout';
import {
    dischargeReadinessPath,
    facesheetDocumentsPath,
} from '../utils/consentLinks';
import type { ConsentCompleteness } from '../../../types/consent';

type Props = {
    patientName?: string;
    patientMrn?: string;
    encounterId?: string;
    encounterLabel?: string;
    completeness?: ConsentCompleteness | null;
    lastUpdated: string | null;
    patientId: string;
    onObtainConsent: () => void;
    onRefresh: () => void;
};

export function ConsentsPageHeader({
    patientName,
    patientMrn,
    encounterId,
    encounterLabel,
    completeness,
    lastUpdated,
    patientId,
    onObtainConsent,
    onRefresh,
}: Props) {
    const complete = completeness?.complete ?? false;

    return (
        <header className={CONSENT_PAGE_HEADER_CLASS}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-2.5">
                    <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary dark:border-primary/30 dark:bg-primary/10"
                        aria-hidden
                    >
                        <FileSignature className="h-4 w-4" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                                Consent management
                            </h1>
                            {encounterLabel ? (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary dark:bg-primary/20">
                                    {encounterLabel}
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                            {patientName ? (
                                <>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{patientName}</span>
                                    {patientMrn ? <span className="text-gray-400"> · MRN {patientMrn}</span> : null}
                                </>
                            ) : (
                                'Informed consent & HIPAA patient rights'
                            )}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            {complete ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-600/15 dark:bg-emerald-950/40 dark:text-emerald-200">
                                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                                    Discharge consents complete
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-600/15 dark:bg-amber-950/40 dark:text-amber-100">
                                    <AlertCircle className="h-3 w-3" aria-hidden />
                                    Missing: {completeness?.missing.join(', ') || 'required consents'}
                                </span>
                            )}
                            {lastUpdated ? (
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                    Updated {new Date(lastUpdated).toLocaleString()}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        to={facesheetDocumentsPath(patientId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                    >
                        <FileStack className="h-3.5 w-3.5" aria-hidden />
                        Documents
                    </Link>
                    <Link
                        to={dischargeReadinessPath(patientId, encounterId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                    >
                        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                        Discharge readiness
                    </Link>
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
                    >
                        Refresh
                    </button>
                    <AppButton onClick={onObtainConsent}>Obtain consent</AppButton>
                </div>
            </div>
        </header>
    );
}
