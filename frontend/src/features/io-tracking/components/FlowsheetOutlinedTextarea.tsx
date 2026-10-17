import { InputTextarea } from 'primereact/inputtextarea';
import { classNames } from 'primereact/utils';
import { NFS_FLOAT_FIELD_LABEL, NFS_OUTLINED_FIELD_FRAME } from '../../nursing-flowsheet/components/FlowsheetStyledFields';

const TEXTAREA_INPUT =
    'min-h-[88px] w-full resize-y border-0 bg-transparent px-2.5 pb-2 pt-5 text-xs font-medium leading-snug text-gray-900 outline-none ring-0 placeholder:text-gray-500 dark:text-gray-100 dark:placeholder:text-gray-400';

type FlowsheetOutlinedTextareaProps = {
    fieldId: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
    rows?: number;
};

export function FlowsheetOutlinedTextarea({
    fieldId,
    label,
    value,
    onChange,
    disabled,
    placeholder,
    rows = 3,
}: FlowsheetOutlinedTextareaProps) {
    return (
        <div className={classNames(NFS_OUTLINED_FIELD_FRAME, 'flex min-h-[88px] flex-col')}>
            <label htmlFor={fieldId} className={NFS_FLOAT_FIELD_LABEL}>
                {label}
            </label>
            <InputTextarea
                id={fieldId}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                rows={rows}
                autoResize
                className={TEXTAREA_INPUT}
            />
        </div>
    );
}
