import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AutoComplete } from 'primereact/autocomplete';
import { classNames } from 'primereact/utils';
import SearchableSelect, { type SearchableSelectProps } from '../../../components/ui/SearchableSelect';
import {
    FlowsheetLabeledDropdown,
    FlowsheetOutlinedCalendar,
    FlowsheetOutlinedTextInput,
    NFS_FLOAT_FIELD_LABEL,
    NFS_OUTLINED_FIELD_FRAME,
    NFS_SECTION_GRID_CLASS,
} from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import { FlowsheetOutlinedTextarea } from '../../io-tracking/components/FlowsheetOutlinedTextarea';
import type { NandaSearchResult } from '../types/carePlan.types';

export { FlowsheetLabeledDropdown as CarePlanDropdown };
export { NFS_SECTION_GRID_CLASS as CARE_PLAN_FORM_GRID_CLASS };

export function CarePlanFieldError({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <p className="mt-1 text-[11px] font-medium text-primary-700 dark:text-primary-300" role="alert">
            {message}
        </p>
    );
}

type CarePlanTextareaProps = {
    fieldId: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    rows?: number;
    placeholder?: string;
    disabled?: boolean;
    hasError?: boolean;
};

export function CarePlanTextarea({
    fieldId,
    label,
    value,
    onChange,
    rows = 2,
    placeholder,
    disabled,
    hasError,
}: CarePlanTextareaProps) {
    return (
        <div className={classNames(hasError && 'rounded-lg ring-2 ring-primary/20')}>
            <FlowsheetOutlinedTextarea
                fieldId={fieldId}
                label={label}
                value={value}
                onChange={onChange}
                rows={rows}
                placeholder={placeholder}
                disabled={disabled}
            />
        </div>
    );
}

export function CarePlanReadOnlyField(props: {
    fieldId: string;
    label: string;
    value: string;
    placeholder?: string;
}) {
    return (
        <FlowsheetOutlinedTextInput
            fieldId={props.fieldId}
            label={props.label}
            value={props.value}
            onChange={() => {}}
            readOnly
            placeholder={props.placeholder}
        />
    );
}

export function CarePlanDateField(props: {
    fieldId: string;
    label: string;
    value: Date | null;
    onChange: (value: Date | null) => void;
    disabled?: boolean;
    hasError?: boolean;
}) {
    return (
        <div className={classNames(hasError && 'rounded-lg ring-2 ring-primary/20')}>
            <FlowsheetOutlinedCalendar
                fieldId={props.fieldId}
                label={props.label}
                value={props.value}
                onChange={props.onChange}
                disabled={props.disabled}
            />
        </div>
    );
}

type CarePlanNandaSearchProps = {
    fieldId: string;
    label: string;
    value: NandaSearchResult | null;
    onChange: (value: NandaSearchResult | null) => void;
    onSearch: (query: string) => Promise<NandaSearchResult[]>;
    disabled?: boolean;
    required?: boolean;
    variant?: 'default' | 'comfortable';
};

/** NANDA typeahead — notched shell + PrimeReact AutoComplete (flowsheet / radiology pattern). */
export function CarePlanNandaSearch({
    fieldId,
    label,
    value,
    onChange,
    onSearch,
    disabled,
    required,
    variant = 'default',
}: CarePlanNandaSearchProps) {
    const comfortable = variant === 'comfortable';
    const [query, setQuery] = useState(value?.label ?? '');
    const [suggestions, setSuggestions] = useState<NandaSearchResult[]>([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setQuery(value?.label ?? '');
    }, [value?.label, value?.code]);

    const complete = useCallback(
        async (event: { query: string }) => {
            const q = event.query.trim();
            setQuery(q);
            if (!q) {
                setSuggestions([]);
                return;
            }
            setBusy(true);
            try {
                setSuggestions(await onSearch(q));
            } finally {
                setBusy(false);
            }
        },
        [onSearch],
    );

    return (
        <div className="care-plan-nanda-ac relative w-full min-w-0">
            <div
                className={classNames(
                    NFS_OUTLINED_FIELD_FRAME,
                    'flex flex-col justify-center transition-shadow focus-within:ring-2 focus-within:ring-primary/15',
                    comfortable ? 'min-h-[52px]' : 'min-h-8',
                )}
            >
                <label htmlFor={fieldId} className={NFS_FLOAT_FIELD_LABEL}>
                    {label}
                    {required ? <span className="text-primary"> *</span> : null}
                </label>
                <AutoComplete
                    inputId={fieldId}
                    value={query}
                    suggestions={suggestions}
                    completeMethod={complete}
                    field="label"
                    forceSelection
                    dropdown
                    disabled={disabled}
                    placeholder="Type to search NANDA…"
                    className="w-full [&_.p-autocomplete]:w-full [&_.p-autocomplete-dropdown]:!border-0 [&_.p-autocomplete-dropdown]:!bg-transparent [&_.p-autocomplete-dropdown]:!text-primary"
                    inputClassName={classNames(
                        '!w-full !border-0 !bg-transparent !font-medium !shadow-none !outline-none',
                        comfortable ? '!h-9 !text-sm' : '!h-7 !text-xs',
                    )}
                    appendTo={typeof document !== 'undefined' ? document.body : undefined}
                    panelClassName="nfs-flowsheet-cal-panel io-tracking-cal-panel !rounded-xl !border-gray-200/90 !shadow-xl dark:!border-white/10"
                    itemTemplate={(item: NandaSearchResult) => (
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 py-0.5 text-xs">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{item.label}</span>
                            <span className="font-mono text-[10px] font-semibold text-primary">{item.code}</span>
                        </div>
                    )}
                    onChange={(e) => {
                        const v = String(e.value ?? '');
                        setQuery(v);
                        if (!v) onChange(null);
                    }}
                    onSelect={(e) => {
                        const item = e.value as NandaSearchResult;
                        if (item?.code) {
                            onChange(item);
                            setQuery(item.label);
                        }
                    }}
                />
            </div>
            {busy ? (
                <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400" aria-live="polite">
                    Searching…
                </p>
            ) : null}
        </div>
    );
}

export const CARE_PLAN_SECTION_CARD_CLASS =
    'rounded-xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141210]';

export function CarePlanFieldRow({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={classNames('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>;
}

type CarePlanSearchableSelectProps = SearchableSelectProps & {
    fieldId: string;
    label: string;
};

/** Large lists (patients) — notched shell + searchable select (application theme). */
export function CarePlanSearchableSelect({ fieldId, label, ...selectProps }: CarePlanSearchableSelectProps) {
    return (
        <div className="relative w-full min-w-0">
            <div className={classNames(NFS_OUTLINED_FIELD_FRAME, 'flex min-h-8 flex-col justify-center')}>
                <label htmlFor={fieldId} className={NFS_FLOAT_FIELD_LABEL}>
                    {label}
                </label>
                <div className="min-w-0 [&_button]:!h-7 [&_button]:!min-h-7 [&_button]:!border-0 [&_button]:!bg-transparent [&_button]:!px-1 [&_button]:!shadow-none">
                    <SearchableSelect id={fieldId} {...selectProps} />
                </div>
            </div>
        </div>
    );
}
