import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AutoComplete } from 'primereact/autocomplete';
import { classNames } from 'primereact/utils';
import {
    FlowsheetLabeledDropdown,
    FlowsheetOutlinedCalendar,
    FlowsheetOutlinedTextInput,
    NFS_FLOAT_FIELD_LABEL,
    NFS_OUTLINED_FIELD_FRAME,
    NFS_OUTLINED_FIELD_INPUT,
} from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import type { NandaSearchResult } from '../types/carePlan.types';

export { FlowsheetLabeledDropdown as CarePlanDropdown };

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
        <div
            className={classNames(
                NFS_OUTLINED_FIELD_FRAME,
                'flex min-h-0 flex-col',
                hasError && 'border-primary-600 ring-2 ring-primary/20 dark:border-primary-500'
            )}
        >
            <label htmlFor={fieldId} className={NFS_FLOAT_FIELD_LABEL}>
                {label}
            </label>
            <textarea
                id={fieldId}
                value={value}
                rows={rows}
                disabled={disabled}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className={classNames(
                    NFS_OUTLINED_FIELD_INPUT,
                    'min-h-[4.5rem] resize-y py-2 leading-snug'
                )}
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
};

/** NANDA typeahead — same notched shell + panel class as flowsheet / radiology. */
export function CarePlanNandaSearch({
    fieldId,
    label,
    value,
    onChange,
    onSearch,
    disabled,
    required,
}: CarePlanNandaSearchProps) {
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
                const rows = await onSearch(q);
                setSuggestions(rows);
            } finally {
                setBusy(false);
            }
        },
        [onSearch]
    );

    return (
        <div className="relative w-full min-w-0">
            <div className={classNames(NFS_OUTLINED_FIELD_FRAME, 'flex min-h-8 flex-col justify-center')}>
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
                    className="w-full"
                    inputClassName="!h-7 !w-full !border-0 !bg-transparent !text-xs !font-medium !shadow-none"
                    appendTo={typeof document !== 'undefined' ? document.body : undefined}
                    panelClassName="nfs-flowsheet-cal-panel"
                    itemTemplate={(item: NandaSearchResult) => (
                        <span className="text-xs">
                            <span className="font-semibold">{item.label}</span>
                            <span className="ml-2 font-mono text-gray-500">{item.code}</span>
                        </span>
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
    'rounded-lg border border-gray-200/90 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#141210]';

export function CarePlanFieldRow({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={classNames('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>;
}
