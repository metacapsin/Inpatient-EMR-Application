import { useCallback, useRef, useState } from 'react';
import { classNames } from 'primereact/utils';
import { Calendar } from 'primereact/calendar';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import type { Nullable } from 'primereact/ts-helpers';
import NewDropdown from '../../../components/ui/NewDropdown';
import {
    NOTCHED_DATE_LABEL_CLASS,
    NOTCHED_FIELD_FRAME_CLASS,
    NOTCHED_FIELD_LABEL_CLASS,
} from '../../../lib/notchedFieldLabels';
import { ClinicalField, type ClinicalFieldProps } from './ClinicalField';

/** Standard head-to-toe section grid: three fields per row on md+, extra row gap so notched labels do not overlap the row above. */
export const NFS_SECTION_GRID_CLASS = 'grid grid-cols-12 gap-x-2.5 gap-y-5 [&>*]:min-w-0 mt-2';

/** Notched label on control border — same tokens as Shift date / shared notched fields. */
export const NFS_FLOAT_FIELD_LABEL = NOTCHED_FIELD_LABEL_CLASS;

/** Calendar trigger — slightly stronger weight for date copy. */
export const NFS_OUTLINED_DATE_LABEL = NOTCHED_DATE_LABEL_CLASS;

/** Outlined single-line field shell (text / number). */
export const NFS_OUTLINED_FIELD_FRAME = NOTCHED_FIELD_FRAME_CLASS;

export const NFS_OUTLINED_FIELD_INPUT =
    'h-8 min-h-8 w-full border-0 bg-transparent px-2.5 pb-1 pt-[0.5625rem] text-xs font-medium leading-tight text-gray-900 outline-none ring-0 placeholder:text-gray-500 dark:text-gray-100 dark:placeholder:text-gray-400';

export const NFS_APPOINTMENT_CALENDAR_CLASS =
    'flex min-w-0 h-8 max-h-8 w-full overflow-hidden rounded-lg border border-primary-200 bg-white shadow-sm dark:border-primary-700 dark:bg-[#141210] [&_.p-button]:!h-8 [&_.p-button]:!max-h-8 [&_.p-button]:!w-8 [&_.p-button]:!shrink-0 [&_.p-button]:!rounded-none [&_.p-button]:!rounded-r-lg [&_.p-button]:!border-0 [&_.p-button]:!bg-primary [&_.p-button]:!px-0 [&_.p-button]:!text-white [&_.p-button]:!shadow-none [&_.p-button]:hover:!bg-primary-600 [&_.p-button-icon]:!h-3 [&_.p-button-icon]:!w-3';

export const NFS_APPOINTMENT_CALENDAR_INPUT =
    '!h-8 !min-h-0 !max-h-8 !min-w-0 !flex-1 !rounded-none !border-0 !bg-transparent !py-0 !pl-2 !pr-1 !text-xs !font-medium !leading-8 !text-slate-700 !shadow-none !outline-none !ring-0 placeholder:!text-slate-500 focus:!shadow-none focus:!outline-none focus:!ring-0 dark:!text-gray-200 dark:placeholder:!text-gray-400';

/** Segmented control styling (STAT / Routine) — same tokens as RiskAssessments Pain tab. */
export const NFS_OPTION_BASE_CLASS =
    'rounded-lg border px-3 py-2.5 text-xs font-medium leading-snug transition-colors min-h-[2.5rem] items-center';
export const NFS_OPTION_ACTIVE_CLASS = 'border-primary bg-primary/10 text-primary';
export const NFS_OPTION_IDLE_CLASS =
    'border-gray-200 text-gray-700 hover:border-primary/50 dark:border-white/10 dark:text-gray-300';
export const NFS_RADIO_INDICATOR_BASE =
    'flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full border bg-white dark:bg-[#141210]';
export const NFS_RADIO_INDICATOR_ACTIVE = 'border-primary';
export const NFS_RADIO_INDICATOR_IDLE = 'border-gray-300 dark:border-gray-600';

export function reassessmentDueFromPriority(priority: 'STAT' | 'routine'): Date {
    const d = new Date();
    d.setMinutes(d.getMinutes() + (priority === 'STAT' ? 60 : 240));
    return d;
}

export type FlowsheetOutlinedCalendarProps = {
    fieldId: string;
    label: string;
    value: Nullable<Date>;
    onChange: (value: Date | null) => void;
    disabled?: boolean;
    showTime?: boolean;
    hourFormat?: '12' | '24';
    dateFormat?: string;
    placeholder?: string;
};

/** Datepicker popup width matches the field shell (`io-tracking-cal-panel` + inline width on show). */
export function FlowsheetOutlinedCalendar({
    fieldId,
    label,
    value,
    onChange,
    disabled,
    showTime = false,
    hourFormat = '12',
    dateFormat = showTime ? 'mm/dd/y' : 'mm/dd/yy',
    placeholder = showTime ? 'MM/DD/YY HH:MM' : 'MM/DD/YY',
}: FlowsheetOutlinedCalendarProps) {
    const shellRef = useRef<HTMLDivElement>(null);
    const [panelWidth, setPanelWidth] = useState<number | undefined>();

    const syncPanelWidth = useCallback(() => {
        const w = shellRef.current?.getBoundingClientRect().width;
        if (w && w > 0) setPanelWidth(Math.round(w));
    }, []);

    const panelStyle =
        panelWidth != null
            ? { width: panelWidth, minWidth: panelWidth, maxWidth: panelWidth }
            : undefined;

    return (
        <div ref={shellRef} className="relative isolate w-full min-w-0">
            <label htmlFor={fieldId} className={NFS_OUTLINED_DATE_LABEL}>
                {label}
            </label>
            <Calendar
                inputId={fieldId}
                value={value}
                onChange={(e) => onChange((e.value as Date | null) ?? null)}
                disabled={disabled}
                showIcon
                showButtonBar
                showTime={showTime}
                hourFormat={hourFormat}
                dateFormat={dateFormat}
                placeholder={placeholder}
                appendTo={typeof document !== 'undefined' ? document.body : undefined}
                className={NFS_APPOINTMENT_CALENDAR_CLASS}
                inputClassName={NFS_APPOINTMENT_CALENDAR_INPUT}
                panelClassName="io-tracking-cal-panel risk-assessment-cal-panel"
                panelStyle={panelStyle}
                onShow={syncPanelWidth}
            />
        </div>
    );
}

type LabeledDropdownOption = { label: string; value: string | number };

type FlowsheetLabeledDropdownProps = {
    fieldId: string;
    label: string;
    options: LabeledDropdownOption[];
    value: string | number | null | undefined;
    onChange: (value: string | number) => void;
    disabled?: boolean;
    placeholder?: string;
} & Pick<ClinicalFieldProps, 'error' | 'abnormal' | 'required' | 'hint'>;

export function FlowsheetLabeledDropdown({
    fieldId,
    label,
    options,
    value,
    onChange,
    disabled,
    placeholder = 'Select...',
    error,
    abnormal,
    required,
    hint,
}: FlowsheetLabeledDropdownProps) {
    const v = value === null || value === undefined ? '' : value;
    return (
        <ClinicalField fieldId={fieldId} label={label} omitLabel error={error} abnormal={abnormal} required={required} hint={hint}>
            <NewDropdown
                id={fieldId}
                label={label}
                fieldSize="md"
                options={options}
                value={v}
                placeholder={placeholder}
                onChange={onChange}
                disabled={disabled}
                hasError={Boolean(error)}
                appendMenuToBody
            />
        </ClinicalField>
    );
}

type FlowsheetOutlinedTextInputProps = {
    fieldId: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    readOnly?: boolean;
    hasError?: boolean;
};

export function FlowsheetOutlinedTextInput({
    fieldId,
    label,
    value,
    onChange,
    disabled,
    placeholder,
    readOnly,
    hasError,
}: FlowsheetOutlinedTextInputProps) {
    return (
        <div
            className={classNames(
                NFS_OUTLINED_FIELD_FRAME,
                'flex min-h-8 items-center',
                readOnly && 'bg-gray-50 dark:bg-white/[0.04]',
                hasError && 'border-primary-600 ring-2 ring-primary/20 dark:border-primary-500'
            )}
        >
            <label htmlFor={fieldId} className={NFS_FLOAT_FIELD_LABEL}>
                {label}
            </label>
            <InputText
                id={fieldId}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                readOnly={readOnly}
                placeholder={placeholder}
                className={classNames(NFS_OUTLINED_FIELD_INPUT, readOnly && 'cursor-default')}
            />
        </div>
    );
}

type FlowsheetOutlinedInputNumberProps = {
    fieldId: string;
    label: string;
    value: number | null;
    onValueChange: (value: number | null) => void;
    onBlur?: () => void;
    disabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    useGrouping?: boolean;
    abnormal?: boolean;
};

export function FlowsheetOutlinedInputNumber({
    fieldId,
    label,
    value,
    onValueChange,
    onBlur,
    disabled,
    min,
    max,
    step,
    suffix,
    useGrouping = false,
    abnormal,
}: FlowsheetOutlinedInputNumberProps) {
    return (
        <div
            className={classNames(
                NFS_OUTLINED_FIELD_FRAME,
                'flex min-h-8 items-center',
                abnormal && 'border-amber-400/80 ring-2 ring-amber-300/40 dark:border-amber-500/50 dark:ring-amber-700/30'
            )}
        >
            <label htmlFor={fieldId} className={NFS_FLOAT_FIELD_LABEL}>
                {label}
            </label>
            <InputNumber
                inputId={fieldId}
                value={value}
                onValueChange={(e) => onValueChange(e.value ?? null)}
                onBlur={onBlur}
                disabled={disabled}
                min={min}
                max={max}
                step={step}
                suffix={suffix}
                useGrouping={useGrouping}
                className="nfs-flowsheet-outlined-num w-full flex-1"
                inputClassName={`${NFS_OUTLINED_FIELD_INPUT} !tabular-nums`}
            />
        </div>
    );
}

type MultiOption = { label: string; value: string };

type FlowsheetOutlinedMultiSelectProps = {
    fieldId: string;
    label: string;
    value: string[];
    options: MultiOption[];
    onChange: (next: string[]) => void;
    disabled?: boolean;
};

export function FlowsheetOutlinedMultiSelect({
    fieldId,
    label,
    value,
    options,
    onChange,
    disabled,
}: FlowsheetOutlinedMultiSelectProps) {
    return (
        <div
            className={`relative w-full min-w-0 ${NFS_OUTLINED_FIELD_FRAME} nfs-flowsheet-ms-shell nfs-flowsheet-ms-chips flex h-8 min-h-8 max-h-8 items-center py-0 pl-2 pr-1`}
        >
            <label htmlFor={fieldId} className={NFS_FLOAT_FIELD_LABEL}>
                {label}
            </label>
            <MultiSelect
                inputId={fieldId}
                value={value}
                options={options}
                onChange={(e) => onChange((e.value as string[]) ?? [])}
                display="chip"
                filter
                filterPlaceholder="Search options…"
                resetFilterOnHide
                showSelectAll
                selectAllLabel="Select all"
                maxSelectedLabels={4}
                selectedItemsLabel="{0} selected"
                placeholder="Select…"
                disabled={disabled}
                appendTo={typeof document !== 'undefined' ? document.body : undefined}
                scrollHeight="min(16rem, 45vh)"
                className="nfs-flowsheet-multiselect-in-frame nfs-flowsheet-multiselect-trigger !flex !min-h-0 !min-w-0 !flex-1 !text-xs"
                panelClassName="nfs-flowsheet-cal-panel nfs-flowsheet-ms-panel"
                panelStyle={{ maxWidth: 'min(22rem, calc(100vw - 1.5rem))', width: 'min(22rem, calc(100vw - 1.5rem))' }}
            />
        </div>
    );
}
