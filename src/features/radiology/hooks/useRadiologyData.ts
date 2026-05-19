import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
    acknowledgeRadiologyOrder,
    cancelRadiologyOrder,
    clearRadiologyOrderDraft,
    createRadiologyOrder,
    fetchRadiologyOrdersByEncounter,
    getLastRadiologyDataSource,
    getRadiologyOrderDraft,
    markRadiologyCritical,
    saveRadiologyOrderDraft,
    submitRadiologyResult,
} from '../../../services/radiologyOrder.service';
import type {
    CreateRadiologyOrderPayload,
    RadiologyCriticalPayload,
    RadiologyOrder,
    RadiologyResultPayload,
} from '../types/radiologyOrder.types';
import type { RadiologyOrderDraftRecord, RadiologyOrderFormValues } from '../types/radiologyOrderForm.types';
import type { RadiologyDataSource } from '../api/radiologyOrderWithFallback';
import { USE_RADIOLOGY_MOCK } from '../config/radiologyMock.config';
import {
    draftRecordToFormValues,
    formValuesToDraftRecord,
    type RadiologyOrderFormContext,
} from '../utils/radiologyOrderFormMappers';

export type UseRadiologyDataArgs = {
    encounterId: string;
    patientId: string;
    tenantId?: string;
    orderedBy: string;
    orderedByName?: string;
};

function resolveEffectiveEncounterId(encounterId: string, patientId: string): string {
    const trimmed = encounterId.trim();
    if (trimmed) return trimmed;
    if (USE_RADIOLOGY_MOCK && patientId.trim()) return `dev-enc-${patientId.trim()}`;
    return '';
}

export function useRadiologyData({
    encounterId,
    patientId,
    tenantId,
    orderedBy,
    orderedByName,
}: UseRadiologyDataArgs) {
    const effectiveEncounterId = resolveEffectiveEncounterId(encounterId, patientId);
    const [orders, setOrders] = useState<RadiologyOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [draftLoading, setDraftLoading] = useState(false);
    const [orderDraft, setOrderDraft] = useState<RadiologyOrderFormValues | null>(null);
    const [dataSource, setDataSource] = useState<RadiologyDataSource | null>(null);

    const context = { patientId, tenantId };

    const formContext: RadiologyOrderFormContext | null = effectiveEncounterId
        ? {
              patientId,
              encounterId: effectiveEncounterId,
              tenantId,
              orderedBy,
              orderedByName,
          }
        : null;

    const refresh = useCallback(async () => {
        if (!effectiveEncounterId) {
            setOrders([]);
            setDataSource(null);
            return;
        }
        setLoading(true);
        try {
            const list = await fetchRadiologyOrdersByEncounter(effectiveEncounterId, context);
            setOrders(list);
            setDataSource(getLastRadiologyDataSource(effectiveEncounterId));
        } catch (err: unknown) {
            const msg =
                err && typeof err === 'object' && 'response' in err
                    ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
                    : '';
            toast.error(msg || 'Failed to load imaging orders');
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [effectiveEncounterId, patientId, tenantId]);

    const loadDraft = useCallback(async () => {
        if (!effectiveEncounterId) {
            setOrderDraft(null);
            return;
        }
        setDraftLoading(true);
        try {
            const record = await getRadiologyOrderDraft(effectiveEncounterId);
            setOrderDraft(record ? draftRecordToFormValues(record) : null);
        } catch {
            setOrderDraft(null);
        } finally {
            setDraftLoading(false);
        }
    }, [effectiveEncounterId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        void loadDraft();
    }, [loadDraft]);

    const createImagingOrder = useCallback(
        async (payload: CreateRadiologyOrderPayload) => {
            setSubmitting(true);
            try {
                await createRadiologyOrder(payload);
                await clearRadiologyOrderDraft(payload.encounterId);
                setOrderDraft(null);
                toast.success('Imaging order created');
                await refresh();
            } catch (err: unknown) {
                const msg =
                    err && typeof err === 'object' && 'response' in err
                        ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '')
                        : '';
                toast.error(msg || 'Failed to create imaging order');
                throw err;
            } finally {
                setSubmitting(false);
            }
        },
        [refresh]
    );

    const saveDraft = useCallback(
        async (form: RadiologyOrderFormValues) => {
            if (!formContext) return;
            setSavingDraft(true);
            try {
                const record: RadiologyOrderDraftRecord = formValuesToDraftRecord(form, formContext);
                await saveRadiologyOrderDraft(record);
                setOrderDraft(draftRecordToFormValues(record));
                toast.success('Draft saved');
            } catch {
                toast.error('Failed to save draft');
            } finally {
                setSavingDraft(false);
            }
        },
        [formContext]
    );

    const discardDraft = useCallback(async () => {
        if (!effectiveEncounterId) {
            setOrderDraft(null);
            return;
        }
        await clearRadiologyOrderDraft(effectiveEncounterId);
        setOrderDraft(null);
    }, [effectiveEncounterId]);

    const acknowledge = useCallback(
        async (orderId: string, acknowledgedBy?: string) => {
            try {
                await acknowledgeRadiologyOrder(orderId, effectiveEncounterId, acknowledgedBy ? { acknowledgedBy } : undefined);
                toast.success('Order acknowledged');
                await refresh();
            } catch {
                toast.error('Failed to acknowledge order');
            }
        },
        [effectiveEncounterId, refresh]
    );

    const cancelOrder = useCallback(
        async (orderId: string) => {
            try {
                await cancelRadiologyOrder(orderId, effectiveEncounterId);
                toast.success('Order cancelled');
                await refresh();
            } catch {
                toast.error('Failed to cancel order');
            }
        },
        [effectiveEncounterId, refresh]
    );

    const submitResult = useCallback(
        async (orderId: string, body: RadiologyResultPayload) => {
            try {
                await submitRadiologyResult(orderId, effectiveEncounterId, body);
                toast.success('Result saved');
                await refresh();
            } catch {
                toast.error('Failed to save result');
            }
        },
        [effectiveEncounterId, refresh]
    );

    const markCritical = useCallback(
        async (orderId: string, body: RadiologyCriticalPayload) => {
            try {
                await markRadiologyCritical(orderId, effectiveEncounterId, body);
                toast.success('Critical value updated');
                await refresh();
            } catch {
                toast.error('Failed to update critical value');
            }
        },
        [effectiveEncounterId, refresh]
    );

    return {
        effectiveEncounterId,
        orders,
        loading,
        submitting,
        savingDraft,
        draftLoading,
        orderDraft,
        dataSource,
        refresh,
        createImagingOrder,
        saveDraft,
        discardDraft,
        acknowledge,
        cancelOrder,
        submitResult,
        markCritical,
        /** @deprecated use createImagingOrder */
        placeOrder: createImagingOrder,
        /** @deprecated use cancelOrder */
        cancel: cancelOrder,
    };
}
