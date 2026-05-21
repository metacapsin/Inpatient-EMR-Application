import type { ReactNode } from 'react';
import { classNames } from 'primereact/utils';
import {
    FlowsheetLabeledDropdown,
    FlowsheetOutlinedCalendar,
    FlowsheetOutlinedTextInput,
    NFS_OPTION_ACTIVE_CLASS,
    NFS_OPTION_BASE_CLASS,
    NFS_OPTION_IDLE_CLASS,
    NFS_OUTLINED_FIELD_FRAME,
    NFS_RADIO_INDICATOR_ACTIVE,
    NFS_RADIO_INDICATOR_BASE,
    NFS_RADIO_INDICATOR_IDLE,
    NFS_SECTION_GRID_CLASS,
} from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import { FlowsheetOutlinedTextarea } from '../../io-tracking/components/FlowsheetOutlinedTextarea';

export {
    FlowsheetLabeledDropdown as ConsentDropdown,
    FlowsheetOutlinedCalendar as ConsentCalendar,
    FlowsheetOutlinedTextInput as ConsentTextInput,
    FlowsheetOutlinedTextarea as ConsentTextarea,
    NFS_SECTION_GRID_CLASS as CONSENT_FORM_GRID_CLASS,
};

export function toConsentSelectOptions(values: readonly string[]): { label: string; value: string }[] {
    return values.map((v) => ({ label: v, value: v }));
}

export function isoToDate(iso: string | null | undefined): Date | null {
    if (!iso?.trim()) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function dateToIso(d: Date | null): string {
    return d ? d.toISOString() : '';
}

export function dateToYmd(d: Date | null): string {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

type ConsentSegmentedProps<T extends string> = {
    legend: string;
    value: T;
    options: readonly { label: string; value: T }[];
    onChange: (value: T) => void;
    disabled?: boolean;
};

/** Yes/No and signer-type style controls — matches nursing flowsheet segmented radios. */
export function ConsentSegmentedChoice<T extends string>({
    legend,
    value,
    options,
    onChange,
    disabled,
}: ConsentSegmentedProps<T>) {
    return (
        <fieldset className="min-w-0" disabled={disabled}>
            <legend className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                {legend}
            </legend>
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                    const active = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onChange(opt.value)}
                            className={classNames(
                                NFS_OPTION_BASE_CLASS,
                                'inline-flex gap-2',
                                active ? NFS_OPTION_ACTIVE_CLASS : NFS_OPTION_IDLE_CLASS,
                            )}
                        >
                            <span
                                className={classNames(
                                    NFS_RADIO_INDICATOR_BASE,
                                    active ? NFS_RADIO_INDICATOR_ACTIVE : NFS_RADIO_INDICATOR_IDLE,
                                )}
                                aria-hidden
                            >
                                {active ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                            </span>
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}

export function ConsentFieldError({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <p className="mt-1 text-[11px] font-medium text-primary-700 dark:text-primary-300" role="alert">
            {message}
        </p>
    );
}

/** Signature pad shell aligned with notched EMR fields. */
export function ConsentSignatureFrame({
    label,
    children,
    error,
}: {
    label: string;
    children: ReactNode;
    error?: string;
}) {
    return (
        <div className="min-w-0">
            <div className={classNames(NFS_OUTLINED_FIELD_FRAME, 'flex flex-col overflow-hidden p-0')}>
                <span className="px-2.5 pt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                    {label}
                </span>
                {children}
            </div>
            <ConsentFieldError message={error} />
        </div>
    );
}
