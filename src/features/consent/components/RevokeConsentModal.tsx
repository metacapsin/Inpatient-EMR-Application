import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppModal } from '../../../components/shared/AppModal';
import AppButton from '../../../components/ui/AppButton';
import { revokeConsentSchema, type RevokeConsentFormValues } from '../validation/consentForm.schema';
import type { ConsentRecord } from '../../../types/consent';
import { ConsentFieldError, ConsentTextarea } from './ConsentStyledFields';

type Props = {
    open: boolean;
    record: ConsentRecord | null;
    loading?: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
};

export function RevokeConsentModal({ open, record, loading, onClose, onConfirm }: Props) {
    const {
        control,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<RevokeConsentFormValues>({
        resolver: zodResolver(revokeConsentSchema),
        defaultValues: { revokedReason: '' },
    });

    const submit = handleSubmit((data) => {
        onConfirm(data.revokedReason);
        reset();
    });

    return (
        <AppModal
            open={open}
            title="Revoke consent"
            description={
                record
                    ? `This will revoke the ${record.consentType} consent. This action is recorded in the legal health record.`
                    : undefined
            }
            onClose={() => {
                reset();
                onClose();
            }}
            footer={
                <div className="flex justify-end gap-2">
                    <AppButton
                        onClick={() => {
                            reset();
                            onClose();
                        }}
                    >
                        Cancel
                    </AppButton>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={submit}
                        className="inline-flex items-center rounded-md border border-red-300 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50 dark:border-red-800"
                    >
                        {loading ? 'Revoking…' : 'Revoke consent'}
                    </button>
                </div>
            }
        >
            <Controller
                name="revokedReason"
                control={control}
                render={({ field }) => (
                    <>
                        <ConsentTextarea
                            fieldId="revoke-reason"
                            label="Reason for revocation"
                            value={field.value}
                            onChange={field.onChange}
                            rows={4}
                            placeholder="Document clinical and legal basis for revocation…"
                        />
                        <ConsentFieldError message={errors.revokedReason?.message} />
                    </>
                )}
            />
        </AppModal>
    );
}
