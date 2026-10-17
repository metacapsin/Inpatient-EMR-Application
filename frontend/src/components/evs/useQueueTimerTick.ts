import { useEffect, useState } from 'react';

/** Re-render queue rows every minute so "Time in queue" stays current. */
export function useQueueTimerTick(intervalMs = 60_000): number {
    const [tick, setTick] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setTick(Date.now()), intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs]);
    return tick;
}
