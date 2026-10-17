import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    closeCodeEvent,
    fetchCodeEventById,
    generateCodeEventNote,
    updateCodeEventTeam,
    updateCodeEventTimeline,
} from '../../../services/codeEventService';
import { DEFAULT_CODE_EVENT_UNIT_ID } from '../config/codeEventMock.config';
import { activeCodeEventsQueryKey } from './useActiveCodeEvents';
import { patientActiveCodeQueryKey } from './usePatientActiveCodeEvent';
import type {
    CloseCodeEventPayload,
    CodeEventRecord,
    CodeEventTeamMember,
    CodeEventTimelineEntry,
} from '../../../types/codeEvent';

export function codeEventQueryKey(eventId: string) {
    return ['codeEvent', eventId] as const;
}

export function useCodeEvent(eventId: string | undefined) {
    const queryClient = useQueryClient();
    const [optimisticTimeline, setOptimisticTimeline] = useState<CodeEventTimelineEntry[] | null>(null);

    const query = useQuery({
        queryKey: codeEventQueryKey(eventId ?? ''),
        queryFn: () => fetchCodeEventById(eventId!),
        enabled: Boolean(eventId?.trim()),
        refetchInterval: (q) => (q.state.data?.status === 'active' ? 15_000 : false),
    });

    const event = query.data ?? null;
    const timeline = optimisticTimeline ?? event?.timeline ?? [];

    useEffect(() => {
        setOptimisticTimeline(null);
    }, [event?.timeline, event?.id]);

    const invalidate = useCallback(() => {
        if (eventId) void queryClient.invalidateQueries({ queryKey: codeEventQueryKey(eventId) });
    }, [queryClient, eventId]);

    const saveTimeline = useCallback(
        async (nextTimeline: CodeEventTimelineEntry[]) => {
            if (!eventId || !event) return;
            setOptimisticTimeline(nextTimeline);
            try {
                const updated = await updateCodeEventTimeline(eventId, { timeline: nextTimeline });
                queryClient.setQueryData(codeEventQueryKey(eventId), updated);
            } finally {
                setOptimisticTimeline(null);
                invalidate();
            }
        },
        [eventId, event, queryClient, invalidate]
    );

    const appendTimelineEntry = useCallback(
        async (entry: CodeEventTimelineEntry) => {
            const next = [...timeline, entry];
            await saveTimeline(next);
        },
        [timeline, saveTimeline]
    );

    const saveTeam = useCallback(
        async (teamMembers: CodeEventTeamMember[], teamLead?: { id: string; name: string }) => {
            if (!eventId) return;
            const updated = await updateCodeEventTeam(eventId, {
                teamMembers,
                teamLeadId: teamLead?.id,
                teamLeadName: teamLead?.name,
            });
            queryClient.setQueryData(codeEventQueryKey(eventId), updated);
            invalidate();
        },
        [eventId, queryClient, invalidate]
    );

    const closeEvent = useCallback(
        async (payload: CloseCodeEventPayload) => {
            if (!eventId) return null;
            const updated = await closeCodeEvent(eventId, payload);
            queryClient.setQueryData(codeEventQueryKey(eventId), updated);
            void queryClient.invalidateQueries({ queryKey: activeCodeEventsQueryKey(DEFAULT_CODE_EVENT_UNIT_ID) });
            if (updated.patientId) {
                void queryClient.invalidateQueries({ queryKey: patientActiveCodeQueryKey(updated.patientId) });
            }
            invalidate();
            return updated;
        },
        [eventId, queryClient, invalidate]
    );

    const generateNote = useCallback(async () => {
        if (!eventId) return '';
        const { noteText } = await generateCodeEventNote(eventId);
        return noteText;
    }, [eventId]);

    return {
        event: event ? { ...event, timeline } : null,
        loading: query.isLoading,
        fetching: query.isFetching,
        error: query.error,
        refetch: query.refetch,
        appendTimelineEntry,
        saveTimeline,
        saveTeam,
        closeEvent,
        generateNote,
    };
}

export type UseCodeEventReturn = ReturnType<typeof useCodeEvent>;
