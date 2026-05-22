import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import IconSearch from '../Icon/IconSearch';
import { getPatientsList, getPatientListRowId, type PatientListItem } from '../../services/patient.service';
import { emrHeaderSearchInputClass } from '../../styles/emrLayoutClasses';

const DEBOUNCE_MS = 280;

type HeaderGlobalSearchProps = {
    className?: string;
    id?: string;
    /** Focus input when mounted (mobile search strip). */
    autoFocus?: boolean;
    /** Called when search should close (Escape, result pick, view all). */
    onDismiss?: () => void;
};

export function HeaderGlobalSearch({
    className = '',
    id = 'header-global-search',
    autoFocus = false,
    onDismiss,
}: HeaderGlobalSearchProps) {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [q, setQ] = useState('');
    const [debounced, setDebounced] = useState('');
    const [results, setResults] = useState<PatientListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(q.trim()), DEBOUNCE_MS);
        return () => window.clearTimeout(t);
    }, [q]);

    const runSearch = useCallback(async (term: string) => {
        if (term.length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const res = await getPatientsList({
                page: 1,
                limit: 8,
                search: term,
                sortBy: 'patient',
                sortOrder: 'asc',
            });
            setResults(res.items);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void runSearch(debounced);
    }, [debounced, runSearch]);

    useEffect(() => {
        if (autoFocus) {
            const t = window.setTimeout(() => inputRef.current?.focus(), 50);
            setOpen(true);
            return () => window.clearTimeout(t);
        }
    }, [autoFocus]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                setOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        const onPointerDown = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) {
                setOpen(false);
                onDismiss?.();
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [onDismiss]);

    const goToPatient = (p: PatientListItem) => {
        const id = getPatientListRowId(p);
        navigate(`/app/facesheet/${encodeURIComponent(id)}`);
        setQ('');
        setResults([]);
        setOpen(false);
        setActiveIndex(-1);
        onDismiss?.();
    };

    const goToListSearch = () => {
        const term = q.trim();
        if (!term) return;
        navigate(`/app/patients/list?search=${encodeURIComponent(term)}`);
        setOpen(false);
        onDismiss?.();
    };

    const showPanel = open && (loading || results.length > 0 || debounced.length >= 2);

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && results[activeIndex]) {
                goToPatient(results[activeIndex]);
            } else {
                goToListSearch();
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
            onDismiss?.();
        }
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`} role="search">
            <label htmlFor={id} className="sr-only">
                Global patient search
            </label>
            <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center text-emr-muted dark:text-gray-500">
                    <IconSearch className="h-4 w-4" duotone={false} />
                </span>
                <input
                    ref={inputRef}
                    id={id}
                    type="search"
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setOpen(true);
                        setActiveIndex(-1);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    placeholder="Search patient, MRN, room…"
                    autoComplete="off"
                    className={emrHeaderSearchInputClass}
                />
                {loading ? (
                    <Loader2
                        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-emr-accent"
                        aria-hidden
                    />
                ) : null}
            </div>

            {showPanel ? (
                <ul
                    className="absolute left-0 right-0 top-[calc(100%+4px)] z-[60] max-h-72 overflow-auto rounded-lg border border-emr-border/90 bg-emr-topnav py-1 shadow-[0_12px_32px_-8px_rgba(31,41,55,0.18)] ring-1 ring-black/[0.04] animate-fade-in-down dark:border-white/10 dark:bg-[#141210] dark:ring-white/[0.05]"
                    role="listbox"
                >
                    {loading && results.length === 0 ? (
                        <li className="px-3 py-2.5 text-[12px] text-emr-muted">Searching…</li>
                    ) : null}
                    {!loading && debounced.length >= 2 && results.length === 0 ? (
                        <li className="px-3 py-2.5 text-[12px] text-emr-muted">No patients found</li>
                    ) : null}
                    {results.map((p, idx) => {
                        const id = getPatientListRowId(p);
                        const location = [p.ward, p.room, p.bed].filter(Boolean).join(' · ');
                        const highlighted = idx === activeIndex;
                        return (
                            <li key={p.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={highlighted}
                                    onMouseEnter={() => setActiveIndex(idx)}
                                    onClick={() => goToPatient(p)}
                                    className={[
                                        'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors',
                                        highlighted
                                            ? 'bg-emr-active text-emr-accent dark:bg-primary/15'
                                            : 'hover:bg-emr-hover dark:hover:bg-white/5',
                                    ].join(' ')}
                                >
                                    <span className="truncate text-[13px] font-semibold text-emr-text dark:text-gray-100">
                                        {p.name}
                                    </span>
                                    <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-emr-muted dark:text-gray-400">
                                        <span>MRN {p.mrn || '—'}</span>
                                        {location ? <span>{location}</span> : null}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                    {debounced.length >= 2 ? (
                        <li className="border-t border-emr-border/80 dark:border-white/10">
                            <button
                                type="button"
                                onClick={goToListSearch}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-emr-accent transition-colors hover:bg-emr-hover dark:text-primary-200 dark:hover:bg-white/5"
                            >
                                <Search className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                                View all results for &ldquo;{debounced}&rdquo;
                            </button>
                        </li>
                    ) : null}
                </ul>
            ) : null}
        </div>
    );
}
