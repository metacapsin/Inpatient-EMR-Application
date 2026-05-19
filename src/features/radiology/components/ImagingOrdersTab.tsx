import { useState } from 'react';
import { AppModal } from '../../../components/shared/AppModal';
import type { RadiologyOrder } from '../types/radiologyOrder.types';
import type { CreateRadiologyOrderPayload, RadiologyResultPayload } from '../types/radiologyOrder.types';
import type { RadiologyOrderFormValues } from '../types/radiologyOrderForm.types';
import type { RadiologyOrderFormContext } from '../utils/radiologyOrderFormMappers';
import type { Icd10Option } from './Icd10MultiTypeahead';
import { ImagingOrderEntryForm } from './ImagingOrderEntryForm';
import { ImagingOrdersTable } from './ImagingOrdersTable';

type ImagingOrdersTabProps = {
    formContext: RadiologyOrderFormContext | null;
    patientId: string;
    encounterId: string;
    showEncounterWarning?: boolean;
    tenantId: string;
    orderedBy: string;
    orderedByName: string;
    icdSuggestions?: Icd10Option[];
    orderDraft: RadiologyOrderFormValues | null;
    draftLoading: boolean;
    orders: RadiologyOrder[];
    loading: boolean;
    submitting: boolean;
    savingDraft: boolean;
    onCreateOrder: (payload: CreateRadiologyOrderPayload) => Promise<void>;
    onSaveDraft: (form: RadiologyOrderFormValues) => Promise<void>;
    onCancelForm: () => void;
    onAcknowledge: (orderId: string) => void;
    onCancelOrder: (orderId: string) => void;
    onSubmitResult: (orderId: string, body: RadiologyResultPayload) => void;
    onMarkCritical: (orderId: string, notifiedTo: string) => void;
};

export function ImagingOrdersTab({
    formContext,
    encounterId,
    showEncounterWarning = false,
    icdSuggestions,
    orderDraft,
    draftLoading,
    orders,
    loading,
    submitting,
    savingDraft,
    onCreateOrder,
    onSaveDraft,
    onCancelForm,
    onAcknowledge,
    onCancelOrder,
    onSubmitResult,
    onMarkCritical,
}: ImagingOrdersTabProps) {
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const disabled = !encounterId.trim();

    const closeOrderModal = () => setOrderModalOpen(false);

    const handleCancelForm = () => {
        void onCancelForm();
        closeOrderModal();
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-1.5 lg:px-3">
            {showEncounterWarning ? (
                <p className="shrink-0 rounded-lg border border-amber-300/60 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                    Admit or select an active encounter to place imaging orders.
                </p>
            ) : null}

            <ImagingOrdersTable
                orders={orders}
                loading={loading}
                orderedById={formContext?.orderedBy ?? ''}
                onNewOrder={() => setOrderModalOpen(true)}
                newOrderDisabled={disabled}
                onAcknowledge={onAcknowledge}
                onCancel={onCancelOrder}
                onSubmitResult={onSubmitResult}
                onMarkCritical={(id, to) => onMarkCritical(id, to)}
            />

            <AppModal
                open={orderModalOpen}
                title="New imaging order"
                description="Save a draft or create an order when required fields are complete."
                onClose={closeOrderModal}
                size="lg"
                className="max-w-3xl"
            >
                <ImagingOrderEntryForm
                    formContext={formContext}
                    initialValues={orderDraft}
                    draftLoading={draftLoading}
                    icdSuggestions={icdSuggestions}
                    disabled={disabled}
                    submitting={submitting}
                    savingDraft={savingDraft}
                    variant="embedded"
                    onCreateOrder={onCreateOrder}
                    onSaveDraft={onSaveDraft}
                    onCancel={handleCancelForm}
                    onSaved={closeOrderModal}
                />
            </AppModal>
        </div>
    );
}
