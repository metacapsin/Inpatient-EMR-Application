import { useMemo, useState } from 'react';
import { AlertTriangle, Ban, Info, ShieldAlert } from 'lucide-react';
import type { CdsAlert, CdsSeverity } from '../../types/cds';
import { requiresOverride, sortAlertsBySeverity } from '../../types/cds';

const SEVERITY_STYLE: Record<CdsSeverity, { label: string; bar: string; icon: typeof Info }> = {
    contraindicated: { label: 'Contraindicated', bar: 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100', icon: Ban },
    major: { label: 'Major', bar: 'border-orange-500 bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-100', icon: ShieldAlert },
    moderate: { label: 'Moderate', bar: 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100', icon: AlertTriangle },
    minor: { label: 'Advisory', bar: 'border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100', icon: Info },
};

type Props = {
    alerts: CdsAlert[];
    onCancel?: () => void;
    onProceed?: (reason: string | null) => void;
    submitting?: boolean;
    title?: string;
    /** `preview` = live check after drug select (no override actions). `blocking` = place-order gate. */
    variant?: 'preview' | 'blocking';
};

export function CdsAlertPanel({
    alerts,
    onCancel,
    onProceed,
    submitting,
    title = 'Clinical decision support alerts',
    variant = 'blocking',
}: Props) {
    const sorted = useMemo(() => sortAlertsBySeverity(alerts), [alerts]);
    const needsReason = requiresOverride(sorted);
    const [reason, setReason] = useState('');
    const [touched, setTouched] = useState(false);
    const reasonError = needsReason && reason.trim().length < 3 ? 'Enter an override reason (at least 3 characters)' : '';
    const isPreview = variant === 'preview';

    const bySeverity = useMemo(() => {
        const map = new Map<CdsSeverity, CdsAlert[]>();
        for (const a of sorted) {
            const list = map.get(a.severity) ?? [];
            list.push(a);
            map.set(a.severity, list);
        }
        return map;
    }, [sorted]);

    return (
        <div
            role="alertdialog"
            aria-labelledby="cds-alert-title"
            className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#1a1816]"
        >
            <div className="mb-3 flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" aria-hidden />
                <div>
                    <h3 id="cds-alert-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {title}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                        {isPreview
                            ? needsReason
                                ? 'Major or contraindicated alerts detected. An override reason will be required when you place this order.'
                                : 'Review these advisories before completing the order.'
                            : needsReason
                              ? 'Major or contraindicated alerts require an override reason before proceeding.'
                              : 'Review these advisories. You may proceed without an override.'}
                    </p>
                    <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                        Stub teaching rules only — not a validated clinical knowledge base.
                    </p>
                </div>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto">
                {(['contraindicated', 'major', 'moderate', 'minor'] as const).map((sev) => {
                    const group = bySeverity.get(sev);
                    if (!group?.length) return null;
                    const style = SEVERITY_STYLE[sev];
                    const Icon = style.icon;
                    return (
                        <div key={sev} className={`rounded-md border-l-4 px-3 py-2 ${style.bar}`}>
                            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                                <Icon className="h-3.5 w-3.5" aria-hidden />
                                {style.label}
                            </p>
                            <ul className="space-y-1.5">
                                {group.map((a, i) => (
                                    <li key={`${a.ruleId}-${i}`} className="text-xs leading-snug">
                                        {a.message}
                                        {a.matchedName ? <span className="mt-0.5 block text-[10px] opacity-80">Matched: {a.matchedName}</span> : null}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>

            {!isPreview && needsReason ? (
                <div className="mt-3">
                    <label htmlFor="cds-override-reason" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Override reason
                    </label>
                    <textarea
                        id="cds-override-reason"
                        rows={3}
                        className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 dark:border-white/[0.08] dark:bg-[#1a1816]"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        onBlur={() => setTouched(true)}
                        placeholder="Document clinical rationale for proceeding…"
                        maxLength={1000}
                    />
                    {touched && reasonError ? <p className="mt-1 text-[11px] text-red-600">{reasonError}</p> : null}
                </div>
            ) : null}

            {!isPreview ? (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => onCancel?.()}
                        disabled={submitting}
                        className="rounded-md border border-gray-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={() => {
                            setTouched(true);
                            if (needsReason && reason.trim().length < 3) return;
                            onProceed?.(needsReason ? reason.trim() : null);
                        }}
                        className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                    >
                        {submitting ? 'Saving…' : needsReason ? 'Override & proceed' : 'Proceed'}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
