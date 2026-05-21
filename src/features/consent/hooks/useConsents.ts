import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    computeSummaryCounts,
    createConsent,
    fetchConsentCompleteness,
    listConsentsByEncounter,
    revokeConsent,
    signConsent,
} from '../../../services/consent.service';
import type {
    ConsentRecord,
    CreateConsentPayload,
    RevokeConsentPayload,
    SignConsentPayload,
} from '../../../types/consent';

export function consentQueryKeys(encounterId: string) {
    const eid = encounterId.trim();
    return {
        list: ['consents', eid] as const,
        completeness: ['consentCompleteness', eid] as const,
    };
}

export function useConsents(encounterId: string, patientId: string, tenantId: string) {
    const eid = encounterId.trim();
    const pid = patientId.trim();
    const enabled = Boolean(eid && pid);
    const queryClient = useQueryClient();
    const keys = consentQueryKeys(eid);

    const listQuery = useQuery({
        queryKey: keys.list,
        queryFn: async () => {
            const r = await listConsentsByEncounter(eid, pid, tenantId);
            if (!r.ok) throw new Error(r.message);
            return r.data;
        },
        enabled,
        staleTime: 20_000,
        retry: 2,
    });

    const completenessQuery = useQuery({
        queryKey: keys.completeness,
        queryFn: async () => {
            const r = await fetchConsentCompleteness(eid);
            if (!r.ok) throw new Error(r.message);
            return r.data;
        },
        enabled,
        staleTime: 20_000,
    });

    const invalidate = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: keys.list }),
            queryClient.invalidateQueries({ queryKey: keys.completeness }),
        ]);
    };

    const createMutation = useMutation({
        mutationFn: (payload: CreateConsentPayload) => createConsent(payload),
        onSuccess: async (res) => {
            if (!res.ok) {
                toast.error(res.message);
                return;
            }
            toast.success('Consent saved');
            await invalidate();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const signMutation = useMutation({
        mutationFn: ({ consentId, payload }: { consentId: string; payload: SignConsentPayload }) =>
            signConsent(consentId, payload),
        onMutate: async ({ consentId }) => {
            await queryClient.cancelQueries({ queryKey: keys.list });
            const prev = queryClient.getQueryData<ConsentRecord[]>(keys.list);
            queryClient.setQueryData<ConsentRecord[]>(keys.list, (old) =>
                old?.map((c) => (c.consentId === consentId ? { ...c, status: 'Signed' as const } : c)),
            );
            return { prev };
        },
        onError: (e: Error, _v, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(keys.list, ctx.prev);
            toast.error(e.message);
        },
        onSuccess: async (res) => {
            if (!res.ok) {
                toast.error(res.message);
                return;
            }
            toast.success('Consent signed and finalized');
            await invalidate();
        },
    });

    const revokeMutation = useMutation({
        mutationFn: ({ consentId, payload }: { consentId: string; payload: RevokeConsentPayload }) =>
            revokeConsent(consentId, payload),
        onSuccess: async (res) => {
            if (!res.ok) {
                toast.error(res.message);
                return;
            }
            toast.success('Consent revoked');
            await invalidate();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const completeness = completenessQuery.data;
    const summary = computeSummaryCounts(listQuery.data ?? [], completeness ?? { required: [], missing: [], complete: true });

    const lastUpdated = (listQuery.data ?? []).reduce<string | null>((max, row) => {
        const t = row.updatedAt;
        if (!max || t > max) return t;
        return max;
    }, null);

    return {
        records: listQuery.data ?? [],
        completeness,
        summary,
        lastUpdated,
        listQuery,
        completenessQuery,
        createMutation,
        signMutation,
        revokeMutation,
        invalidate,
        isLoading: enabled && listQuery.isPending && !listQuery.data,
        isError: listQuery.isError,
        errorMessage: listQuery.error instanceof Error ? listQuery.error.message : 'Failed to load consents',
    };
}
