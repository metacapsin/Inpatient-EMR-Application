import React, { memo, useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Input } from '../../ui/input';
import type { DischargeSummaryState } from '../../../types/dischargeReadiness';
import NewDropdown from '@/components/ui/NewDropdown';

type Props = {
    summary: DischargeSummaryState;
    canEdit: boolean;
    canSign: boolean;
    onSaveDraft: (partial: Partial<DischargeSummaryState>) => Promise<boolean>;
    onSign: () => Promise<boolean>;
};

const dispositionOptions = ['Home', 'Skilled Nursing Facility', 'Acute Rehab', 'Hospice', 'Another acute hospital', 'AMA', 'Expired'];

function DischargeSummaryTabInner({ summary, canEdit, canSign, onSaveDraft, onSign }: Props) {
    const [local, setLocal] = useState(summary);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLocal(summary);
    }, [summary]);

    const locked = summary.status === 'signed' || !canEdit;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        summary.status === 'signed'
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                            : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                >
                    {summary.status === 'signed' ? `Signed ${summary.signedAt ? new Date(summary.signedAt).toLocaleString() : ''}` : 'Draft'}
                </span>
                {summary.signedBy ? <span className="text-xs text-gray-500">by {summary.signedBy}</span> : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Admission diagnosis / reason</label>
                    <Textarea
                        className="mt-1"
                        rows={2}
                        disabled={locked}
                        value={local.admissionDiagnosis}
                        onChange={(e) => setLocal((s) => ({ ...s, admissionDiagnosis: e.target.value }))}
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Disposition</label>
                        <select
                            className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                            disabled={locked}
                            value={local.disposition}
                            onChange={(e) => setLocal((s) => ({ ...s, disposition: e.target.value }))}
                        >
                            {dispositionOptions.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select> */}
                        <NewDropdown
                            options={[
                                { value: "", label: "Select..." },
                                ...dispositionOptions.map((d) => ({
                                value: d,
                                label: d,
                                })),
                            ]}
                            value={local.disposition}
                            placeholder="Select..."
                            disabled={locked}
                            onChange={(v) =>
                                setLocal((s) => ({
                                ...s,
                                disposition: String(v),
                                }))
                            }
                            />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Condition at discharge</label>
                        <Input
                            className="mt-1"
                            disabled={locked}
                            value={local.conditionAtDischarge}
                            onChange={(e) => setLocal((s) => ({ ...s, conditionAtDischarge: e.target.value }))}
                        />
                    </div>
                </div>
            </div>

            <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Hospital course</label>
                <Textarea
                    className="mt-1"
                    rows={6}
                    disabled={locked}
                    value={local.hospitalCourse}
                    onChange={(e) => setLocal((s) => ({ ...s, hospitalCourse: e.target.value }))}
                />
            </div>

            <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Final diagnoses (ICD-10-CM)</p>
                <ul className="mt-2 space-y-2">
                    {local.finalDiagnoses.map((d) => (
                        <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <code className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">{d.code}</code>
                            <span>{d.description}</span>
                            {d.isPrincipal ? (
                                <span className="rounded bg-primary/15 px-1.5 text-xs font-medium text-primary">Principal</span>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </div>

            <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Procedures</p>
                <ul className="mt-2 space-y-1 text-sm">
                    {local.procedures.map((p) => (
                        <li key={p.id}>
                            <code className="rounded bg-gray-100 px-1.5 dark:bg-gray-800">{p.code}</code> {p.description}
                        </li>
                    ))}
                </ul>
            </div>

            <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Discharge medications</label>
                <ul className="mt-2 space-y-2">
                    {local.dischargeMedications.map((m) => (
                        <li key={m.id} className="rounded border border-gray-200 p-2 text-sm dark:border-gray-700">
                            <span className="font-medium">{m.name}</span>
                            <div className="text-gray-600 dark:text-gray-400">{m.sig}</div>
                        </li>
                    ))}
                </ul>
            </div>

            <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Follow-up &amp; instructions</label>
                <Textarea
                    className="mt-1"
                    rows={4}
                    disabled={locked}
                    value={local.followUpInstructions}
                    onChange={(e) => setLocal((s) => ({ ...s, followUpInstructions: e.target.value }))}
                />
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    disabled={locked || saving}
                    onClick={async () => {
                        setSaving(true);
                        const ok = await onSaveDraft({
                            admissionDiagnosis: local.admissionDiagnosis,
                            hospitalCourse: local.hospitalCourse,
                            disposition: local.disposition,
                            conditionAtDischarge: local.conditionAtDischarge,
                            followUpInstructions: local.followUpInstructions,
                        });
                        setSaving(false);
                        return ok;
                    }}
                >
                    {saving ? 'Saving…' : 'Save draft'}
                </Button>
                <Button
                    type="button"
                    disabled={!canSign || summary.status === 'signed' || saving}
                    onClick={async () => {
                        setSaving(true);
                        const saved = await onSaveDraft({
                            admissionDiagnosis: local.admissionDiagnosis,
                            hospitalCourse: local.hospitalCourse,
                            disposition: local.disposition,
                            conditionAtDischarge: local.conditionAtDischarge,
                            followUpInstructions: local.followUpInstructions,
                        });
                        if (saved) await onSign();
                        setSaving(false);
                    }}
                >
                    Sign discharge summary
                </Button>
            </div>
            {!canEdit && summary.status !== 'signed' ? (
                <p className="text-sm text-gray-500">Your role cannot edit the discharge summary.</p>
            ) : null}
        </div>
    );
}

export const DischargeSummaryTab = memo(DischargeSummaryTabInner);
