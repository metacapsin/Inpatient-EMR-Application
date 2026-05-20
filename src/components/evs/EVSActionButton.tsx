interface EVSActionButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary';
}

export function EVSActionButton({ label, onClick, disabled, variant = 'secondary' }: EVSActionButtonProps) {
    const base =
        'inline-flex h-7 shrink-0 items-center justify-center rounded-md px-2.5 text-[11px] font-semibold transition disabled:pointer-events-none disabled:opacity-45';
    const styles =
        variant === 'primary'
            ? 'bg-primary text-white shadow-sm hover:bg-primary/90'
            : 'border border-gray-200/80 bg-white text-gray-800 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-[#1a1816] dark:text-gray-100 dark:hover:bg-white/[0.04]';

    return (
        <button type="button" className={`${base} ${styles}`} disabled={disabled} onClick={onClick}>
            {label}
        </button>
    );
}
