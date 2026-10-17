import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { getPatientsList, getPatientListRowId, type PatientListItem } from '../../services/patient.service';

const DEBOUNCE_MS = 320;

interface AdtPatientQuickSearchProps {
    /** Current workspace patient id for highlighting */
    currentPatientId: string | null;
    className?: string;
}

export function AdtPatientQuickSearch({ currentPatientId, className = '' }: AdtPatientQuickSearchProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [q, setQ] = useState('');
    const [debounced, setDebounced] = useState('');
    const [results, setResults] = useState<PatientListItem[]>([]);
    const [loading, setLoading] = useState(false);

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
                limit: 15,
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

    const goToPatientAdt = (p: PatientListItem) => {
        const id = getPatientListRowId(p);
        const enc = encodeURIComponent(id);
        if (location.pathname.includes('/facesheet/')) {
            navigate(`/app/facesheet/${enc}/adt`);
        } else {
            navigate(`/app/adt?patientId=${enc}`);
        }
        setQ('');
        setResults([]);
    };

    return (
        <div className={`relative ${className}`}>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500" htmlFor="adt-patient-search">
                Switch patient
            </label>
            <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
                <input
                    id="adt-patient-search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, MRN, or phone…"
                    autoComplete="off"
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm dark:border-white/15 dark:bg-[#1a2332]"
                />
                {loading ? (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" aria-hidden />
                ) : null}
            </div>
            {results.length > 0 ? (
                <ul
                    className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-lg dark:border-white/10 dark:bg-[#141210]"
                    role="listbox"
                >
                    {results.map((p) => {
                        const id = getPatientListRowId(p);
                        const active = currentPatientId?.trim() === id.trim();
                        return (
                            <li key={p.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    onClick={() => goToPatientAdt(p)}
                                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-white/5 ${
                                        active ? 'bg-primary/10' : ''
                                    }`}
                                >
                                    <span className="font-semibold text-gray-900 dark:text-white">{p.name}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        MRN {p.mrn}
                                        {active ? ' · current' : ''}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}
