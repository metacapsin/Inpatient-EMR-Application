import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Camera, ExternalLink, ShieldCheck, Trash2, UserPlus, UserRoundPen } from 'lucide-react';
import {
    clearPatientPhoto,
    createPatient,
    findDuplicatePatients,
    getPatientRecord,
    updatePatientDetails,
    uploadPatientPhoto,
    type DuplicateCandidate,
    type PatientApiRecord,
    type PatientInsuranceInput,
    type PatientRegistrationPayload,
} from '../../services/patient.service';
import {
    ADVANCE_DIRECTIVE_STATUSES,
    COUNTRIES,
    EMERGENCY_RELATIONSHIPS,
    ETHNICITIES,
    GUARANTOR_RELATIONSHIPS,
    INSURANCE_PLAN_TYPES,
    INSURANCE_STATUSES,
    INSURANCE_TYPES,
    MARITAL_STATUSES,
    NAME_PREFIXES,
    NAME_SUFFIXES,
    PREFERRED_LANGUAGES,
    RACES,
    SEX_OPTIONS,
    US_STATES,
    type ReferenceOption,
} from '../../constants/patientReference';
import {
    SERVICE_TYPE_OPTIONS,
    checkInlineEligibility,
    eligibilityAutoFillPatch,
    payerTradingPartnerId,
    type EligibilitySummary,
} from '../../services/eligibility.service';
import { PayerAutocomplete } from '../../components/patients/PayerAutocomplete';
import { CoverageResultPanel } from '../../components/patients/CoverageResultPanel';
import {
    EMPTY_CONTACT,
    EMPTY_INSURANCE,
    EMPTY_PERSONAL,
    ageInYears,
    formatUsPhone,
    todayYmd,
    validateRegistration,
    type ContactState,
    type Errors,
    type InsuranceState,
    type PersonalState,
} from './patientRegistrationValidation';

/* ------------------------------------------------------------------------------------------------
 * Full-page patient registration (create) and demographics edit (same form, `/app/patients/:id/edit`).
 * Section order follows the EMR-ng reference form (.cursor/plans/patient_registration_redesign_build_plan.md).
 * The thinner "Quick Add" path stays in AddPatientModal. Validation lives in patientRegistrationValidation.ts.
 * ---------------------------------------------------------------------------------------------- */

const INPUT =
    'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-gray-50 disabled:text-gray-500 dark:border-white/10 dark:bg-[#1a1816] dark:text-gray-100 dark:disabled:bg-white/5';
const INPUT_ERROR = 'border-red-400 focus:border-red-500 focus:ring-red-500';
const LABEL = 'mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300';
const BTN_SECONDARY =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5';
const BTN_PRIMARY =
    'inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60';

/* ------------------------------------------- record -> form state (edit mode) ------------------- */

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const yn = (v: unknown): '' | 'yes' | 'no' => (v === true ? 'yes' : v === false ? 'no' : '');

function insuranceFromRecord(raw: unknown): InsuranceState | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const status = str(r.insuranceStatus);
    return {
        ...EMPTY_INSURANCE,
        insuranceType: str(r.insuranceType), insuranceCompany: str(r.insuranceCompany), tradingPartnerServiceId: str(r.tradingPartnerServiceId), subscriberId: str(r.subscriberId),
        insurancePlan: str(r.insurancePlan), groupNumber: str(r.groupNumber), phoneNumber: str(r.phoneNumber),
        coverageStartDate: str(r.coverageStartDate).slice(0, 10), terminationDate: str(r.terminationDate).slice(0, 10),
        insuranceStatus: status === 'Active' || status === 'Inactive' ? status : 'Active',
        coPayAmount: r.coPayAmount === null || r.coPayAmount === undefined ? '' : String(r.coPayAmount),
        medicalGroup: str(r.medicalGroup), pcp: str(r.pcp), guarantor: str(r.guarantor) || 'Self',
        guarantorName: str(r.guarantorName), guarantorAddress: str(r.guarantorAddress),
        guarantorDOB: str(r.guarantorDOB).slice(0, 10), guarantorSubscriberId: str(r.guarantorSubscriberId),
    };
}

function contactFromRecord(raw: unknown): ContactState {
    if (!raw || typeof raw !== 'object') return EMPTY_CONTACT;
    const r = raw as Record<string, unknown>;
    return {
        relationshipToPatient: str(r.relationshipToPatient), contactName: str(r.contactName), contactPhone: str(r.contactPhone),
        street: str(r.street), emergencyCity: str(r.emergencyCity), emergencyState: str(r.emergencyState), emergencyZipCode: str(r.emergencyZipCode),
    };
}

function personalFromRecord(p: PatientApiRecord): PersonalState {
    const r = p as Record<string, unknown>;
    const m = (r.mailingAddress ?? {}) as Record<string, unknown>;
    const home = [str(r.address1), str(r.address2), str(r.city), str(r.state), str(r.zipCode)];
    const mail = [str(m.address1), str(m.address2), str(m.city), str(m.state), str(m.zipCode)];
    const sameAsHome = mail.some(Boolean) && home.every((v, i) => v === mail[i]);
    return {
        ...EMPTY_PERSONAL,
        prefix: str(r.prefix), firstName: str(r.firstName), middleName: str(r.middleName), lastName: str(r.lastName), suffix: str(r.suffix),
        dOB: str(r.dOB).slice(0, 10), sex: str(r.sex), maritalStatus: str(r.maritalStatus),
        email: str(r.email), workEmail: str(r.workEmail), pregnant: yn(r.pregnant), breastfeeding: yn(r.breastfeeding),
        address1: home[0], address2: home[1], city: home[2], state: home[3], zipCode: home[4],
        mailingSameAsHome: sameAsHome,
        mailingAddress1: mail[0], mailingAddress2: mail[1], mailingCity: mail[2], mailingState: mail[3], mailingZipCode: mail[4],
        homePhone: str(r.homePhone), mobilePhone: str(r.mobilePhone), workPhone: str(r.workPhone), otherPhone: str(r.otherPhone),
        advancedHealthCareDirective: str(r.advancedHealthCareDirective), preferredLanguage: str(r.preferredLanguage),
        ethnicity: str(r.ethnicity), race: str(r.race), noticeOfPrivacyPracticesDate: str(r.noticeOfPrivacyPracticesDate).slice(0, 10),
        countryOfBirth: str(r.countryOfBirth),
    };
}

/* ----------------------------------------------- small UI atoms -------------------------------- */

function Field({ id, label, required, error, children, className = '' }: {
    id: string; label: string; required?: boolean; error?: string; children: ReactNode; className?: string;
}) {
    return (
        <div className={className}>
            <label className={LABEL} htmlFor={id}>
                {label}
                {required ? <span className="text-red-500"> *</span> : null}
            </label>
            {children}
            {error ? <p className="mt-1 text-xs font-medium text-red-600" role="alert">{error}</p> : null}
        </div>
    );
}

function TextInput({ id, value, onChange, error, ...rest }: {
    id: string; value: string; onChange: (v: string) => void; error?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'>) {
    return (
        <input
            id={id}
            className={`${INPUT} ${error ? INPUT_ERROR : ''}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
            {...rest}
        />
    );
}

function SelectInput({ id, value, onChange, options, error, placeholder = 'Select', disabled }: {
    id: string; value: string; onChange: (v: string) => void; options: ReferenceOption[]; error?: string; placeholder?: string; disabled?: boolean;
}) {
    return (
        <select id={id} className={`${INPUT} ${error ? INPUT_ERROR : ''}`} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} disabled={disabled}>
            <option value="">{placeholder}</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}

function YesNo({ id, value, onChange, label }: { id: string; value: string; onChange: (v: 'yes' | 'no') => void; label: string }) {
    return (
        <fieldset>
            <legend className={LABEL}>{label}</legend>
            <div className="flex h-10 items-center gap-4 text-sm text-gray-800 dark:text-gray-200">
                {(['yes', 'no'] as const).map((v) => (
                    <label key={v} className="inline-flex items-center gap-1.5">
                        <input type="radio" name={id} value={v} checked={value === v} onChange={() => onChange(v)} className="accent-primary" />
                        {v === 'yes' ? 'Yes' : 'No'}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

function Section({ id, title, subtitle, children, action }: { id: string; title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
    return (
        <section id={id} className="scroll-mt-24 rounded-xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.08] dark:bg-[#1a1a1a]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3 dark:border-white/[0.06]">
                <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
                    {subtitle ? <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

/* ----------------------------------------------- insurance block ------------------------------- */

function InsuranceBlock({ prefix, label, value, onChange, errors, isMinor, onVerify, verifying, verification, verifyError }: {
    prefix: string;
    label: string;
    value: InsuranceState;
    onChange: (next: InsuranceState) => void;
    errors: Errors;
    isMinor: boolean;
    onVerify: () => void;
    verifying: boolean;
    verification: EligibilitySummary | null;
    verifyError: string;
}) {
    const set = (k: keyof InsuranceState) => (v: string) => onChange({ ...value, [k]: v } as InsuranceState);
    const err = (k: keyof InsuranceState) => errors[`${prefix}.${k}`];
    const id = (k: keyof InsuranceState) => `${prefix}-${k}`;
    // Age-aware guarantor rule: a minor cannot be their own guarantor.
    const guarantorOptions = isMinor ? GUARANTOR_RELATIONSHIPS.filter((o) => o.value !== 'Self') : GUARANTOR_RELATIONSHIPS;

    return (
        <div className="rounded-lg border border-dashed border-gray-200 p-4 dark:border-white/10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</h3>
                <div className="flex items-center gap-2">
                    <button type="button" className={BTN_SECONDARY} onClick={onVerify} disabled={verifying || !value.insuranceCompany.trim() || !value.subscriberId.trim()} title={!value.subscriberId.trim() ? 'Enter the member ID first' : 'Run a real-time 270/271 eligibility check'}>
                        <ShieldCheck className="h-4 w-4" aria-hidden />
                        {verifying ? 'Verifying…' : 'Verify Coverage'}
                    </button>
                </div>
            </div>
            {verifying || verification || verifyError ? (
                <div className="mb-3">
                    <CoverageResultPanel summary={verification} error={verifyError} loading={verifying} />
                </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field id={id('insuranceType')} label="Insurance type" error={err('insuranceType')}>
                    <SelectInput id={id('insuranceType')} value={value.insuranceType} onChange={set('insuranceType')} options={INSURANCE_TYPES} error={err('insuranceType')} />
                </Field>
                <Field id={id('insuranceCompany')} label="Insurance company" required error={err('insuranceCompany')}>
                    <PayerAutocomplete
                        id={id('insuranceCompany')}
                        value={value.insuranceCompany}
                        tradingPartnerServiceId={value.tradingPartnerServiceId}
                        onChange={(name, payer) => onChange({ ...value, insuranceCompany: name, tradingPartnerServiceId: payer ? payerTradingPartnerId(payer) : '' })}
                        error={err('insuranceCompany')}
                    />
                </Field>
                <Field id={id('subscriberId')} label="Member / subscriber ID" required error={err('subscriberId')}>
                    <TextInput id={id('subscriberId')} value={value.subscriberId} onChange={set('subscriberId')} maxLength={80} error={err('subscriberId')} />
                </Field>
                <Field id={id('insurancePlan')} label="Plan type" error={err('insurancePlan')}>
                    <SelectInput id={id('insurancePlan')} value={value.insurancePlan} onChange={set('insurancePlan')} options={INSURANCE_PLAN_TYPES} error={err('insurancePlan')} />
                </Field>
                <Field id={id('groupNumber')} label="Group number" error={err('groupNumber')}>
                    <TextInput id={id('groupNumber')} value={value.groupNumber} onChange={set('groupNumber')} maxLength={80} error={err('groupNumber')} />
                </Field>
                <Field id={id('phoneNumber')} label="Company phone" error={err('phoneNumber')}>
                    <TextInput id={id('phoneNumber')} type="tel" value={value.phoneNumber} onChange={(v) => set('phoneNumber')(formatUsPhone(v))} placeholder="(555) 555-5555" error={err('phoneNumber')} />
                </Field>
                <Field id={id('coverageStartDate')} label="Effective date" error={err('coverageStartDate')}>
                    <TextInput id={id('coverageStartDate')} type="date" value={value.coverageStartDate} onChange={set('coverageStartDate')} error={err('coverageStartDate')} />
                </Field>
                <Field id={id('terminationDate')} label="Termination date" error={err('terminationDate')}>
                    <TextInput id={id('terminationDate')} type="date" value={value.terminationDate} onChange={set('terminationDate')} error={err('terminationDate')} />
                </Field>
                <Field id={id('insuranceStatus')} label="Status" required error={err('insuranceStatus')}>
                    <SelectInput id={id('insuranceStatus')} value={value.insuranceStatus} onChange={(v) => onChange({ ...value, insuranceStatus: v as InsuranceState['insuranceStatus'] })} options={INSURANCE_STATUSES} error={err('insuranceStatus')} />
                </Field>
                <Field id={id('coPayAmount')} label="Co-pay amount ($)" error={err('coPayAmount')}>
                    <TextInput id={id('coPayAmount')} inputMode="decimal" value={value.coPayAmount} onChange={set('coPayAmount')} placeholder="0.00" error={err('coPayAmount')} />
                </Field>
                <Field id={id('medicalGroup')} label="Medical group / IPA" error={err('medicalGroup')}>
                    <TextInput id={id('medicalGroup')} value={value.medicalGroup} onChange={set('medicalGroup')} maxLength={100} error={err('medicalGroup')} />
                </Field>
                <Field id={id('pcp')} label="Primary care physician" error={err('pcp')}>
                    <TextInput id={id('pcp')} value={value.pcp} onChange={set('pcp')} maxLength={100} error={err('pcp')} />
                </Field>
                <Field id={id('guarantor')} label="Guarantor relationship" error={err('guarantor')}>
                    <SelectInput id={id('guarantor')} value={value.guarantor} onChange={set('guarantor')} options={guarantorOptions} error={err('guarantor')} />
                </Field>
            </div>

            {value.guarantor && value.guarantor !== 'Self' ? (
                <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-white/[0.03]">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Guarantor information</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field id={id('guarantorName')} label="Guarantor name" required error={err('guarantorName')}>
                            <TextInput id={id('guarantorName')} value={value.guarantorName} onChange={set('guarantorName')} maxLength={100} error={err('guarantorName')} />
                        </Field>
                        <Field id={id('guarantorDOB')} label="Guarantor DOB" error={err('guarantorDOB')}>
                            <TextInput id={id('guarantorDOB')} type="date" max={todayYmd()} value={value.guarantorDOB} onChange={set('guarantorDOB')} error={err('guarantorDOB')} />
                        </Field>
                        <Field id={id('guarantorSubscriberId')} label="Guarantor member ID" error={err('guarantorSubscriberId')}>
                            <TextInput id={id('guarantorSubscriberId')} value={value.guarantorSubscriberId} onChange={set('guarantorSubscriberId')} maxLength={80} error={err('guarantorSubscriberId')} />
                        </Field>
                        <Field id={id('guarantorAddress')} label="Guarantor address" error={err('guarantorAddress')}>
                            <TextInput id={id('guarantorAddress')} value={value.guarantorAddress} onChange={set('guarantorAddress')} maxLength={250} error={err('guarantorAddress')} />
                        </Field>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/* ----------------------------------------------- emergency contact block ----------------------- */

function ContactBlock({ index, value, onChange, errors }: { index: 0 | 1; value: ContactState; onChange: (c: ContactState) => void; errors: Errors }) {
    const prefix = `contact${index}`;
    const set = (k: keyof ContactState) => (v: string) => onChange({ ...value, [k]: v });
    const err = (k: keyof ContactState) => errors[`${prefix}.${k}`];
    const id = (k: keyof ContactState) => `${prefix}-${k}`;
    return (
        <div className="rounded-lg border border-dashed border-gray-200 p-4 dark:border-white/10">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{index === 0 ? 'Primary contact' : 'Secondary contact'}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field id={id('relationshipToPatient')} label="Relationship" error={err('relationshipToPatient')}>
                    <SelectInput id={id('relationshipToPatient')} value={value.relationshipToPatient} onChange={set('relationshipToPatient')} options={EMERGENCY_RELATIONSHIPS} error={err('relationshipToPatient')} />
                </Field>
                <Field id={id('contactName')} label="Contact name" error={err('contactName')}>
                    <TextInput id={id('contactName')} value={value.contactName} onChange={set('contactName')} maxLength={100} error={err('contactName')} />
                </Field>
                <Field id={id('contactPhone')} label="Contact phone" error={err('contactPhone')}>
                    <TextInput id={id('contactPhone')} type="tel" value={value.contactPhone} onChange={(v) => set('contactPhone')(formatUsPhone(v))} placeholder="(555) 555-5555" error={err('contactPhone')} />
                </Field>
                <Field id={id('street')} label="Address" error={err('street')}>
                    <TextInput id={id('street')} value={value.street} onChange={set('street')} maxLength={250} error={err('street')} />
                </Field>
                <Field id={id('emergencyCity')} label="City" error={err('emergencyCity')}>
                    <TextInput id={id('emergencyCity')} value={value.emergencyCity} onChange={set('emergencyCity')} maxLength={100} error={err('emergencyCity')} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field id={id('emergencyState')} label="State" error={err('emergencyState')}>
                        <SelectInput id={id('emergencyState')} value={value.emergencyState} onChange={set('emergencyState')} options={US_STATES} error={err('emergencyState')} />
                    </Field>
                    <Field id={id('emergencyZipCode')} label="ZIP" error={err('emergencyZipCode')}>
                        <TextInput id={id('emergencyZipCode')} inputMode="numeric" value={value.emergencyZipCode} onChange={(v) => set('emergencyZipCode')(v.replace(/\D/g, '').slice(0, 5))} error={err('emergencyZipCode')} />
                    </Field>
                </div>
            </div>
        </div>
    );
}

/* ----------------------------------------------- page ------------------------------------------ */

const SECTIONS = [
    { id: 'identification', label: 'Identification' },
    { id: 'personal', label: 'Personal' },
    { id: 'insurance', label: 'Insurance' },
    { id: 'home-address', label: 'Home address' },
    { id: 'mailing-address', label: 'Mailing address' },
    { id: 'contact', label: 'Contact' },
    { id: 'demographics', label: 'Demographics' },
    { id: 'emergency', label: 'Emergency contacts' },
] as const;

function DuplicateDialog({ matches, onCancel, onProceed }: { matches: DuplicateCandidate[]; onCancel: () => void; onProceed: () => void }) {
    return (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="dup-title">
            <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl dark:bg-[#141210]">
                <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                        <AlertTriangle className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                        <h2 id="dup-title" className="text-base font-semibold text-gray-900 dark:text-white">Possible duplicate patient</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {matches.length === 1 ? 'A patient' : `${matches.length} patients`} with the same name or date of birth already exist. Open the existing chart, or register anyway if this is a different person.
                        </p>
                    </div>
                </div>
                <ul className="mb-4 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-white/5 dark:border-white/10">
                    {matches.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <div className="min-w-0">
                                <p className="truncate font-medium text-gray-900 dark:text-white">{m.fullName || '—'}</p>
                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                    <span className="font-mono">{m.mrn}</span>{m.dOB ? ` · DOB ${m.dOB}` : ''}{m.sex ? ` · ${m.sex}` : ''}{m.mobilePhone ? ` · ${m.mobilePhone}` : ''}
                                </p>
                            </div>
                            <Link to={`/app/facesheet/${encodeURIComponent(m.id)}`} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
                                Open chart <ExternalLink className="h-3 w-3" aria-hidden />
                            </Link>
                        </li>
                    ))}
                </ul>
                <div className="flex justify-end gap-2">
                    <button type="button" className={BTN_SECONDARY} onClick={onCancel}>Go back</button>
                    <button type="button" className={BTN_PRIMARY} onClick={onProceed}>Register anyway</button>
                </div>
            </div>
        </div>
    );
}

export default function PatientRegistrationPage() {
    const navigate = useNavigate();
    const { id: editId } = useParams<{ id: string }>();
    const isEdit = Boolean(editId);

    const [form, setForm] = useState<PersonalState>(EMPTY_PERSONAL);
    const [hasInsurance, setHasInsurance] = useState<'yes' | 'no'>('no');
    const [hasSecondary, setHasSecondary] = useState<'yes' | 'no'>('no');
    const [insurance, setInsurance] = useState<InsuranceState>(EMPTY_INSURANCE);
    const [secondary, setSecondary] = useState<InsuranceState>(EMPTY_INSURANCE);
    const [contacts, setContacts] = useState<[ContactState, ContactState]>([EMPTY_CONTACT, EMPTY_CONTACT]);
    const [errors, setErrors] = useState<Errors>({});
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEdit);
    const [existing, setExisting] = useState<{ mrn: string; fullName: string } | null>(null);
    const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
    const [verifying, setVerifying] = useState<'primary' | 'secondary' | null>(null);
    const [verification, setVerification] = useState<{ primary: EligibilitySummary | null; secondary: EligibilitySummary | null }>({ primary: null, secondary: null });
    const [verifyError, setVerifyError] = useState<{ primary: string; secondary: string }>({ primary: '', secondary: '' });
    // X12 service type the 270 asks about; inpatient EMR defaults to general plan coverage.
    const [serviceType, setServiceType] = useState('30');

    // Photo: a newly selected file is uploaded after save; in edit mode the stored photo shows first
    // and "remove" clears it on save.
    const [photo, setPhoto] = useState<File | null>(null);
    const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
    const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
        if (!photo) { setPhotoUrl(null); return; }
        const url = URL.createObjectURL(photo);
        setPhotoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [photo]);
    const previewUrl = photoUrl ?? (removeExistingPhoto ? null : existingPhotoUrl);

    // Edit mode: prefill from the enriched record.
    useEffect(() => {
        if (!editId) return;
        let cancelled = false;
        setLoading(true);
        getPatientRecord(editId)
            .then((p) => {
                if (cancelled) return;
                setForm(personalFromRecord(p));
                const r = p as Record<string, unknown>;
                const ins = insuranceFromRecord(r.insurance);
                const sec = insuranceFromRecord(r.secondaryInsurance);
                setHasInsurance(ins ? 'yes' : 'no');
                setInsurance(ins ?? EMPTY_INSURANCE);
                setHasSecondary(sec ? 'yes' : 'no');
                setSecondary(sec ?? EMPTY_INSURANCE);
                const list = Array.isArray(r.emergencyContacts) ? (r.emergencyContacts as unknown[]) : [];
                setContacts([contactFromRecord(list[0]), contactFromRecord(list[1])]);
                setExistingPhotoUrl(str(r.profilePicture) || null);
                setExisting({ mrn: str(r.mrn), fullName: str(r.fullName) });
            })
            .catch((err: any) => {
                toast.error(err?.response?.data?.message || 'Could not load patient.');
                navigate('/app/patients/list', { replace: true });
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [editId, navigate]);

    const age = useMemo(() => ageInYears(form.dOB), [form.dOB]);
    const isMinor = age !== null && age < 18;
    const isFemale = form.sex === 'F';

    // Minors cannot be "Self" guarantor: swap the default when DOB makes the patient a minor.
    useEffect(() => {
        if (!isMinor) return;
        setInsurance((i) => (i.guarantor === 'Self' ? { ...i, guarantor: 'Parent' } : i));
        setSecondary((i) => (i.guarantor === 'Self' ? { ...i, guarantor: 'Parent' } : i));
    }, [isMinor]);

    // "Same as home" copies the home address live.
    useEffect(() => {
        if (!form.mailingSameAsHome) return;
        setForm((f) => ({
            ...f,
            mailingAddress1: f.address1, mailingAddress2: f.address2, mailingCity: f.city, mailingState: f.state, mailingZipCode: f.zipCode,
        }));
    }, [form.mailingSameAsHome, form.address1, form.address2, form.city, form.state, form.zipCode]);

    const set = (k: keyof PersonalState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
    const setPhone = (k: keyof PersonalState) => (v: string) => set(k)(formatUsPhone(v));
    const setZip = (k: keyof PersonalState) => (v: string) => set(k)(v.replace(/\D/g, '').slice(0, 5));

    const toInsurancePayload = (i: InsuranceState): PatientInsuranceInput => ({
        ...i,
        coPayAmount: i.coPayAmount === '' ? null : Number(i.coPayAmount),
    });

    const buildPayload = (): PatientRegistrationPayload => {
        const yesNoBool = (v: '' | 'yes' | 'no') => (v === '' ? null : v === 'yes');
        const { mailingSameAsHome, pregnant, breastfeeding, ...rest } = form;
        const mailing = mailingSameAsHome
            ? { mailingAddress1: form.address1, mailingAddress2: form.address2, mailingCity: form.city, mailingState: form.state, mailingZipCode: form.zipCode }
            : {};
        return {
            ...rest,
            ...mailing,
            pregnant: isFemale ? yesNoBool(pregnant) : null,
            breastfeeding: isFemale ? yesNoBool(breastfeeding) : null,
            insurance: hasInsurance === 'yes' ? toInsurancePayload(insurance) : null,
            secondaryInsurance: hasInsurance === 'yes' && hasSecondary === 'yes' ? toInsurancePayload(secondary) : null,
            emergencyContacts: contacts.map((c) => ({ ...c })),
        };
    };

    const scrollToFirstError = (e: Errors) => {
        const first = Object.keys(e)[0];
        if (!first) return;
        const el = document.getElementById(first.replace('.', '-')) ?? document.getElementById(first);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement | null)?.focus?.();
    };

    /** Writes the record (create or update) and the photo, then opens the chart. */
    const save = useCallback(async () => {
        setSaving(true);
        try {
            const payload = buildPayload();
            let id = editId ?? '';
            let label = '';
            if (isEdit && editId) {
                // In edit mode every field is sent so blanks clear server values (empty string -> NULL).
                const updated = await updatePatientDetails(editId, payload);
                label = str((updated as Record<string, unknown>).fullName) || existing?.fullName || 'Patient';
            } else {
                const { patient, eligibility } = await createPatient(payload);
                if (!patient.id) throw new Error('Server did not return the new patient id.');
                id = patient.id;
                label = `${patient.fullName || 'Patient'} registered${patient.mrn ? ` · ${patient.mrn}` : ''}${eligibility?.eligible === false ? ' (eligibility check failed)' : ''}`;
            }
            try {
                if (photo) await uploadPatientPhoto(id, photo);
                else if (isEdit && removeExistingPhoto && existingPhotoUrl) await clearPatientPhoto(id);
            } catch (err: any) {
                toast(`Saved, but the photo could not be updated: ${err?.response?.data?.message || 'upload failed'}.`, { icon: '⚠️' });
            }
            toast.success(isEdit ? `${label} updated.` : `${label}.`);
            navigate(`/app/facesheet/${encodeURIComponent(id)}/demographic`, { replace: true });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || (isEdit ? 'Failed to save changes.' : 'Failed to register patient.'));
        } finally {
            setSaving(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editId, isEdit, existing, photo, removeExistingPhoto, existingPhotoUrl, form, hasInsurance, hasSecondary, insurance, secondary, contacts, navigate]);

    const submit = async (ev: FormEvent) => {
        ev.preventDefault();
        const e = validateRegistration({ form, hasInsurance, hasSecondary, insurance, secondary, contacts });
        setErrors(e);
        if (Object.keys(e).length) {
            toast.error(`Please fix ${Object.keys(e).length} highlighted field${Object.keys(e).length === 1 ? '' : 's'}.`);
            scrollToFirstError(e);
            return;
        }
        if (!isEdit) {
            // Advisory duplicate check: same last name + DOB, or same first + last.
            setSaving(true);
            try {
                const matches = await findDuplicatePatients({ firstName: form.firstName, lastName: form.lastName, dOB: form.dOB });
                if (matches.length) { setDuplicates(matches); setSaving(false); return; }
            } catch {
                // The check is best-effort; never block registration on it.
            }
            setSaving(false);
        }
        await save();
    };

    /**
     * Real-time 270/271 check for one insurance slot (POST /Eligibility/checkInline). Needs the
     * patient's identity from the Personal section; on active coverage the payer's answers
     * (status, dates, co-pay, group, plan type) are written back into the block, as in EMR-ng.
     */
    const verify = async (which: 'primary' | 'secondary') => {
        const block = which === 'primary' ? insurance : secondary;
        const setBlock = which === 'primary' ? setInsurance : setSecondary;
        const missing: string[] = [];
        if (!form.firstName.trim()) missing.push('first name');
        if (!form.lastName.trim()) missing.push('last name');
        if (!form.dOB) missing.push('date of birth');
        if (missing.length) {
            toast.error(`Enter the patient's ${missing.join(', ')} before verifying coverage.`);
            document.getElementById(missing[0] === 'date of birth' ? 'dOB' : missing[0] === 'first name' ? 'firstName' : 'lastName')?.focus();
            return;
        }
        if (!block.subscriberId.trim()) { toast.error('Enter the member / subscriber ID before verifying coverage.'); return; }
        setVerifying(which);
        setVerifyError((v) => ({ ...v, [which]: '' }));
        setVerification((v) => ({ ...v, [which]: null }));
        try {
            const res = await checkInlineEligibility({
                patientId: editId ?? null,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                dOB: form.dOB,
                sex: form.sex || undefined,
                serviceTypeCodes: [serviceType],
                [which === 'primary' ? 'insurance' : 'secondaryInsurance']: {
                    insuranceCompany: block.insuranceCompany,
                    tradingPartnerServiceId: block.tradingPartnerServiceId,
                    subscriberId: block.subscriberId,
                    groupNumber: block.groupNumber,
                },
            });
            const summary = res[which] ?? null;
            if (!summary) {
                setVerifyError((v) => ({ ...v, [which]: 'No response for this insurance. Check the member ID and try again.' }));
                return;
            }
            setVerification((v) => ({ ...v, [which]: summary }));
            if (summary.status === 'active' || summary.status === 'inactive') {
                const patch = eligibilityAutoFillPatch(summary, INSURANCE_PLAN_TYPES.map((o) => o.value));
                if (Object.keys(patch).length) setBlock((b) => ({ ...b, ...patch }));
            }
            if (summary.status === 'active') toast.success('Coverage verified: active.');
            else if (summary.status === 'inactive') toast.error('Payer reports this coverage as inactive.');
            else if (summary.status === 'skipped') toast(summary.error || 'Eligibility service not configured.', { icon: 'ℹ️' });
            else toast.error(summary.errors?.[0] || summary.error || 'Coverage could not be verified.');
        } catch (err: any) {
            setVerifyError((v) => ({ ...v, [which]: err?.response?.data?.message || err?.message || 'Coverage check failed.' }));
        } finally {
            setVerifying(null);
        }
    };

    const onPhotoPick = (ev: ChangeEvent<HTMLInputElement>) => {
        const f = ev.target.files?.[0] ?? null;
        if (f && !f.type.startsWith('image/')) { toast.error('Please choose an image file.'); return; }
        if (f && f.size > 10 * 1024 * 1024) { toast.error('Photo must be under 10 MB.'); return; }
        setPhoto(f);
        setRemoveExistingPhoto(false);
    };
    const onPhotoRemove = () => {
        setPhoto(null);
        if (fileRef.current) fileRef.current.value = '';
        if (existingPhotoUrl) setRemoveExistingPhoto(true);
    };

    const errorCount = Object.keys(errors).length;
    const title = isEdit ? 'Edit Patient' : 'Patient Registration';
    const backHref = isEdit && editId ? `/app/facesheet/${encodeURIComponent(editId)}/demographic` : '/app/patients/list';

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-6xl px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400" role="status">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                Loading patient…
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-3 sm:px-4">
            {duplicates ? (
                <DuplicateDialog
                    matches={duplicates}
                    onCancel={() => setDuplicates(null)}
                    onProceed={() => { setDuplicates(null); void save(); }}
                />
            ) : null}

            {/* Page header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
                        {isEdit ? <UserRoundPen className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
                    </div>
                    <div className="min-w-0">
                        <nav aria-label="Breadcrumb" className="text-[11px] text-gray-500 dark:text-gray-400">
                            <Link to="/app/patients/list" className="hover:text-primary hover:underline">Patient List</Link>
                            <span className="mx-1">/</span>
                            {isEdit && existing ? (
                                <>
                                    <Link to={backHref} className="hover:text-primary hover:underline">{existing.fullName || 'Patient'}</Link>
                                    <span className="mx-1">/</span>
                                </>
                            ) : null}
                            <span className="text-gray-700 dark:text-gray-200">{isEdit ? 'Edit' : 'Register Patient'}</span>
                        </nav>
                        <h1 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h1>
                    </div>
                </div>
                {isEdit ? null : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Need only the basics?{' '}
                        <Link to="/app/patients/list?quickAdd=1" className="font-medium text-primary hover:underline">Quick add</Link> from the patient list.
                    </p>
                )}
            </div>

            <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-5">
                {/* Section jump nav */}
                <aside className="mb-3 lg:mb-0">
                    <nav aria-label="Form sections" className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200/80 bg-white p-1.5 dark:border-white/[0.08] dark:bg-[#1a1a1a] lg:sticky lg:top-20 lg:flex-col">
                        {SECTIONS.map((s) => (
                            <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-primary dark:text-gray-300 dark:hover:bg-white/5">
                                {s.label}
                            </a>
                        ))}
                    </nav>
                </aside>

                <form onSubmit={submit} noValidate className="space-y-4">
                    {/* 1. Patient identification */}
                    <Section id="identification" title="Patient Identification" subtitle={isEdit ? 'MRN cannot be changed.' : 'MRN is assigned by the system when the record is saved.'}>
                        <div className="flex flex-wrap items-center gap-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-primary/10 ring-1 ring-primary/20">
                                    {previewUrl ? <img src={previewUrl} alt="Patient" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6 text-primary/70" aria-hidden />}
                                </div>
                                <div className="space-y-1.5">
                                    <input ref={fileRef} id="patient-photo" type="file" accept="image/*" className="sr-only" onChange={onPhotoPick} />
                                    <div className="flex gap-2">
                                        <button type="button" className={BTN_SECONDARY} onClick={() => fileRef.current?.click()}>
                                            <Camera className="h-4 w-4" aria-hidden /> {previewUrl ? 'Change photo' : 'Add photo'}
                                        </button>
                                        {previewUrl ? (
                                            <button type="button" className={BTN_SECONDARY} onClick={onPhotoRemove} aria-label="Remove photo">
                                                <Trash2 className="h-4 w-4" aria-hidden />
                                            </button>
                                        ) : null}
                                    </div>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">JPG/PNG. Resized to 512px and saved with the record.</p>
                                </div>
                            </div>
                            <Field id="mrn" label="MRN" className="w-48">
                                <input id="mrn" className={`${INPUT} font-mono`} value={isEdit ? existing?.mrn || '' : 'Assigned on save'} readOnly disabled />
                            </Field>
                        </div>
                    </Section>
                    {/* 2. Personal information */}
                    <Section id="personal" title="Personal Information">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Field id="prefix" label="Prefix"><SelectInput id="prefix" value={form.prefix} onChange={set('prefix')} options={NAME_PREFIXES} /></Field>
                            <Field id="firstName" label="First name" required error={errors.firstName}><TextInput id="firstName" value={form.firstName} onChange={set('firstName')} maxLength={35} autoFocus error={errors.firstName} /></Field>
                            <Field id="middleName" label="Middle name" error={errors.middleName}><TextInput id="middleName" value={form.middleName} onChange={set('middleName')} maxLength={35} error={errors.middleName} /></Field>
                            <Field id="lastName" label="Last name" required error={errors.lastName}><TextInput id="lastName" value={form.lastName} onChange={set('lastName')} maxLength={35} error={errors.lastName} /></Field>
                            <Field id="suffix" label="Suffix"><SelectInput id="suffix" value={form.suffix} onChange={set('suffix')} options={NAME_SUFFIXES} /></Field>
                            <Field id="dOB" label="Date of birth" required error={errors.dOB}>
                                <TextInput id="dOB" type="date" max={todayYmd()} value={form.dOB} onChange={set('dOB')} error={errors.dOB} />
                                {age !== null && !errors.dOB ? <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Age {age}{isMinor ? ' · minor' : ''}</p> : null}
                            </Field>
                            <Field id="sex" label="Sex" required error={errors.sex}><SelectInput id="sex" value={form.sex} onChange={set('sex')} options={SEX_OPTIONS} error={errors.sex} /></Field>
                            <Field id="maritalStatus" label="Marital status" required error={errors.maritalStatus}><SelectInput id="maritalStatus" value={form.maritalStatus} onChange={set('maritalStatus')} options={MARITAL_STATUSES} error={errors.maritalStatus} /></Field>
                            <Field id="email" label="Email" error={errors.email} className="sm:col-span-2"><TextInput id="email" type="email" value={form.email} onChange={set('email')} maxLength={200} error={errors.email} /></Field>
                            <Field id="workEmail" label="Work email" error={errors.workEmail} className="sm:col-span-2"><TextInput id="workEmail" type="email" value={form.workEmail} onChange={set('workEmail')} maxLength={200} error={errors.workEmail} /></Field>
                            {isFemale ? (
                                <>
                                    <YesNo id="pregnant" label="Pregnant" value={form.pregnant} onChange={(v) => setForm((f) => ({ ...f, pregnant: v }))} />
                                    <YesNo id="breastfeeding" label="Breastfeeding" value={form.breastfeeding} onChange={(v) => setForm((f) => ({ ...f, breastfeeding: v }))} />
                                </>
                            ) : null}
                        </div>
                    </Section>

                    {/* 3. Insurance */}
                    <Section
                        id="insurance"
                        title="Insurance"
                        subtitle="Search the payer directory, then Verify Coverage runs a real-time 270/271 check and fills in what the payer reports."
                        action={
                            <div className="flex flex-wrap items-end gap-4">
                                {hasInsurance === 'yes' ? (
                                    <Field id="eligibilityServiceType" label="Verify for service type" className="w-56">
                                        <SelectInput id="eligibilityServiceType" value={serviceType} onChange={setServiceType} options={SERVICE_TYPE_OPTIONS.map((o) => ({ value: o.code, label: `${o.code} · ${o.label}` }))} placeholder="Service type" />
                                    </Field>
                                ) : null}
                                <YesNo id="hasInsurance" label="Does the patient have insurance?" value={hasInsurance} onChange={setHasInsurance} />
                            </div>
                        }
                    >
                        {hasInsurance === 'yes' ? (
                            <div className="space-y-4">
                                <InsuranceBlock
                                    prefix="insurance"
                                    label="Primary insurance"
                                    value={insurance}
                                    onChange={setInsurance}
                                    errors={errors}
                                    isMinor={isMinor}
                                    onVerify={() => verify('primary')}
                                    verifying={verifying === 'primary'}
                                    verification={verification.primary}
                                    verifyError={verifyError.primary}
                                />
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <YesNo id="hasSecondary" label="Secondary insurance?" value={hasSecondary} onChange={setHasSecondary} />
                                </div>
                                {hasSecondary === 'yes' ? (
                                    <InsuranceBlock
                                        prefix="secondaryInsurance"
                                        label="Secondary insurance"
                                        value={secondary}
                                        onChange={setSecondary}
                                        errors={errors}
                                        isMinor={isMinor}
                                        onVerify={() => verify('secondary')}
                                        verifying={verifying === 'secondary'}
                                        verification={verification.secondary}
                                        verifyError={verifyError.secondary}
                                    />
                                ) : null}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Patient will be registered as self-pay / uninsured. Insurance can be added later from the chart.</p>
                        )}
                    </Section>

                    {/* 4. Home address */}
                    <Section id="home-address" title="Home Address">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                            <Field id="address1" label="Address line 1" required error={errors.address1} className="lg:col-span-3"><TextInput id="address1" value={form.address1} onChange={set('address1')} maxLength={250} error={errors.address1} /></Field>
                            <Field id="address2" label="Address line 2" className="lg:col-span-3"><TextInput id="address2" value={form.address2} onChange={set('address2')} maxLength={250} /></Field>
                            <Field id="city" label="City" required error={errors.city} className="lg:col-span-2"><TextInput id="city" value={form.city} onChange={set('city')} maxLength={50} error={errors.city} /></Field>
                            <Field id="state" label="State" required error={errors.state} className="lg:col-span-2"><SelectInput id="state" value={form.state} onChange={set('state')} options={US_STATES} error={errors.state} /></Field>
                            <Field id="zipCode" label="ZIP code" required error={errors.zipCode} className="lg:col-span-2"><TextInput id="zipCode" inputMode="numeric" value={form.zipCode} onChange={setZip('zipCode')} error={errors.zipCode} /></Field>
                        </div>
                    </Section>

                    {/* 5. Mailing address */}
                    <Section
                        id="mailing-address"
                        title="Mailing Address"
                        action={
                            <label className="inline-flex h-9 items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                <input type="checkbox" className="accent-primary" checked={form.mailingSameAsHome} onChange={(e) => setForm((f) => ({ ...f, mailingSameAsHome: e.target.checked }))} />
                                Same as home address
                            </label>
                        }
                    >
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                            <Field id="mailingAddress1" label="Address line 1" className="lg:col-span-3"><TextInput id="mailingAddress1" value={form.mailingAddress1} onChange={set('mailingAddress1')} maxLength={250} disabled={form.mailingSameAsHome} /></Field>
                            <Field id="mailingAddress2" label="Address line 2" className="lg:col-span-3"><TextInput id="mailingAddress2" value={form.mailingAddress2} onChange={set('mailingAddress2')} maxLength={250} disabled={form.mailingSameAsHome} /></Field>
                            <Field id="mailingCity" label="City" error={errors.mailingCity} className="lg:col-span-2"><TextInput id="mailingCity" value={form.mailingCity} onChange={set('mailingCity')} maxLength={50} disabled={form.mailingSameAsHome} error={errors.mailingCity} /></Field>
                            <Field id="mailingState" label="State" className="lg:col-span-2"><SelectInput id="mailingState" value={form.mailingState} onChange={set('mailingState')} options={US_STATES} disabled={form.mailingSameAsHome} /></Field>
                            <Field id="mailingZipCode" label="ZIP code" error={errors.mailingZipCode} className="lg:col-span-2"><TextInput id="mailingZipCode" inputMode="numeric" value={form.mailingZipCode} onChange={setZip('mailingZipCode')} disabled={form.mailingSameAsHome} error={errors.mailingZipCode} /></Field>
                        </div>
                    </Section>

                    {/* 6. Contact information */}
                    <Section id="contact" title="Contact Information">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Field id="homePhone" label="Home phone" required error={errors.homePhone}><TextInput id="homePhone" type="tel" value={form.homePhone} onChange={setPhone('homePhone')} placeholder="(555) 555-5555" error={errors.homePhone} /></Field>
                            <Field id="mobilePhone" label="Mobile phone" required error={errors.mobilePhone}><TextInput id="mobilePhone" type="tel" value={form.mobilePhone} onChange={setPhone('mobilePhone')} placeholder="(555) 555-5555" error={errors.mobilePhone} /></Field>
                            <Field id="workPhone" label="Work phone" error={errors.workPhone}><TextInput id="workPhone" type="tel" value={form.workPhone} onChange={setPhone('workPhone')} placeholder="(555) 555-5555" error={errors.workPhone} /></Field>
                            <Field id="otherPhone" label="Other phone" error={errors.otherPhone}><TextInput id="otherPhone" type="tel" value={form.otherPhone} onChange={setPhone('otherPhone')} placeholder="(555) 555-5555" error={errors.otherPhone} /></Field>
                        </div>
                    </Section>

                    {/* 7. Additional demographics */}
                    <Section id="demographics" title="Additional Demographics">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <Field id="advancedHealthCareDirective" label="Advance healthcare directive"><SelectInput id="advancedHealthCareDirective" value={form.advancedHealthCareDirective} onChange={set('advancedHealthCareDirective')} options={ADVANCE_DIRECTIVE_STATUSES} /></Field>
                            <Field id="preferredLanguage" label="Preferred language"><SelectInput id="preferredLanguage" value={form.preferredLanguage} onChange={set('preferredLanguage')} options={PREFERRED_LANGUAGES} /></Field>
                            <Field id="ethnicity" label="Ethnicity"><SelectInput id="ethnicity" value={form.ethnicity} onChange={set('ethnicity')} options={ETHNICITIES} /></Field>
                            <Field id="race" label="Race"><SelectInput id="race" value={form.race} onChange={set('race')} options={RACES} /></Field>
                            <Field id="noticeOfPrivacyPracticesDate" label="Notice of Privacy Practices signed" error={errors.noticeOfPrivacyPracticesDate}><TextInput id="noticeOfPrivacyPracticesDate" type="date" max={todayYmd()} value={form.noticeOfPrivacyPracticesDate} onChange={set('noticeOfPrivacyPracticesDate')} error={errors.noticeOfPrivacyPracticesDate} /></Field>
                            <Field id="countryOfBirth" label="Country of birth"><SelectInput id="countryOfBirth" value={form.countryOfBirth} onChange={set('countryOfBirth')} options={COUNTRIES} /></Field>
                        </div>
                    </Section>

                    {/* 8. Emergency contacts */}
                    <Section id="emergency" title="Emergency Contacts" subtitle="Optional. If you start a contact, name and phone are needed.">
                        <div className="space-y-4">
                            <ContactBlock index={0} value={contacts[0]} onChange={(c) => setContacts([c, contacts[1]])} errors={errors} />
                            <ContactBlock index={1} value={contacts[1]} onChange={(c) => setContacts([contacts[0], c])} errors={errors} />
                        </div>
                    </Section>

                    {/* Sticky action bar */}
                    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200/80 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#141210]/95">
                        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
                            <p className={`text-xs text-gray-500 dark:text-gray-400 ${errorCount ? '' : 'hidden sm:block'}`}>
                                {errorCount ? <span className="font-medium text-red-600">{errorCount} field{errorCount === 1 ? '' : 's'} need attention.</span> : 'Fields marked * are required.'}
                            </p>
                            <div className="flex gap-2">
                                <button type="button" className={BTN_SECONDARY} onClick={() => navigate(backHref)} disabled={saving}>Cancel</button>
                                <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                                    {isEdit ? <UserRoundPen className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
                                    {saving ? 'Saving…' : isEdit ? 'Save changes' : (
                                        <>
                                            <span className="sm:hidden">Register</span>
                                            <span className="hidden sm:inline">Register &amp; open chart</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
