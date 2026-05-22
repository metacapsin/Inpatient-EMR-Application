import { useMemo, useState } from 'react';
import { AutoComplete } from 'primereact/autocomplete';
import { classNames } from 'primereact/utils';
import { NFS_FLOAT_FIELD_LABEL, NFS_OUTLINED_FIELD_FRAME } from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import { COMMON_CPT_SUGGESTIONS } from '../constants/priorAuthOptions';

export type CptOption = { code: string; label: string };

type CptMultiTypeaheadProps = {
    fieldId: string;
    label: string;
    value: string[];
    onChange: (codes: string[]) => void;
    disabled?: boolean;
};

function optionLabel(o: CptOption): string {
    return `${o.code} — ${o.label}`;
}

export function CptMultiTypeahead({ fieldId, label, value, onChange, disabled }: CptMultiTypeaheadProps) {
    const [query, setQuery] = useState('');
    const [filtered, setFiltered] = useState<CptOption[]>([]);

    const allOptions = useMemo(() => {
        const map = new Map<string, CptOption>();
        for (const o of COMMON_CPT_SUGGESTIONS) {
            if (o.code?.trim()) map.set(o.code.trim().toUpperCase(), { code: o.code.trim(), label: o.label });
        }
        return [...map.values()];
    }, []);

    const search = (event: { query: string }) => {
        const q = event.query.trim().toLowerCase();
        if (!q) {
            setFiltered(allOptions.slice(0, 25));
            return;
        }
        setFiltered(
            allOptions
                .filter((o) => o.code.toLowerCase().includes(q) || o.label.toLowerCase().includes(q))
                .slice(0, 25)
        );
    };

    const addCode = (raw: string) => {
        const code = raw.trim().toUpperCase();
        if (!code || value.includes(code)) return;
        onChange([...value, code]);
        setQuery('');
    };

    return (
        <div className="relative w-full min-w-0">
            <div className={classNames(NFS_OUTLINED_FIELD_FRAME, 'min-h-8 flex flex-col gap-1 py-1 pl-2 pr-1')}>
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
                    itemTemplate={(item: CptOption) => <span className="text-xs">{optionLabel(item)}</span>}
                    onChange={(e) => setQuery(String(e.value ?? ''))}
                    onSelect={(e) => {
                        const item = e.value as CptOption;
                        if (item?.code) addCode(item.code);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addCode(query);
                        }
                    }}
                    disabled={disabled}
                    placeholder="Search CPT…"
                    className="w-full text-xs"
                    inputClassName="!h-7 !w-full !border-0 !bg-transparent !text-xs !shadow-none"
                    appendTo={typeof document !== 'undefined' ? document.body : undefined}
                    panelClassName="nfs-flowsheet-cal-panel"
                />
            </div>
        </div>
    );
}
