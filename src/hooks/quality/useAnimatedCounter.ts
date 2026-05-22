import { useEffect, useState } from 'react';

export function useAnimatedCounter(target: number, durationMs = 600, enabled = true): number {
    const [value, setValue] = useState(enabled ? 0 : target);

    useEffect(() => {
        if (!enabled) {
            setValue(target);
            return;
        }
        const start = value;
        const diff = target - start;
        if (diff === 0) return;

        const startTime = performance.now();
        let frame: number;

        const tick = (now: number) => {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / durationMs);
            const eased = 1 - (1 - t) ** 3;
            setValue(Math.round(start + diff * eased));
            if (t < 1) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from last rendered value toward new target
    }, [target, durationMs, enabled]);

    return enabled ? value : target;
}
