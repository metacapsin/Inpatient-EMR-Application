import { memo } from 'react';
import { useAnimatedCounter } from '../../hooks/quality/useAnimatedCounter';

type Props = {
    value: number;
    suffix?: string;
    prefix?: string;
    decimals?: number;
    loading?: boolean;
    className?: string;
};

function AnimatedCounterInner({ value, suffix = '', prefix = '', decimals = 0, loading, className }: Props) {
    const animated = useAnimatedCounter(value, 650, !loading);
    const display =
        decimals > 0 ? animated.toFixed(decimals) : animated.toLocaleString(undefined, { maximumFractionDigits: 0 });

    return (
        <span className={className} aria-live="polite">
            {prefix}
            {display}
            {suffix}
        </span>
    );
}

export const AnimatedCounter = memo(AnimatedCounterInner);
