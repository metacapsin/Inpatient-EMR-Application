import { useQuery } from '@tanstack/react-query';
import { fetchActiveCodeEventsByUnit } from '../../../services/codeEventService';
import { DEFAULT_CODE_EVENT_UNIT_ID } from '../config/codeEventMock.config';
import { subscribeCodeEventBroadcast } from '../utils/codeEventBroadcast';
import { useEffect } from 'react';

export const activeCodeEventsQueryKey = (unitId: string) => ['codeEvents', 'active', unitId] as const;

export function useActiveCodeEvents(unitId = DEFAULT_CODE_EVENT_UNIT_ID) {
    const query = useQuery({
        queryKey: activeCodeEventsQueryKey(unitId),
        queryFn: () => fetchActiveCodeEventsByUnit(unitId),
        refetchInterval: 20_000,
    });

    useEffect(() => {
        return subscribeCodeEventBroadcast(() => {
            void query.refetch();
        });
    }, [query]);

    return {
        events: query.data ?? [],
        loading: query.isLoading,
        refetch: query.refetch,
    };
}
