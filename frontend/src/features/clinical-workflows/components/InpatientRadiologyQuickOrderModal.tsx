import { AppModal } from '../../../components/shared/AppModal';
import type { CreateRadiologyOrderPayload } from '../../radiology/types/radiologyOrder.types';
import type { RadiologyOrderFormContext } from '../../radiology/utils/radiologyOrderFormMappers';
import { InpatientRadiologyQuickOrderForm } from './InpatientRadiologyQuickOrderForm';

export type InpatientRadiologyQuickOrderModalProps = {
    open: boolean;
    formContext: RadiologyOrderFormContext | null;
    disabled?: boolean;
    submitting?: boolean;
    onClose: () => void;
    onSubmit: (payload: CreateRadiologyOrderPayload) => Promise<void>;
};

export function InpatientRadiologyQuickOrderModal({
    open,
    formContext,
    disabled,
    submitting,
    onClose,
    onSubmit,
}: InpatientRadiologyQuickOrderModalProps) {
    const handleSubmit = async (payload: CreateRadiologyOrderPayload) => {
        await onSubmit(payload);
        onClose();
    };

    return (
        <AppModal
            open={open}
            title="New radiology order"
            description="Quick CPOE · same chart APIs"
            onClose={onClose}
            size="md"
        >
            {!formContext ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                    Select a patient and encounter before placing a radiology order.
                </p>
            ) : (
                <InpatientRadiologyQuickOrderForm
                    formContext={formContext}
                    disabled={disabled}
                    submitting={submitting}
                    onSubmit={handleSubmit}
                    onCancel={onClose}
                />
            )}
        </AppModal>
    );
}
