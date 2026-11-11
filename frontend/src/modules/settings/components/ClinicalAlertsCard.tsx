import { forwardRef, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SettingsCardHeader } from './SettingsCardHeader';
import { settingsFieldLabelClass, settingsSecondaryCardClass } from '../../../styles/settingsPageClasses';
import { clearSeverityOverride, listCdsRules, setSeverityOverride } from '../../../services/cds.service';
import { CDS_OVERRIDE_SEVERITIES, type CdsOverrideSeverity, type CdsRuleRow } from '../../../types/cds';
import { useSelector } from 'react-redux';
import type { IRootState } from '../../../store';

const SELECT =
    'h-9 w-full max-w-[11rem] rounded-lg border border-emr-border/90 bg-white px-2 text-[13px] text-emr-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#1c1916] dark:text-gray-100';

/** Admin severity policy for CDS interaction rules (ONC §170.315(a)(4)). */
export const ClinicalAlertsCard = forwardRef<HTMLElement>(function ClinicalAlertsCard(_, ref) {
    const role = useSelector((s: IRootState) => s.auth.user?.role ?? s.auth.role);
    const isAdmin = role === 'admin';
    const [rows, setRows] = useState<CdsRuleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await listCdsRules();
        setLoading(false);
        if (!res.ok) {
            toast.error(res.message);
            return;
        }
        setRows(res.data);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function onSeverityChange(rule: CdsRuleRow, severity: CdsOverrideSeverity | 'default') {
        if (!isAdmin) return;
        setSavingId(rule.id);
        if (severity === 'default') {
            const r = await clearSeverityOverride(rule.id);
            setSavingId(null);
            if (!r.ok) return toast.error(r.message);
            toast.success('Override cleared');
        } else {
            const r = await setSeverityOverride(rule.id, severity);
            setSavingId(null);
            if (!r.ok) return toast.error(r.message);
            toast.success('Severity updated');
        }
        await load();
    }

    return (
        <section ref={ref} id="settings-clinical-alerts" className={settingsSecondaryCardClass} aria-labelledby="clinical-alerts-heading">
            <SettingsCardHeader
                title="Clinical Alerts"
                description="Drug–drug and drug–allergy interaction rules. Adjust effective severity per organization (admin only). Stub teaching rules — not a licensed knowledge base."
            />
            <h2 id="clinical-alerts-heading" className="sr-only">
                Clinical Alerts
            </h2>
            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
                {!isAdmin ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">View only — severity overrides require an admin account.</p>
                ) : null}
                {loading ? (
                    <p className="text-sm text-gray-500">Loading rules…</p>
                ) : rows.length === 0 ? (
                    <p className="text-sm text-gray-500">No interaction rules found. Run migrations and seed CDS stub rules.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-emr-border/80 dark:border-white/10">
                        <table className="min-w-full text-left text-[13px]">
                            <thead className="bg-emr-hover/40 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-white/[0.03]">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">Rule</th>
                                    <th className="px-3 py-2 font-semibold">Type</th>
                                    <th className="px-3 py-2 font-semibold">Default</th>
                                    <th className="px-3 py-2 font-semibold">Effective</th>
                                    <th className="px-3 py-2 font-semibold">Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-t border-emr-border/60 dark:border-white/[0.06]">
                                        <td className="max-w-md px-3 py-2 text-emr-text dark:text-gray-100">
                                            <span className="block font-medium leading-snug">{r.description}</span>
                                            <span className="mt-0.5 block font-mono text-[10px] text-gray-500">
                                                {r.rxnormCodeA}
                                                {r.rxnormCodeB ? ` ↔ ${r.rxnormCodeB}` : ''}
                                                {r.allergyClass ? ` · class ${r.allergyClass}` : ''}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{r.ruleType.replace('_', '–')}</td>
                                        <td className="px-3 py-2 capitalize text-gray-600 dark:text-gray-300">{r.defaultSeverity}</td>
                                        <td className="px-3 py-2">
                                            {isAdmin ? (
                                                <label className="block">
                                                    <span className={settingsFieldLabelClass}>Severity</span>
                                                    <select
                                                        className={SELECT}
                                                        disabled={savingId === r.id}
                                                        value={r.overrideSeverity ?? 'default'}
                                                        onChange={(e) => {
                                                            const v = e.target.value as CdsOverrideSeverity | 'default';
                                                            void onSeverityChange(r, v);
                                                        }}
                                                    >
                                                        <option value="default">Default ({r.defaultSeverity})</option>
                                                        {CDS_OVERRIDE_SEVERITIES.map((s) => (
                                                            <option key={s} value={s}>
                                                                {s === 'suppressed' ? 'Suppressed' : s}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            ) : (
                                                <span className="capitalize">{r.effectiveSeverity}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-gray-500">{r.source}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
});
