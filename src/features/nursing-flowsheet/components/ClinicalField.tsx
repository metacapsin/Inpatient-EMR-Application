import { memo, type ReactNode } from 'react';
import { classNames } from 'primereact/utils';

export interface ClinicalFieldProps {
    fieldId: string;
    label: string;
    required?: boolean;
    error?: string;
    abnormal?: boolean;
    hint?: string;
    compact?: boolean;
    labelClassName?: string;
    children: ReactNode;
}

function ClinicalFieldInner({
    fieldId,
    label,
    required,
    error,
    abnormal,
    hint,
    compact = true,
    labelClassName = '',
    children,
}: ClinicalFieldProps) {
    const describedBy = hint ? `${fieldId}-hint` : undefined;
    const errId = error ? `${fieldId}-err` : undefined;
    const ariaDescribedBy = [describedBy, errId].filter(Boolean).join(' ') || undefined;

    return (
        <div
            className={classNames(
                'group flex min-w-0 flex-col gap-1 rounded-lg px-1.5 py-1.5 transition-all',
                !abnormal &&
                    !error &&
                    'bg-white/90 shadow-sm ring-1 ring-gray-200/80 dark:bg-[#1c1916]/90 dark:ring-white/[0.08]',
                abnormal && 'border border-amber-400/70 bg-amber-50/50 ring-1 ring-amber-300/50 dark:border-amber-500/40 dark:bg-amber-950/25 dark:ring-amber-700/30',
                error && 'border border-red-500/70 bg-red-50/50 ring-1 ring-red-300/50 dark:border-red-500/50 dark:bg-red-950/25 dark:ring-red-800/40'
            )}
        >
            <div className={classNames('flex items-baseline justify-between gap-2', compact ? 'min-h-[1rem]' : '')}>
                <label
                    htmlFor={fieldId}
                    className={classNames(
                        'min-w-0 shrink font-semibold tracking-wide text-gray-600 dark:text-gray-300',
                        compact ? 'text-[10px] uppercase leading-tight' : 'text-xs',
                        labelClassName
                    )}
                >
                    {label}
                    {required ? <span className="text-red-600 dark:text-red-400"> *</span> : null}
                </label>
                {hint ? (
                    <span className="text-gray-400 dark:text-gray-500" title={hint} aria-label={hint}>
                        <span className="pi pi-info-circle text-[10px]" aria-hidden />
                    </span>
                ) : null}
            </div>
            <div className="min-w-0" aria-invalid={Boolean(error)} aria-describedby={ariaDescribedBy}>
                {children}
            </div>
            {hint ? (
                <p id={`${fieldId}-hint`} className="sr-only">
                    {hint}
                </p>
            ) : null}
            {error ? (
                <p id={errId} className="text-[10px] font-medium text-red-700 dark:text-red-300" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

export const ClinicalField = memo(ClinicalFieldInner);
