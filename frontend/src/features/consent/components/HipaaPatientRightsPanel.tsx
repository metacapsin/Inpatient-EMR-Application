import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import { cn } from '../../../lib/utils';
import type {
    DisclosureRow,
    PatientRightsRecord,
    PatientRightsRequestPayload,
    PatientRightsStatus,
} from '../../../types/consent';
import { PATIENT_RIGHTS_STATUS_OPTIONS, RESTRICTION_TYPE_OPTIONS } from '../constants/consentOptions';
import { CONSENT_SECTION_CARD_CLASS } from '../constants/consentLayout';
import { SimpleDataTable } from '../../../components/shared/SimpleDataTable';
import {
    ConsentCalendar,
    ConsentDropdown,
    ConsentTextInput,
    ConsentTextarea,
    dateToYmd,
    isoToDate,
    toConsentSelectOptions,
} from './ConsentStyledFields';

type Props = {
    records: PatientRightsRecord[];
    loading?: boolean;
    onCreate: (payload: PatientRightsRequestPayload) => void;
    patientId: string;
    tenantId: string;
};

function addDaysYmd(ymd: string, days: number): string {
    const d = isoToDate(ymd) ?? new Date();
    d.setDate(d.getDate() + days);
    return dateToYmd(d);
}

function AccessRequestForm({
    patientId,
    tenantId,
    onCreate,
}: {
    patientId: string;
    tenantId: string;
    onCreate: (p: PatientRightsRequestPayload) => void;
}) {
    const [requestType, setRequestType] = useState('');
    const [dateReceived, setDateReceived] = useState<Date | null>(new Date());
    const [status, setStatus] = useState<PatientRightsStatus>('Pending');
    const [fulfillmentDate, setFulfillmentDate] = useState<Date | null>(null);

    const submit = () => {
        const received = dateToYmd(dateReceived) || dateToYmd(new Date());
        onCreate({
            patientId,
            tenantId,
            requestType: 'Access Request',
            access: {
                requestType,
                dateReceived: received,
                dueDate: addDaysYmd(received, 30),
                status,
                fulfillmentDate: fulfillmentDate ? dateToYmd(fulfillmentDate) : null,
            },
        });
        setRequestType('');
        setDateReceived(new Date());
        setStatus('Pending');
        setFulfillmentDate(null);
    };

    return (
        <div className="grid grid-cols-12 gap-x-2.5 gap-y-4">
            <div className="col-span-12 sm:col-span-6">
                <ConsentTextInput
                    fieldId="access-request-type"
                    label="Request type"
                    value={requestType}
                    onChange={setRequestType}
                    placeholder="e.g. Copy of medical records"
                />
            </div>
            <div className="col-span-12 sm:col-span-6">
                <ConsentCalendar fieldId="access-date-received" label="Date received" value={dateReceived} onChange={setDateReceived} />
            </div>
            <p className="col-span-12 text-[11px] text-gray-500 dark:text-gray-400">
                Due date auto-calculated (+30 days from received)
            </p>
            <div className="col-span-12 sm:col-span-6">
                <ConsentDropdown
                    fieldId="access-status"
                    label="Status"
                    options={toConsentSelectOptions(PATIENT_RIGHTS_STATUS_OPTIONS)}
                    value={status}
                    onChange={(v) => setStatus(String(v) as PatientRightsStatus)}
                />
            </div>
            <div className="col-span-12 sm:col-span-6">
                <ConsentCalendar
                    fieldId="access-fulfillment"
                    label="Fulfillment date"
                    value={fulfillmentDate}
                    onChange={setFulfillmentDate}
                />
            </div>
            <div className="col-span-12">
                <AppButton type="button" onClick={submit}>
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Record access request
                </AppButton>
            </div>
        </div>
    );
}

function AmendmentRequestForm({
    patientId,
    tenantId,
    onCreate,
}: {
    patientId: string;
    tenantId: string;
    onCreate: (p: PatientRightsRequestPayload) => void;
}) {
    const [recordToAmend, setRecordToAmend] = useState('');
    const [reason, setReason] = useState('');
    const [status, setStatus] = useState<PatientRightsStatus>('Pending');
    const [response, setResponse] = useState('');

    return (
        <div className="grid grid-cols-12 gap-x-2.5 gap-y-4">
            <div className="col-span-12">
                <ConsentTextInput
                    fieldId="amend-record"
                    label="Record to amend"
                    value={recordToAmend}
                    onChange={setRecordToAmend}
                />
            </div>
            <div className="col-span-12">
                <ConsentTextarea fieldId="amend-reason" label="Reason" value={reason} onChange={setReason} rows={3} />
            </div>
            <div className="col-span-12 sm:col-span-6">
                <ConsentDropdown
                    fieldId="amend-status"
                    label="Status"
                    options={toConsentSelectOptions(PATIENT_RIGHTS_STATUS_OPTIONS)}
                    value={status}
                    onChange={(v) => setStatus(String(v) as PatientRightsStatus)}
                />
            </div>
            <div className="col-span-12">
                <ConsentTextarea fieldId="amend-response" label="Response" value={response} onChange={setResponse} rows={2} />
            </div>
            <div className="col-span-12">
                <AppButton
                    type="button"
                    onClick={() => {
                        onCreate({
                            patientId,
                            tenantId,
                            requestType: 'Amendment Request',
                            amendment: { recordToAmend, reason, status, response: response || null },
                        });
                        setRecordToAmend('');
                        setReason('');
                        setResponse('');
                    }}
                >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Record amendment
                </AppButton>
            </div>
        </div>
    );
}

function RestrictionRequestForm({
    patientId,
    tenantId,
    onCreate,
}: {
    patientId: string;
    tenantId: string;
    onCreate: (p: PatientRightsRequestPayload) => void;
}) {
    const [selected, setSelected] = useState<string[]>([]);
    const [specificPayer, setSpecificPayer] = useState('');
    const [status, setStatus] = useState<PatientRightsStatus>('Pending');

    const toggle = (t: string) => {
        setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
    };

    return (
        <div className="space-y-4">
            <fieldset>
                <legend className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                    Restriction type
                </legend>
                <div className="flex flex-wrap gap-2">
                    {RESTRICTION_TYPE_OPTIONS.map((t) => {
                        const on = selected.includes(t);
                        return (
                            <button
                                key={t}
                                type="button"
                                onClick={() => toggle(t)}
                                className={cn(
                                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                                    on
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-gray-200 text-gray-700 hover:border-primary/50 dark:border-white/10 dark:text-gray-300',
                                )}
                            >
                                {t}
                            </button>
                        );
                    })}
                </div>
            </fieldset>
            <ConsentTextInput
                fieldId="restrict-payer"
                label="Specific payer to restrict"
                value={specificPayer}
                onChange={setSpecificPayer}
            />
            <ConsentDropdown
                fieldId="restrict-status"
                label="Status"
                options={toConsentSelectOptions(PATIENT_RIGHTS_STATUS_OPTIONS)}
                value={status}
                onChange={(v) => setStatus(String(v) as PatientRightsStatus)}
            />
            <AppButton
                type="button"
                onClick={() => {
                    onCreate({
                        patientId,
                        tenantId,
                        requestType: 'Restriction Request',
                        restriction: {
                            restrictionTypes: selected,
                            specificPayer: specificPayer.trim() || null,
                            status,
                        },
                    });
                    setSelected([]);
                    setSpecificPayer('');
                }}
            >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Record restriction
            </AppButton>
        </div>
    );
}

function RepresentativeForm({
    patientId,
    tenantId,
    onCreate,
}: {
    patientId: string;
    tenantId: string;
    onCreate: (p: PatientRightsRequestPayload) => void;
}) {
    const [name, setName] = useState('');
    const [relationship, setRelationship] = useState('');
    const [authorityLevel, setAuthorityLevel] = useState('');

    return (
        <div className="grid grid-cols-12 gap-x-2.5 gap-y-4">
            <div className="col-span-12 sm:col-span-4">
                <ConsentTextInput fieldId="rep-name" label="Name" value={name} onChange={setName} />
            </div>
            <div className="col-span-12 sm:col-span-4">
                <ConsentTextInput fieldId="rep-relationship" label="Relationship" value={relationship} onChange={setRelationship} />
            </div>
            <div className="col-span-12 sm:col-span-4">
                <ConsentTextInput fieldId="rep-authority" label="Authority level" value={authorityLevel} onChange={setAuthorityLevel} />
            </div>
            <div className="col-span-12">
                <AppButton
                    type="button"
                    onClick={() => {
                        onCreate({
                            patientId,
                            tenantId,
                            requestType: 'Patient Representative Designation',
                            representative: { name, relationship, authorityLevel },
                        });
                        setName('');
                        setRelationship('');
                        setAuthorityLevel('');
                    }}
                >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Save designation
                </AppButton>
            </div>
        </div>
    );
}

export function HipaaPatientRightsPanel({ records, loading, onCreate, patientId, tenantId }: Props) {
    const [openSection, setOpenSection] = useState<string | null>('access');
    const toggle = (id: string) => setOpenSection((s) => (s === id ? null : id));

    const disclosureRows: DisclosureRow[] =
        records.find((r) => r.requestType === 'Accounting of Disclosures')?.disclosures ?? [];

    const sections = [
        {
            id: 'access',
            title: 'Access request',
            content: <AccessRequestForm patientId={patientId} tenantId={tenantId} onCreate={onCreate} />,
        },
        {
            id: 'amendment',
            title: 'Amendment request',
            content: <AmendmentRequestForm patientId={patientId} tenantId={tenantId} onCreate={onCreate} />,
        },
        {
            id: 'restriction',
            title: 'Restriction request',
            content: <RestrictionRequestForm patientId={patientId} tenantId={tenantId} onCreate={onCreate} />,
        },
        {
            id: 'accounting',
            title: 'Accounting of disclosures',
            content: (
                <SimpleDataTable
                    columns={[
                        { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
                        { key: 'to', header: 'Disclosed To', render: (r) => r.disclosedTo },
                        { key: 'purpose', header: 'Purpose', render: (r) => r.purpose },
                        { key: 'info', header: 'Info Disclosed', render: (r) => r.infoDisclosed },
                    ]}
                    rows={disclosureRows}
                    rowKey={(r) => r.id}
                    emptyMessage="No disclosures on file for this patient"
                />
            ),
        },
        {
            id: 'representative',
            title: 'Patient representative designation',
            content: <RepresentativeForm patientId={patientId} tenantId={tenantId} onCreate={onCreate} />,
        },
    ];

    return (
        <section className={CONSENT_SECTION_CARD_CLASS}>
            <div className="border-b border-gray-200/90 px-4 py-3 dark:border-white/10">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">HIPAA patient rights</h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Access, amendment, restriction, accounting of disclosures, and representative designation
                </p>
            </div>
            <div className={cn(loading && 'pointer-events-none opacity-60')}>
                {sections.map((s) => (
                    <div key={s.id} className="border-b border-gray-100 last:border-0 dark:border-white/5">
                        <button
                            type="button"
                            onClick={() => toggle(s.id)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-primary/[0.04] dark:text-gray-100 dark:hover:bg-white/[0.03]"
                            aria-expanded={openSection === s.id}
                        >
                            {s.title}
                            <ChevronDown
                                className={cn('h-4 w-4 text-gray-400 transition', openSection === s.id && 'rotate-180')}
                                aria-hidden
                            />
                        </button>
                        {openSection === s.id ? <div className="px-4 pb-4">{s.content}</div> : null}
                    </div>
                ))}
            </div>
            {records.length > 0 ? (
                <div className="border-t border-gray-200/90 px-4 py-3 dark:border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                        Recent requests
                    </p>
                    <ul className="mt-2 space-y-1">
                        {records.slice(0, 5).map((r) => (
                            <li key={r.id} className="text-xs text-gray-700 dark:text-gray-300">
                                {r.requestType} — {new Date(r.createdAt).toLocaleDateString()}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </section>
    );
}
