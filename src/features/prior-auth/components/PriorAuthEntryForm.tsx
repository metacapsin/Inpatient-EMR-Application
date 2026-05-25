import { useMemo } from 'react';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Button } from '../../../components/ui/button';
import {
    FlowsheetLabeledDropdown,
    FlowsheetOutlinedCalendar,
    FlowsheetOutlinedTextInput,
    NFS_SECTION_GRID_CLASS,
} from '../../nursing-flowsheet/components/FlowsheetStyledFields';
import { FlowsheetOutlinedTextarea } from '../../io-tracking/components/FlowsheetOutlinedTextarea';
import { Icd10MultiTypeahead } from '../../radiology/components/Icd10MultiTypeahead';
import type { PriorAuthFormValues } from '../types/priorAuth.types';
import { PRIOR_AUTH_SERVICE_TYPES, PRIOR_AUTH_STATUSES } from '../constants/priorAuthOptions';
import { computeUsedUnitsDummy } from '../Prior/priorAuthFormDefaults';
import { CptMultiTypeahead } from './CptMultiTypeahead';

type Props = {
    values: PriorAuthFormValues;
    editingAuthId: string | null;
    busy: boolean;
    onChange: (patch: Partial<PriorAuthFormValues>) => void;
    onCreate: () => void;
    onUpdate: () => void;
    /** Renders fields only (no card shell) — for dialogs. */
    variant?: 'card' | 'embedded';
    onCancel?: () => void;
};

export function PriorAuthEntryForm({
    values,
    editingAuthId,
    busy,
    onChange,
    onCreate,
    onUpdate,
    variant = 'card',
    onCancel,
}: Props) {
    const usedUnits = useMemo(() => computeUsedUnitsDummy(values.approvedUnits), [values.approvedUnits]);

    const serviceOptions = PRIOR_AUTH_SERVICE_TYPES.map((s) => ({ label: s, value: s }));
    const statusOptions = PRIOR_AUTH_STATUSES.map((s) => ({ label: s, value: s }));

    const patchDate = (key: 'requestedDate' | 'authStartDate' | 'authEndDate', d: Date | null) => {
        onChange({ [key]: d ? d.toISOString() : '' });
    };

    const body = (
        <>
            <div className={NFS_SECTION_GRID_CLASS}>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetLabeledDropdown
                        fieldId="pa-service-type"
                        label="Service Type"
                        options={serviceOptions}
                        value={values.serviceType}
                        onChange={(v) => onChange({ serviceType: String(v) as PriorAuthFormValues['serviceType'] })}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-8">
                    <FlowsheetOutlinedTextInput
                        fieldId="pa-service-desc"
                        label="Service Description"
                        value={values.serviceDescription}
                        onChange={(v) => onChange({ serviceDescription: v })}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <Icd10MultiTypeahead
                        fieldId="pa-icd10"
                        label="ICD-10 Code(s)"
                        value={values.icd10Codes}
                        onChange={(codes) => onChange({ icd10Codes: codes })}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <CptMultiTypeahead
                        fieldId="pa-cpt"
                        label="CPT Code(s)"
                        value={values.cptCodes}
                        onChange={(codes) => onChange({ cptCodes: codes })}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedTextInput
                        fieldId="pa-insurance"
                        label="Insurance / Payer"
                        value={values.insurancePayer}
                        onChange={(v) => onChange({ insurancePayer: v })}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedTextInput
                        fieldId="pa-payer-name"
                        label="Payer Name"
                        value={values.payerName}
                        onChange={(v) => onChange({ payerName: v })}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedTextInput
                        fieldId="pa-auth-number"
                        label="Auth Number"
                        value={values.authNumber}
                        onChange={(v) => onChange({ authNumber: v })}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedCalendar
                        fieldId="pa-requested"
                        label="Requested Date"
                        value={values.requestedDate ? new Date(values.requestedDate) : null}
                        onChange={(d) => patchDate('requestedDate', d)}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedCalendar
                        fieldId="pa-start"
                        label="Auth Start Date"
                        value={values.authStartDate ? new Date(values.authStartDate) : null}
                        onChange={(d) => patchDate('authStartDate', d)}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-4">
                    <FlowsheetOutlinedCalendar
                        fieldId="pa-end"
                        label="Auth End Date"
                        value={values.authEndDate ? new Date(values.authEndDate) : null}
                        onChange={(d) => patchDate('authEndDate', d)}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-3">
                    <div className="relative w-full min-w-0">
                        <label htmlFor="pa-approved-units" className="text-[10px] font-semibold text-gray-500">
                            Approved Units
                        </label>
                        <InputNumber
                            inputId="pa-approved-units"
                            value={values.approvedUnits}
                            onValueChange={(e) => onChange({ approvedUnits: e.value ?? 0 })}
                            disabled={busy}
                            min={0}
                            className="mt-1 w-full"
                            inputClassName="w-full rounded-lg border border-primary-200 px-2 py-1.5 text-xs dark:border-primary-700"
                        />
                    </div>
                </div>
                <div className="col-span-12 md:col-span-3">
                    <div className="relative w-full min-w-0">
                        <label htmlFor="pa-used-units" className="text-[10px] font-semibold text-gray-500">
                            Used Units
                        </label>
                        <InputText
                            id="pa-used-units"
                            value={String(usedUnits)}
                            readOnly
                            disabled
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5"
                        />
                    </div>
                </div>
                <div className="col-span-12 md:col-span-3">
                    <FlowsheetLabeledDropdown
                        fieldId="pa-status"
                        label="Status"
                        options={statusOptions}
                        value={values.status}
                        onChange={(v) => onChange({ status: String(v) as PriorAuthFormValues['status'] })}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-3 flex items-end pb-1">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={values.urgentFlag}
                            onChange={(e) => onChange({ urgentFlag: e.target.checked })}
                            disabled={busy}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        Urgent Flag
                    </label>
                </div>
                <div className="col-span-12 md:col-span-6">
                    <FlowsheetOutlinedTextInput
                        fieldId="pa-denial"
                        label="Denial Reason"
                        value={values.denialReason}
                        onChange={(v) => onChange({ denialReason: v })}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12 md:col-span-6">
                    <FlowsheetOutlinedTextInput
                        fieldId="pa-contact"
                        label="Payer Contact"
                        value={values.payerContact}
                        onChange={(v) => onChange({ payerContact: v })}
                        disabled={busy}
                    />
                </div>
                <div className="col-span-12">
                    <FlowsheetOutlinedTextarea
                        fieldId="pa-notes"
                        label="Notes"
                        value={values.notes}
                        onChange={(v) => onChange({ notes: v })}
                        disabled={busy}
                    />
                </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
                {onCancel ? (
                    <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
                        Cancel
                    </Button>
                ) : null}
                {!editingAuthId ? (
                    <Button type="button" disabled={busy} onClick={onCreate}>
                        Create Prior Auth
                    </Button>
                ) : (
                    <Button type="button" disabled={busy} onClick={onUpdate}>
                        Update Prior Auth
                    </Button>
                )}
            </div>
        </>
    );

    if (variant === 'embedded') {
        return body;
    }

    return (
        <div className="rounded-lg border border-emr-border/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#161412]/80">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Prior Authorization Entry</h3>
            {body}
        </div>
    );
}
