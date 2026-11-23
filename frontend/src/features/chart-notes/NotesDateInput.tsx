import { useId, useRef } from 'react';
import { CalendarDays } from 'lucide-react';

type Props = {
    value: string;
    onChange: (yyyyMmDd: string) => void;
    onBlur?: () => void;
    disabled?: boolean;
    id?: string;
    'aria-label'?: string;
};

/**
 * Notes Visit Date control — browser date picker (not PrimeReact Calendar).
 * Opens under the field at input width; keeps YYYY-MM-DD for API payloads.
 */
export function NotesDateInput({ value, onChange, onBlur, disabled, id, 'aria-label': ariaLabel }: Props) {
    const autoId = useId();
    const inputId = id || autoId;
    const inputRef = useRef<HTMLInputElement>(null);

    const openPicker = () => {
        if (disabled) return;
        const el = inputRef.current;
        if (!el) return;
        if (typeof el.showPicker === 'function') {
            try {
                el.showPicker();
            } catch {
                el.focus();
            }
        } else {
            el.focus();
            el.click();
        }
    };

    return (
        <div className={`notes-date-input ${disabled ? 'is-disabled' : ''}`}>
            <input
                ref={inputRef}
                id={inputId}
                type="date"
                className="notes-date-input__field"
                value={value || ''}
                disabled={disabled}
                aria-label={ariaLabel || 'Visit date'}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
            />
            <button
                type="button"
                className="notes-date-input__icon"
                tabIndex={-1}
                disabled={disabled}
                aria-hidden
                onClick={openPicker}
            >
                <CalendarDays className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
