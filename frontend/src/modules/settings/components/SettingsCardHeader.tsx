import type { ReactNode } from 'react';

interface SettingsCardHeaderProps {
    title: string;
    description: string;
    actions?: ReactNode;
}

export function SettingsCardHeader({ title, description, actions }: SettingsCardHeaderProps) {
    return (
        <div className="border-b border-emr-border/70 px-4 py-3.5 dark:border-white/10 sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-base font-bold tracking-tight text-emr-text dark:text-white sm:text-lg">
                        {title}
                    </h1>
                    <p className="mt-0.5 text-[12px] text-emr-muted dark:text-gray-400">{description}</p>
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
        </div>
    );
}
