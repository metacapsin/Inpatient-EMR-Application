import { Siren } from 'lucide-react';
import { cn } from '../../../lib/utils';

type Size = 'sm' | 'md';

type Props = {
    onClick: () => void;
    disabled?: boolean;
    size?: Size;
    className?: string;
    label?: string;
};

const sizeClass: Record<Size, string> = {
    sm: 'h-8 gap-1 px-2.5 text-[11px]',
    md: 'h-9 gap-1.5 px-3 text-xs',
};

export function CodeActivateButton({ onClick, disabled, size = 'md', className, label = 'Code' }: Props) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            title="Activate Code Blue / Rapid Response"
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-lg border border-red-300/90 bg-red-600 font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500/60 disabled:pointer-events-none disabled:opacity-45 dark:border-red-800 dark:bg-red-700 dark:hover:bg-red-600',
                sizeClass[size],
                className
            )}
        >
            <Siren className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
            <span className="truncate">{label}</span>
        </button>
    );
}
