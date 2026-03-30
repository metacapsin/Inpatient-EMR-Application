import type { ReactNode } from 'react';

interface FacesheetEmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export function FacesheetEmptyState({ icon, title, description, action, className = '' }: FacesheetEmptyStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200/90 bg-gray-50/50 px-6 py-14 text-center dark:border-white/10 dark:bg-white/[0.02] ${className}`}
            role="status"
        >
            {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>}
            <p className="text-base font-semibold text-gray-900 dark:text-white">{title}</p>
            {description && <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}
