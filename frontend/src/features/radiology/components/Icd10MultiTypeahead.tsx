import { useEffect, useRef, useState } from 'react';
import { AutoComplete } from 'primereact/autocomplete';
import { classNames } from 'primereact/utils';
import { NFS_FLOAT_FIELD_LABEL, NFS_OUTLINED_FIELD_FRAME } from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import { getIcd10CmValidationError } from '../../../utils/dischargeReadinessValidation';
import { searchIcd10 } from '../../../services/problemsApi';

export type Icd10Option = { code: string; label: string };

type Icd10MultiTypeaheadProps = {
    fieldId: string;
    label: string;
    value: string[];
    onChange: (codes: string[]) => void;
    /** Optional extras merged into suggestions (e.g. patient's active problem codes). */
    extraSuggestions?: Icd10Option[];
    disabled?: boolean;
    hasError?: boolean;
};

function optionLabel(o: Icd10Option): string {
    return `${o.code} — ${o.label}`;
}

export function Icd10MultiTypeahead({
    fieldId,
    label,
    value,
    onChange,
    extraSuggestions = [],
    disabled,
    hasError,
}: Icd10MultiTypeaheadProps) {
    const [query, setQuery] = useState('');
    const [filtered, setFiltered] = useState<Icd10Option[]>([]);
    const searchSeq = useRef(0);
    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            abortRef.current?.abort();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        },
        []
    );

    const search = (event: { query: string }) => {
        const q = event.query.trim();
        setQuery(event.query);
        const seq = ++searchSeq.current;

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!q) {
            setFiltered(extraSuggestions.slice(0, 25));
            return;
        }

        debounceRef.current = setTimeout(() => {
            if (seq !== searchSeq.current) return;
            abortRef.current?.abort();
            const ac = new AbortController();
            abortRef.current = ac;
            void searchIcd10(q, ac.signal)
                .then((hits) => {
                    if (seq !== searchSeq.current) return;
                    const map = new Map<string, Icd10Option>();
                    for (const o of extraSuggestions) {
                        if (o.code?.trim()) {
                            map.set(o.code.trim().toUpperCase(), { code: o.code.trim(), label: o.label });
                        }
                    }
                    for (const h of hits) {
                        map.set(h.code.toUpperCase(), { code: h.code, label: h.description });
                    }
                    setFiltered([...map.values()].slice(0, 25));
                })
                .catch((err: unknown) => {
                    if ((err as { code?: string })?.code === 'ERR_CANCELED') return;
                    if (seq !== searchSeq.current) return;
                    const ql = q.toLowerCase();
                    setFiltered(
                        extraSuggestions
                            .filter((o) => o.code.toLowerCase().includes(ql) || o.label.toLowerCase().includes(ql))
                            .slice(0, 25)
                    );
                });
        }, 250);
    };

    const addCode = (raw: string) => {
        const code = raw.trim().toUpperCase();
        if (!code || value.includes(code)) return;
        if (getIcd10CmValidationError(code)) return;
        onChange([...value, code]);
        setQuery('');
    };

    return (
        <div className="relative w-full min-w-0">
            <div
                className={classNames(
                    NFS_OUTLINED_FIELD_FRAME,
                    'min-h-8 flex flex-col gap-1 py-1 pl-2 pr-1',
                    hasError && 'border-primary-600 ring-2 ring-primary/20'
                )}
            >
                <label htmlFor={fieldId} className={NFS_FLOAT_FIELD_LABEL}>
                    {label}
                </label>
                {value.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pb-0.5">
                        {value.map((code) => (
                            <span
                                key={code}
                                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary dark:text-primary-200"
                            >
                                {code}
                                {!disabled ? (
                                    <button
                                        type="button"
                                        className="text-primary/80 hover:text-primary"
                                        aria-label={`Remove ${code}`}
                                        onClick={() => onChange(value.filter((c) => c !== code))}
                                    >
                                        ×
                                    </button>
                                ) : null}
                            </span>
                        ))}
                    </div>
                ) : null}
                <AutoComplete
                    inputId={fieldId}
                    value={query}
                    suggestions={filtered}
                    completeMethod={search}
                    field="code"
                    itemTemplate={(item: Icd10Option) => <span className="text-xs">{optionLabel(item)}</span>}
                    onChange={(e) => setQuery(String(e.value ?? ''))}
                    onSelect={(e) => {
                        const item = e.value as Icd10Option;
                        if (item?.code) addCode(item.code);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addCode(query);
                        }
                    }}
                    disabled={disabled}
                    placeholder="Search ICD-10…"
                    className="w-full text-xs"
                    inputClassName="!h-7 !w-full !border-0 !bg-transparent !text-xs !shadow-none"
                    appendTo={typeof document !== 'undefined' ? document.body : undefined}
                    panelClassName="nfs-flowsheet-cal-panel"
                />
            </div>
        </div>
    );
}
