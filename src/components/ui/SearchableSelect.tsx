import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type SearchableSelectOption = {
    value: string | number;
    label: string;
    /** Extra text used when filtering (MRN, id, bed, etc.) */
    keywords?: string;
};

type ListRow =
    | { kind: 'empty' }
    | { kind: 'option'; option: SearchableSelectOption }
    | { kind: 'noResults' };

const DEFAULT_DEBOUNCE_MS = 300;

function norm(s: string): string {
    return s.trim().toLowerCase();
}

function matchesQuery(option: SearchableSelectOption, query: string): boolean {
    const q = norm(query);
    if (!q) return true;
    const hay = norm(`${option.label} ${option.keywords ?? ''}`);
    return hay.includes(q);
}

export type SearchableSelectProps = {
    id?: string;
    options: SearchableSelectOption[];
    /** Shown when URL (or similar) has a value not in `options` */
    pinnedOptions?: SearchableSelectOption[];
    value: string | number;
    placeholder?: string;
    onChange: (value: string | number) => void;
    disabled?: boolean;
    className?: string;
    /** First row clears to empty string when chosen */
    allowEmpty?: boolean;
    /** Label for the clear row (e.g. "Select patient…") */
    emptyRowLabel?: string;
    /** Debounce applied to the filter string before matching (local or remote search) */
    debounceMs?: number;
    'aria-busy'?: boolean;
};

export default function SearchableSelect({
    id: idProp,
    options,
    pinnedOptions = [],
    value,
    placeholder = 'Select option',
    onChange,
    disabled = false,
    className = '',
    allowEmpty = true,
    emptyRowLabel,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    'aria-busy': ariaBusy,
}: SearchableSelectProps) {
    const reactId = useId();
    const listboxId = idProp ?? `searchable-select-${reactId}`;
    const inputId = `${listboxId}-input`;

    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [debouncedFilter, setDebouncedFilter] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedFilter(filter), debounceMs);
        return () => window.clearTimeout(t);
    }, [filter, debounceMs]);

    const selectedInOptions = useMemo(() => {
        const all = [...pinnedOptions, ...options];
        return all.find((o) => o.value === value);
    }, [pinnedOptions, options, value]);

    const emptyLabel = emptyRowLabel ?? placeholder;

    const rows: ListRow[] = useMemo(() => {
        const q = debouncedFilter;
        const out: ListRow[] = [];
        const qTrim = norm(q);

        if (allowEmpty && !qTrim) {
            out.push({ kind: 'empty' });
        }

        const pinFiltered = pinnedOptions.filter((o) => matchesQuery(o, q));
        for (const o of pinFiltered) {
            out.push({ kind: 'option', option: o });
        }

        const optFiltered = options.filter((o) => matchesQuery(o, q));
        for (const o of optFiltered) {
            out.push({ kind: 'option', option: o });
        }

        if (qTrim && !out.some((r) => r.kind === 'option')) {
            out.push({ kind: 'noResults' });
        }

        return out;
    }, [allowEmpty, debouncedFilter, options, pinnedOptions]);

    useEffect(() => {
        if (highlightedIndex >= rows.length) {
            setHighlightedIndex(rows.length > 0 ? rows.length - 1 : 0);
        }
    }, [rows.length, highlightedIndex]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
                setFilter('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (disabled) {
            setOpen(false);
            setFilter('');
        }
    }, [disabled]);

    useEffect(() => {
        if (open) {
            setFilter('');
            setDebouncedFilter('');
            setHighlightedIndex(0);
            window.requestAnimationFrame(() => inputRef.current?.focus());
        } else {
            setFilter('');
        }
    }, [open]);

    const selectRow = useCallback(
        (row: ListRow) => {
            if (row.kind === 'empty') {
                onChange('');
            } else if (row.kind === 'option') {
                onChange(row.option.value);
            }
            setOpen(false);
            setFilter('');
            triggerRef.current?.focus();
        },
        [onChange]
    );

    const moveHighlight = useCallback(
        (delta: number) => {
            if (rows.length === 0) return;
            setHighlightedIndex((i) => {
                const next = i + delta;
                if (next < 0) return rows.length - 1;
                if (next >= rows.length) return 0;
                return next;
            });
        },
        [rows.length]
    );

    const onTriggerKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
        }
    };

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            setFilter('');
            triggerRef.current?.focus();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveHighlight(1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveHighlight(-1);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const row = rows[highlightedIndex];
            if (row && row.kind !== 'noResults') selectRow(row);
        }
    };

    const triggerLabel = selectedInOptions ? selectedInOptions.label : placeholder;

    const triggerClasses = `
  h-9 w-full
  border border-gray-300 rounded-md dark:border-gray-600
  px-2
  bg-[#F6F6FA] dark:bg-gray-900
  flex justify-between items-center text-left
  text-sm text-[#8B5E3C] dark:text-amber-100/90
  transition-all duration-200
  ${disabled ? 'cursor-not-allowed opacity-50 pointer-events-none' : 'cursor-pointer hover:border-[#8B5E3C] dark:hover:border-amber-700'}
`.trim();

    return (
        <div id={listboxId} className={`relative w-full ${className}`.trim()} ref={rootRef}>
            <button
                ref={triggerRef}
                type="button"
                className={triggerClasses}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={`${listboxId}-panel`}
                aria-busy={ariaBusy}
                disabled={disabled}
                onClick={() => !disabled && setOpen((o) => !o)}
                onKeyDown={onTriggerKeyDown}
            >
                <span className={!selectedInOptions ? 'truncate text-gray-400 dark:text-gray-500' : 'truncate'}>
                    {triggerLabel}
                </span>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[#8B5E3C] transition-transform duration-200 dark:text-amber-200/80 ${
                        open ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                />
            </button>

            {open && !disabled && (
                <div
                    id={`${listboxId}-panel`}
                    className="absolute top-full left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-950"
                    role="listbox"
                    aria-label="Options"
                >
                    <div className="border-b border-gray-100 p-2 dark:border-gray-800">
                        <input
                            id={inputId}
                            ref={inputRef}
                            type="search"
                            autoComplete="off"
                            spellCheck={false}
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            onKeyDown={onInputKeyDown}
                            placeholder="Type to filter…"
                            className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                            aria-controls={`${listboxId}-list`}
                        />
                    </div>
                    <div id={`${listboxId}-list`} className="max-h-60 overflow-y-auto py-1">
                        {rows.map((row, idx) => {
                            if (row.kind === 'noResults') {
                                return (
                                    <div
                                        key="no-results"
                                        className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                                        role="presentation"
                                    >
                                        No results found
                                    </div>
                                );
                            }
                            if (row.kind === 'empty') {
                                const selected = value === '' || value === undefined;
                                const active = idx === highlightedIndex;
                                return (
                                    <div
                                        key="empty-row"
                                        role="option"
                                        aria-selected={selected}
                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => selectRow(row)}
                                        className={`cursor-pointer px-4 py-3 text-sm transition-colors ${
                                            active ? 'bg-[#E9E3DC] dark:bg-gray-800' : ''
                                        } ${selected ? 'font-medium text-[#6B3F1F] dark:text-amber-100' : 'text-gray-600 dark:text-gray-300'}`}
                                    >
                                        {emptyLabel}
                                    </div>
                                );
                            }
                            const opt = row.option;
                            const selected = opt.value === value;
                            const active = idx === highlightedIndex;
                            return (
                                <div
                                    key={`${String(opt.value)}-${idx}`}
                                    role="option"
                                    aria-selected={selected}
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => selectRow(row)}
                                    className={`cursor-pointer px-4 py-3 text-sm transition-colors ${
                                        active ? 'bg-[#E9E3DC] dark:bg-gray-800' : ''
                                    } ${
                                        selected
                                            ? 'font-medium text-[#6B3F1F] dark:text-amber-100'
                                            : 'text-gray-700 hover:bg-[#F3F1EE] dark:text-gray-200 dark:hover:bg-gray-800/80'
                                    }`}
                                >
                                    {opt.label}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
