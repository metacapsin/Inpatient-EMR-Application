import { useEffect, useRef, useState } from 'react';
import { Building2, Check, Loader2 } from 'lucide-react';
import { PayerDirectoryUnavailable, payerTradingPartnerId, searchPayers, type PayerRow } from '../../services/eligibility.service';

interface PayerAutocompleteProps {
    id: string;
    /** Insurance company name shown in the input. */
    value: string;
    /** Trading-partner id of the picked payer ('' when the name was typed freely). */
    tradingPartnerServiceId: string;
    onChange: (name: string, payer: PayerRow | null) => void;
    error?: string;
    disabled?: boolean;
    className?: string;
}

const INPUT =
    'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pr-9 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-gray-50 disabled:text-gray-500 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-100 dark:disabled:bg-white/5';

/**
 * Insurance company typeahead backed by the Stedi payer directory (GET /Payers/search).
 * Picking a row stores the payer's trading-partner id; typing a free name clears it so eligibility
 * falls back to the name map (or reports the payer as unsupported). Degrades to a plain text input
 * when the directory is not configured.
 */
export function PayerAutocomplete({ id, value, tradingPartnerServiceId, onChange, error, disabled, className = '' }: PayerAutocompleteProps) {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<PayerRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [unavailable, setUnavailable] = useState(false);
    const [active, setActive] = useState(-1);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const seq = useRef(0);

    // Debounced search while the typed name has no picked payer behind it.
    useEffect(() => {
        if (disabled || unavailable || tradingPartnerServiceId || value.trim().length < 2) { setRows([]); return; }
        const mine = ++seq.current;
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const items = await searchPayers(value.trim(), 10);
                if (mine === seq.current) { setRows(items); setOpen(true); setActive(-1); }
            } catch (e) {
                if (e instanceof PayerDirectoryUnavailable) setUnavailable(true);
                if (mine === seq.current) setRows([]);
            } finally {
                if (mine === seq.current) setLoading(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [value, tradingPartnerServiceId, disabled, unavailable]);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const pick = (p: PayerRow) => { onChange(p.displayName, p); setOpen(false); setRows([]); };

    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open || !rows.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
        else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(rows[active]); }
        else if (e.key === 'Escape') setOpen(false);
    };

    return (
        <div ref={wrapRef} className={`relative ${className}`}>
            <input
                id={id}
                className={`${INPUT} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={value}
                onChange={(e) => onChange(e.target.value, null)}
                onFocus={() => rows.length && setOpen(true)}
                onKeyDown={onKey}
                placeholder={unavailable ? 'Insurance company' : 'Search payer directory…'}
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-controls={`${id}-listbox`}
                aria-autocomplete="list"
                aria-invalid={!!error}
                disabled={disabled}
                maxLength={200}
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-gray-400">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : tradingPartnerServiceId ? <Check className="h-4 w-4 text-emerald-600" aria-label="Payer verified in directory" /> : <Building2 className="h-4 w-4" aria-hidden />}
            </span>
            {tradingPartnerServiceId ? (
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Payer ID <span className="font-mono">{tradingPartnerServiceId}</span>
                </p>
            ) : unavailable ? (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-300">Payer directory not configured — name saved as typed; coverage cannot be verified online.</p>
            ) : null}
            {open && rows.length ? (
                <ul id={`${id}-listbox`} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-xl dark:border-white/10 dark:bg-[#1f1d1a]">
                    {rows.map((p, i) => (
                        <li
                            key={`${p.stediId}-${i}`}
                            role="option"
                            aria-selected={i === active}
                            onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                            onMouseEnter={() => setActive(i)}
                            className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 ${i === active ? 'bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                        >
                            <span className="min-w-0 truncate text-gray-900 dark:text-gray-100">{p.displayName}</span>
                            <span className="shrink-0 font-mono text-[11px] text-gray-500 dark:text-gray-400">{payerTradingPartnerId(p)}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
