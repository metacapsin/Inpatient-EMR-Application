import { useEffect, useState } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
    FlowsheetLabeledDropdown,
    FlowsheetOutlinedCalendar,
    NFS_SECTION_GRID_CLASS,
} from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import { FlowsheetOutlinedTextarea } from '../../io-tracking/components/FlowsheetOutlinedTextarea';
import { FlowsheetOutlinedTextInput } from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import type { CDIQueryFormValues, CDIQueryOption, CDIQueryType, CDIWorklistRecord } from '../types/cdi.types';
import { CDI_QUERY_TYPES, MOCK_PHYSICIANS } from '../types/cdi.types';

type Props = {
    open: boolean;
    row: CDIWorklistRecord | null;
    cdiUserName: string;
    busy: boolean;
    onClose: () => void;
    onSend: (form: CDIQueryFormValues) => Promise<boolean>;
};

function parseDate(iso: string): Date | null {
    if (!iso?.trim()) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(d: Date | null): string {
    return d ? d.toISOString().slice(0, 10) : '';
}

function emptyForm(row: CDIWorklistRecord | null, cdiUserName: string): CDIQueryFormValues {
    const rev =
        row?.revenueOpportunity ??
        (row?.potentialDrg ? Math.round((1.15 - row.currentDrgWeight) * 8500) : 0);
    return {
        queryType: 'Unclear Documentation',
        clinicalScenario: '',
        questionToPhysician: '',
        optionsProvided: [{ id: `opt-${Date.now()}`, text: '' }],
        sentTo: row?.attendingPhysician ?? '',
        sentToPhysicianId: row?.attendingPhysicianId ?? '',
        dueDate: '',
        currentDrg: row?.currentDrg ?? '',
        potentialDrg: row?.potentialDrg ?? '',
        revenueOpportunity: rev,
        sentBy: cdiUserName,
        sentAt: new Date().toISOString(),
    };
}

export function CDIQueryFormDrawer({ open, row, cdiUserName, busy, onClose, onSend }: Props) {
    const [form, setForm] = useState<CDIQueryFormValues>(() => emptyForm(null, cdiUserName));

    useEffect(() => {
        if (open) setForm(emptyForm(row, cdiUserName));
    }, [open, row, cdiUserName]);

    const patch = (p: Partial<CDIQueryFormValues>) => setForm((f) => ({ ...f, ...p }));

    const physicianOptions = MOCK_PHYSICIANS.map((p) => ({ label: p.name, value: p.id }));

    const updateOption = (id: string, text: string) => {
        patch({
            optionsProvided: form.optionsProvided.map((o) => (o.id === id ? { ...o, text } : o)),
        });
    };

    const addOption = () => {
        patch({
            optionsProvided: [...form.optionsProvided, { id: `opt-${Date.now()}`, text: '' }],
        });
    };

    const removeOption = (id: string) => {
        if (form.optionsProvided.length <= 1) return;
        patch({ optionsProvided: form.optionsProvided.filter((o) => o.id !== id) });
    };

    const onPhysicianChange = (physicianId: string) => {
        const p = MOCK_PHYSICIANS.find((x) => x.id === physicianId);
        patch({
            sentToPhysicianId: physicianId,
            sentTo: p?.name ?? '',
        });
    };

    const handleSend = async () => {
        const cleanedOptions = form.optionsProvided.filter((o) => o.text.trim());
        const ok = await onSend({
            ...form,
            optionsProvided: cleanedOptions,
            sentAt: new Date().toISOString(),
            sentBy: cdiUserName,
        });
        if (ok) onClose();
    };

    const typeOptions = CDI_QUERY_TYPES.map((t) => ({ label: t, value: t }));

    return (
        <Sidebar
            visible={open}
            position="right"
            onHide={onClose}
            className="w-[min(100vw,520px)] !max-w-[100vw] border-l border-gray-200/90 dark:border-white/10"
            header={
                <span className="text-sm font-semibold text-gray-900 dark:text-white">CDI Query Form</span>
            }
            pt={{ content: { className: '!m-0 !overflow-y-auto !p-4' } }}
        >
            {row ? (
                <div className={NFS_SECTION_GRID_CLASS}>
                    <div className="col-span-12">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {row.patientName} · Encounter {row.encounterId}
                        </p>
                    </div>
                    <div className="col-span-12">
                        <FlowsheetLabeledDropdown
                            fieldId="cdi-query-type"
                            label="Query Type"
                            options={typeOptions}
                            value={form.queryType}
                            onChange={(v) => patch({ queryType: String(v) as CDIQueryType })}
                            disabled={busy}
                        />
                    </div>
                    <div className="col-span-12">
                        <FlowsheetOutlinedTextarea
                            fieldId="clinical-scenario"
                            label="Clinical Scenario"
                            value={form.clinicalScenario}
                            onChange={(v) => patch({ clinicalScenario: v })}
                            disabled={busy}
                            rows={3}
                        />
                    </div>
                    <div className="col-span-12">
                        <FlowsheetOutlinedTextarea
                            fieldId="question-physician"
                            label="Question to Physician"
                            value={form.questionToPhysician}
                            onChange={(v) => patch({ questionToPhysician: v })}
                            disabled={busy}
                            rows={3}
                        />
                    </div>
                    <div className="col-span-12 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                Options Provided
                            </span>
                            <button
                                type="button"
                                onClick={addOption}
                                disabled={busy}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                            >
                                <Plus className="h-3 w-3" /> Add option
                            </button>
                        </div>
                        {form.optionsProvided.map((opt) => (
                            <div key={opt.id} className="flex gap-2">
                                <FlowsheetOutlinedTextInput
                                    fieldId={`opt-${opt.id}`}
                                    label="Option"
                                    value={opt.text}
                                    onChange={(v) => updateOption(opt.id, v)}
                                    disabled={busy}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeOption(opt.id)}
                                    disabled={busy || form.optionsProvided.length <= 1}
                                    className="mt-5 shrink-0 text-gray-400 hover:text-red-600 disabled:opacity-30"
                                    aria-label="Remove option"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="col-span-12">
                        <FlowsheetLabeledDropdown
                            fieldId="sent-to"
                            label="Sent To"
                            options={physicianOptions}
                            value={form.sentToPhysicianId}
                            onChange={(v) => onPhysicianChange(String(v))}
                            disabled={busy}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedCalendar
                            fieldId="due-date"
                            label="Due Date"
                            value={parseDate(form.dueDate)}
                            onChange={(d) => patch({ dueDate: toIsoDate(d) })}
                            disabled={busy}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedTextInput
                            fieldId="current-drg"
                            label="Current DRG"
                            value={form.currentDrg}
                            onChange={() => {}}
                            readOnly
                            disabled
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedTextInput
                            fieldId="potential-drg"
                            label="Potential DRG (if clarified)"
                            value={form.potentialDrg}
                            onChange={(v) => {
                                const rev = v.trim()
                                    ? Math.round((1.15 - (row?.currentDrgWeight ?? 1)) * 8500)
                                    : 0;
                                patch({ potentialDrg: v, revenueOpportunity: rev });
                            }}
                            disabled={busy}
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedTextInput
                            fieldId="revenue-opportunity"
                            label="Revenue Opportunity"
                            value={String(form.revenueOpportunity)}
                            onChange={() => {}}
                            readOnly
                            disabled
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedTextInput
                            fieldId="sent-by"
                            label="Sent By"
                            value={form.sentBy}
                            onChange={() => {}}
                            readOnly
                            disabled
                        />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                        <FlowsheetOutlinedTextInput
                            fieldId="sent-at"
                            label="Sent At"
                            value={form.sentAt ? new Date(form.sentAt).toLocaleString() : ''}
                            onChange={() => {}}
                            readOnly
                            disabled
                        />
                    </div>
                    <div className="col-span-12 flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void handleSend()} disabled={busy}>
                            Send query
                        </Button>
                    </div>
                </div>
            ) : null}
        </Sidebar>
    );
}
