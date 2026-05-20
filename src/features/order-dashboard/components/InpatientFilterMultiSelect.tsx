import { useId } from 'react';
import { MultiSelect } from 'primereact/multiselect';
import { NOTCHED_COMPACT_LABEL_CLASS, NOTCHED_FIELD_FRAME_CLASS_STATIC } from '../../../lib/notchedFieldLabels';

type Option = { label: string; value: string };

type InpatientFilterMultiSelectProps = {
    label: string;
    value: string[];
    options: Option[];
    onChange: (next: string[]) => void;
    disabled?: boolean;
    placeholder?: string;
};

/** PrimeNG MultiSelect with inpatient filter-bar notch label + body portal (matches flowsheet overlay strategy). */
export function InpatientFilterMultiSelect({
    label,
    value,
    options,
    onChange,
    disabled,
    placeholder = 'All',
}: InpatientFilterMultiSelectProps) {
    const fieldId = useId();

    return (
        <div
            className={`orders-dashboard-filter-ms relative isolate w-full min-w-0 ${NOTCHED_FIELD_FRAME_CLASS_STATIC} nfs-flowsheet-ms-shell nfs-flowsheet-ms-chips flex h-8 min-h-8 max-h-8 items-center py-0 pl-2 pr-1`}
        >
            <label htmlFor={fieldId} className={NOTCHED_COMPACT_LABEL_CLASS}>
                {label}
            </label>
            <MultiSelect
                inputId={fieldId}
                value={value}
                options={options}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => onChange((e.value as string[]) ?? [])}
                display="chip"
                filter
                filterPlaceholder="Search…"
                resetFilterOnHide
                showSelectAll
                selectAllLabel="Select all"
                maxSelectedLabels={2}
                selectedItemsLabel="{0} selected"
                placeholder={placeholder}
                disabled={disabled}
                appendTo={typeof document !== 'undefined' ? document.body : undefined}
                scrollHeight="min(14rem, 40vh)"
                className="nfs-flowsheet-multiselect-in-frame nfs-flowsheet-multiselect-trigger !flex !min-h-0 !min-w-0 !flex-1 !text-xs"
                panelClassName="nfs-flowsheet-cal-panel nfs-flowsheet-ms-panel"
                panelStyle={{ maxWidth: 'min(22rem, calc(100vw - 1.5rem))', width: 'min(22rem, calc(100vw - 1.5rem))' }}
            />
        </div>
    );
}

