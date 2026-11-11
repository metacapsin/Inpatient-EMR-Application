import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pill } from 'lucide-react';
import { searchDrugs } from '../../services/cds.service';
import type { DrugHit } from '../../types/cds';

const INPUT =
    'w-full rounded-md border border-gray-200/80 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-primary/60 focus:ring-1 focus:ring-primary/30 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100';

export type DrugSelection = { name: string; rxnormCode: string | null };

type Props = {
    id?: string;
    value: DrugSelection;
    onChange: (next: DrugSelection) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    /** Larger input for facesheet forms. */
    size?: 'sm' | 'md';
};

/**
 * Debounced RxNorm drug search with free-text fallback (rxnormCode null when typed freely).
 */
export function DrugTypeahead({ id, value, onChange, disabled, placeholder = 'Search drug…', className = '', size = 'sm' }: Props) {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<DrugHit[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [active, setActive] = useState(-1);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const seq = useRef(0);

    useEffect(() => {
        if (disabled || value.rxnormCode || value.name.trim().length < 2) {
            setRows([]);
            return;
        }
        const mine = ++seq.current;
        const t = window.setTimeout(async () => {
            setLoading(true);
            setError('');
            const res = await searchDrugs(value.name.trim());
            if (mine !== seq.current) return;
            setLoading(false);
            if (!res.ok) {
                setError(res.message);
                setRows([]);
                return;
            }
            setRows(res.data);
            setOpen(true);
            setActive(-1);
        }, 300);
        return () => window.clearTimeout(t);
    }, [value.name, value.rxnormCode, disabled]);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const pick = (d: DrugHit) => {
        onChange({ name: d.name, rxnormCode: d.rxnormCode });
        setOpen(false);
        setRows([]);
    };

    const inputClass = size === 'md' ? INPUT.replace('text-xs', 'text-sm').replace('py-1.5', 'py-2') : INPUT;

    return (
        <div ref={wrapRef} className={`relative ${className}`}>
            <input
                id={id}
                className={`${inputClass} pr-8`}
                value={value.name}
                onChange={(e) => onChange({ name: e.target.value, rxnormCode: null })}
                onFocus={() => rows.length && setOpen(true)}
                onKeyDown={(e) => {
                    if (!open || !rows.length) return;
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setActive((a) => Math.min(rows.length - 1, a + 1));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setActive((a) => Math.max(0, a - 1));
                    } else if (e.key === 'Enter' && active >= 0) {
                        e.preventDefault();
                        const hit = rows[active];
                        if (hit) pick(hit);
                    } else if (e.key === 'Escape') setOpen(false);
                }}
                placeholder={placeholder}
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-controls={id ? `${id}-listbox` : undefined}
                disabled={disabled}
            />
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : value.rxnormCode ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Coded drug" /> : <Pill className="h-3.5 w-3.5" aria-hidden />}
            </span>
            {value.rxnormCode ? (
                <p className="mt-0.5 text-[10px] text-gray-500">RxNorm {value.rxnormCode}</p>
            ) : error ? (
                <p className="mt-0.5 text-[10px] text-amber-600">{error} — free text allowed</p>
            ) : null}
            {open && rows.length ? (
                <ul
                    id={id ? `${id}-listbox` : undefined}
                    role="listbox"
                    className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-xs shadow-lg dark:border-white/10 dark:bg-[#1f1d1a]"
                >
                    {rows.map((d, i) => (
                        <li key={`${d.rxnormCode}-${d.tty}`}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={i === active}
                                className={`flex w-full items-start gap-2 px-2.5 py-1.5 text-left hover:bg-primary/5 ${i === active ? 'bg-primary/10' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    pick(d);
                                }}
                            >
                                <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{d.name}</span>
                                <span className="shrink-0 font-mono text-[10px] text-gray-500">
                                    {d.tty} · {d.rxnormCode}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : open && !loading && value.name.trim().length >= 2 && !value.rxnormCode ? (
                <div className="absolute z-30 mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[11px] text-gray-500 shadow-lg dark:border-white/10 dark:bg-[#1f1d1a]">
                    No coded matches — free-text name will be saved without RxNorm.
                </div>
            ) : null}
        </div>
    );
}
