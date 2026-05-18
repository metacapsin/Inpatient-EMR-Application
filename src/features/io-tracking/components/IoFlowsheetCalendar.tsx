import { useCallback, useRef, useState } from 'react';
import { Calendar } from 'primereact/calendar';
import type { Nullable } from 'primereact/ts-helpers';
import {
    NFS_APPOINTMENT_CALENDAR_CLASS,
    NFS_APPOINTMENT_CALENDAR_INPUT,
    NFS_OUTLINED_DATE_LABEL,
} from '../../nursing-flowsheet/components/FlowsheetStyledFields';

export type IoFlowsheetCalendarProps = {
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

/** I&O date/time field — popup width matches trigger (input + icon). */
export function IoFlowsheetCalendar({
    fieldId,
    label,
    value,
    onChange,
    disabled,
    showTime = false,
    hourFormat = '12',
    dateFormat = showTime ? 'mm/dd/y' : 'mm/dd/yy',
    placeholder = showTime ? 'MM/DD/YY HH:MM' : 'MM/DD/YY',
}: IoFlowsheetCalendarProps) {
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
