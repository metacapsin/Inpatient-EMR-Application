import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppModal } from '../../../components/shared/AppModal';
import AppButton from '../../../components/ui/AppButton';
import { getTemplateVersion } from '../../../services/consent.service';
import type { ConsentRecord, CreateConsentPayload, SignedByType } from '../../../types/consent';
import {
    COMMON_LANGUAGES,
    INTERPRETER_TYPES,
    OBTAIN_CONSENT_TYPES,
    SIGNER_TYPES,
} from '../constants/consentOptions';
import { CONSENT_FORM_SCROLL_CLASS } from '../constants/consentLayout';
import { obtainConsentFormSchema, type ObtainConsentFormValues } from '../validation/consentForm.schema';
import { SignaturePadField } from './SignaturePadField';
import {
    ConsentCalendar,
    ConsentDropdown,
    ConsentFieldError,
    ConsentSegmentedChoice,
    ConsentSignatureFrame,
    ConsentTextInput,
    ConsentTextarea,
    CONSENT_FORM_GRID_CLASS,
    dateToIso,
    isoToDate,
    toConsentSelectOptions,
} from './ConsentStyledFields';

const FORM_ID = 'obtain-consent-form';

const YES_NO = [
    { label: 'Yes', value: 'yes' as const },
    { label: 'No', value: 'no' as const },
];

type Props = {
    open: boolean;
    onClose: () => void;
    loading?: boolean;
    witnessId: string;
    witnessName: string;
    obtainedBy: string;
    obtainedByName: string;
    reObtainFrom?: ConsentRecord | null;
    onSubmit: (payload: CreateConsentPayload) => void;
    patientId: string;
    encounterId: string;
    tenantId: string;
};

export function ObtainConsentModal({
    open,
    onClose,
    loading,
    witnessId,
    witnessName,
    obtainedBy,
    obtainedByName,
    reObtainFrom,
    onSubmit,
    patientId,
    encounterId,
    tenantId,
}: Props) {
    const defaultType = reObtainFrom?.consentType ?? 'General Treatment';

    const {
        control,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm<ObtainConsentFormValues>({
        resolver: zodResolver(obtainConsentFormSchema),
        defaultValues: {
            consentType: OBTAIN_CONSENT_TYPES.includes(defaultType as (typeof OBTAIN_CONSENT_TYPES)[number])
                ? (defaultType as ObtainConsentFormValues['consentType'])
                : 'General Treatment',
            procedureName: reObtainFrom?.procedureName ?? '',
            templateVersion: getTemplateVersion(defaultType as ObtainConsentFormValues['consentType']),
            signedByType: reObtainFrom?.signedByType ?? 'Patient',
            signedByName: reObtainFrom?.signedByName ?? '',
            signedByRelationship: reObtainFrom?.signedByRelationship ?? '',
            patientHasCapacity: reObtainFrom?.patientHasCapacity ?? true,
            capacityAssessmentNote: reObtainFrom?.capacityAssessmentNote ?? '',
            languageUsed: reObtainFrom?.languageUsed ?? 'English',
            interpreterUsed: reObtainFrom?.interpreterUsed ?? false,
            interpreterName: reObtainFrom?.interpreterName ?? '',
            interpreterType: reObtainFrom?.interpreterType ?? undefined,
            patientSignatureData: '',
            witnessSignatureData: '',
            witnessName,
            signedAt: new Date().toISOString(),
            obtainedByName,
        },
    });

    const consentType = watch('consentType');
    const signedByType = watch('signedByType');
    const patientHasCapacity = watch('patientHasCapacity');
    const interpreterUsed = watch('interpreterUsed');

    useEffect(() => {
        if (!open) return;
        setValue('templateVersion', getTemplateVersion(consentType));
    }, [consentType, open, setValue]);

    useEffect(() => {
        if (!open) return;
        reset({
            consentType: OBTAIN_CONSENT_TYPES.includes(defaultType as (typeof OBTAIN_CONSENT_TYPES)[number])
                ? (defaultType as ObtainConsentFormValues['consentType'])
                : 'General Treatment',
            procedureName: reObtainFrom?.procedureName ?? '',
            templateVersion: getTemplateVersion(
                (reObtainFrom?.consentType ?? 'General Treatment') as ObtainConsentFormValues['consentType'],
            ),
            signedByType: reObtainFrom?.signedByType ?? 'Patient',
            signedByName: reObtainFrom?.signedByName ?? '',
            signedByRelationship: reObtainFrom?.signedByRelationship ?? '',
            patientHasCapacity: reObtainFrom?.patientHasCapacity ?? true,
            capacityAssessmentNote: reObtainFrom?.capacityAssessmentNote ?? '',
            languageUsed: reObtainFrom?.languageUsed ?? 'English',
            interpreterUsed: reObtainFrom?.interpreterUsed ?? false,
            interpreterName: reObtainFrom?.interpreterName ?? '',
            interpreterType: reObtainFrom?.interpreterType ?? undefined,
            patientSignatureData: '',
            witnessSignatureData: '',
            witnessName,
            signedAt: new Date().toISOString(),
            obtainedByName,
        });
    }, [open, reObtainFrom, reset, witnessName, obtainedByName, defaultType]);

    const submit = handleSubmit((values) => {
        onSubmit({
            patientId,
            encounterId,
            tenantId,
            consentType: values.consentType,
            procedureName: values.consentType === 'Procedure-Specific' ? values.procedureName?.trim() ?? null : null,
            templateVersion: values.templateVersion,
            templateS3Key: `templates/${values.consentType.toLowerCase().replace(/\s+/g, '-')}.pdf`,
            signedByType: values.signedByType,
            signedByName: values.signedByName.trim(),
            signedByRelationship:
                values.signedByType !== 'Patient' ? values.signedByRelationship?.trim() ?? null : null,
            patientHasCapacity: values.patientHasCapacity,
            capacityAssessmentNote: !values.patientHasCapacity ? values.capacityAssessmentNote?.trim() ?? null : null,
            interpreterUsed: values.interpreterUsed,
            interpreterName: values.interpreterUsed ? values.interpreterName?.trim() ?? null : null,
            interpreterType: values.interpreterUsed ? values.interpreterType ?? null : null,
            languageUsed: values.languageUsed,
            patientSignatureData: values.patientSignatureData,
            witnessSignatureData: values.witnessSignatureData,
            witnessId,
            witnessName: values.witnessName,
            signedAt: values.signedAt,
            status: 'Signed',
            expiryDate: null,
            revokedAt: null,
            revokedReason: null,
            signedPdfS3Key: null,
            obtainedBy,
            obtainedByName: values.obtainedByName,
            linkedProcedureNoteId: reObtainFrom?.linkedProcedureNoteId ?? null,
        });
    });

    const title = reObtainFrom ? 'Re-obtain consent' : 'Obtain consent';

    return (
        <AppModal
            open={open}
            title={title}
            description="Capture signatures and finalize consent"
            onClose={onClose}
            size="xl"
            className="max-h-[min(92vh,800px)]"
            footer={
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <AppButton type="button" onClick={onClose} className="sm:min-w-[120px]">
                        Cancel
                    </AppButton>
                    <AppButton type="button" disabled={loading} className="sm:min-w-[140px]" onClick={() => void submit()}>
                        {loading ? 'Saving…' : 'Sign & finalize'}
                    </AppButton>
                </div>
            }
        >
            <form id={FORM_ID} onSubmit={submit} className={CONSENT_FORM_SCROLL_CLASS}>
                <div className={`${CONSENT_FORM_GRID_CLASS} pb-1`}>
                    <div className="col-span-12 sm:col-span-6">
                        <Controller
                            name="consentType"
                            control={control}
                            render={({ field }) => (
                                <ConsentDropdown
                                    fieldId="consent-type"
                                    label="Consent type"
                                    options={toConsentSelectOptions(OBTAIN_CONSENT_TYPES)}
                                    value={field.value}
                                    onChange={(v) => field.onChange(String(v))}
                                    error={errors.consentType?.message}
                                    required
                                />
                            )}
                        />
                    </div>

                    {consentType === 'Procedure-Specific' ? (
                        <div className="col-span-12 sm:col-span-6">
                            <Controller
                                name="procedureName"
                                control={control}
                                render={({ field }) => (
                                    <>
                                        <ConsentTextInput
                                            fieldId="procedure-name"
                                            label="Procedure name"
                                            value={field.value ?? ''}
                                            onChange={field.onChange}
                                            hasError={Boolean(errors.procedureName)}
                                        />
                                        <ConsentFieldError message={errors.procedureName?.message} />
                                    </>
                                )}
                            />
                        </div>
                    ) : null}

                    <div className="col-span-12 sm:col-span-6">
                        <Controller
                            name="templateVersion"
                            control={control}
                            render={({ field }) => (
                                <ConsentTextInput
                                    fieldId="template-version"
                                    label="Template version"
                                    value={field.value}
                                    onChange={field.onChange}
                                    readOnly
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-12 sm:col-span-6">
                        <Controller
                            name="languageUsed"
                            control={control}
                            render={({ field }) => (
                                <ConsentDropdown
                                    fieldId="language-used"
                                    label="Language consent explained in"
                                    options={toConsentSelectOptions(COMMON_LANGUAGES)}
                                    value={field.value}
                                    onChange={(v) => field.onChange(String(v))}
                                    required
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-12">
                        <Controller
                            name="signedByType"
                            control={control}
                            render={({ field }) => (
                                <ConsentSegmentedChoice<SignedByType>
                                    legend="Signer type"
                                    value={field.value}
                                    options={SIGNER_TYPES.map((t) => ({ label: t, value: t }))}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-12 sm:col-span-6">
                        <Controller
                            name="signedByName"
                            control={control}
                            render={({ field }) => (
                                <>
                                    <ConsentTextInput
                                        fieldId="signer-name"
                                        label="Signer name"
                                        value={field.value}
                                        onChange={field.onChange}
                                        hasError={Boolean(errors.signedByName)}
                                    />
                                    <ConsentFieldError message={errors.signedByName?.message} />
                                </>
                            )}
                        />
                    </div>

                    {signedByType !== 'Patient' ? (
                        <div className="col-span-12 sm:col-span-6">
                            <Controller
                                name="signedByRelationship"
                                control={control}
                                render={({ field }) => (
                                    <>
                                        <ConsentTextInput
                                            fieldId="signer-relationship"
                                            label="Signer relationship"
                                            value={field.value ?? ''}
                                            onChange={field.onChange}
                                            hasError={Boolean(errors.signedByRelationship)}
                                        />
                                        <ConsentFieldError message={errors.signedByRelationship?.message} />
                                    </>
                                )}
                            />
                        </div>
                    ) : null}

                    <div className="col-span-12">
                        <ConsentSegmentedChoice<'yes' | 'no'>
                            legend="Patient has decision-making capacity"
                            value={patientHasCapacity ? 'yes' : 'no'}
                            options={YES_NO}
                            onChange={(v) => setValue('patientHasCapacity', v === 'yes', { shouldDirty: true })}
                        />
                    </div>

                    {!patientHasCapacity ? (
                        <div className="col-span-12">
                            <Controller
                                name="capacityAssessmentNote"
                                control={control}
                                render={({ field }) => (
                                    <>
                                        <ConsentTextarea
                                            fieldId="capacity-note"
                                            label="Capacity assessment note"
                                            value={field.value ?? ''}
                                            onChange={field.onChange}
                                            rows={3}
                                        />
                                        <ConsentFieldError message={errors.capacityAssessmentNote?.message} />
                                    </>
                                )}
                            />
                        </div>
                    ) : null}

                    <div className="col-span-12">
                        <ConsentSegmentedChoice<'yes' | 'no'>
                            legend="Interpreter used"
                            value={interpreterUsed ? 'yes' : 'no'}
                            options={YES_NO}
                            onChange={(v) => setValue('interpreterUsed', v === 'yes', { shouldDirty: true })}
                        />
                    </div>

                    {interpreterUsed ? (
                        <>
                            <div className="col-span-12 sm:col-span-6">
                                <Controller
                                    name="interpreterName"
                                    control={control}
                                    render={({ field }) => (
                                        <>
                                            <ConsentTextInput
                                                fieldId="interpreter-name"
                                                label="Interpreter name / service"
                                                value={field.value ?? ''}
                                                onChange={field.onChange}
                                                hasError={Boolean(errors.interpreterName)}
                                            />
                                            <ConsentFieldError message={errors.interpreterName?.message} />
                                        </>
                                    )}
                                />
                            </div>
                            <div className="col-span-12 sm:col-span-6">
                                <Controller
                                    name="interpreterType"
                                    control={control}
                                    render={({ field }) => (
                                        <ConsentDropdown
                                            fieldId="interpreter-type"
                                            label="Interpreter type"
                                            options={toConsentSelectOptions(INTERPRETER_TYPES)}
                                            value={field.value ?? ''}
                                            onChange={(v) =>
                                                field.onChange(
                                                    v ? (String(v) as ObtainConsentFormValues['interpreterType']) : undefined,
                                                )
                                            }
                                            placeholder="Select…"
                                            error={errors.interpreterType?.message}
                                        />
                                    )}
                                />
                            </div>
                        </>
                    ) : null}

                    <div className="col-span-12 sm:col-span-6">
                        <Controller
                            name="patientSignatureData"
                            control={control}
                            render={({ field }) => (
                                <ConsentSignatureFrame label="Patient signature" error={errors.patientSignatureData?.message}>
                                    <SignaturePadField label="" value={field.value} onChange={field.onChange} embedded />
                                </ConsentSignatureFrame>
                            )}
                        />
                    </div>

                    <div className="col-span-12 sm:col-span-6">
                        <Controller
                            name="witnessSignatureData"
                            control={control}
                            render={({ field }) => (
                                <ConsentSignatureFrame label="Witness signature" error={errors.witnessSignatureData?.message}>
                                    <SignaturePadField label="" value={field.value} onChange={field.onChange} embedded />
                                </ConsentSignatureFrame>
                            )}
                        />
                    </div>

                    <div className="col-span-12 sm:col-span-4">
                        <Controller
                            name="witnessName"
                            control={control}
                            render={({ field }) => (
                                <ConsentTextInput
                                    fieldId="witness-name"
                                    label="Witness name"
                                    value={field.value}
                                    onChange={field.onChange}
                                    readOnly
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-12 sm:col-span-4">
                        <Controller
                            name="signedAt"
                            control={control}
                            render={({ field }) => (
                                <ConsentCalendar
                                    fieldId="signed-at"
                                    label="Date / time signed"
                                    value={isoToDate(field.value)}
                                    onChange={(d) => field.onChange(dateToIso(d))}
                                    disabled
                                    showTime
                                    hourFormat="24"
                                />
                            )}
                        />
                    </div>

                    <div className="col-span-12 sm:col-span-4">
                        <Controller
                            name="obtainedByName"
                            control={control}
                            render={({ field }) => (
                                <ConsentTextInput
                                    fieldId="obtained-by"
                                    label="Obtained by"
                                    value={field.value}
                                    onChange={field.onChange}
                                    readOnly
                                />
                            )}
                        />
                    </div>
                </div>
            </form>
        </AppModal>
    );
}
