import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AppModalProps {
    open: boolean;
    title: string;
    description?: string;
    /** Optional leading icon (bronze tile) for premium module modals */
    icon?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    onClose: () => void;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    bodyClassName?: string;
    footerClassName?: string;
}

export function AppModal({
    open,
    title,
    description,
    icon,
    children,
    footer,
    onClose,
    size = 'md',
    className,
    bodyClassName,
    footerClassName,
}: AppModalProps) {
    if (!open) return null;

    const width =
        size === 'xl'
            ? 'max-w-3xl'
            : size === 'lg'
              ? 'max-w-2xl'
              : size === 'sm'
                ? 'max-w-sm'
                : 'max-w-lg';

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
            <button
                type="button"
                className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
                aria-label="Close dialog"
                onClick={onClose}
            />
            <div
                className={cn(
                    'relative z-[101] flex max-h-[min(90vh,720px)] w-full flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-2xl shadow-gray-900/10 ring-1 ring-black/[0.04] dark:border-white/10 dark:bg-[#141210] dark:shadow-black/50 dark:ring-white/[0.06]',
                    width,
                    className
                )}
            >
                <div className="flex items-start justify-between gap-3 border-b border-gray-100/90 bg-gradient-to-r from-primary/[0.04] via-transparent to-transparent px-5 py-4 dark:border-white/10 dark:from-primary/[0.08]">
                    <div className="flex min-w-0 items-start gap-3">
                        {icon ? (
                            <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary shadow-sm dark:border-primary/30 dark:bg-primary/10"
                                aria-hidden
                            >
                                {icon}
                            </div>
                        ) : null}
                        <div className="min-w-0">
                            <h2 id="app-modal-title" className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                                {title}
                            </h2>
                            {description ? (
                                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{description}</p>
                            ) : null}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/10 dark:hover:text-gray-200"
                    >
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                </div>
                <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]', bodyClassName)}>{children}</div>
                {footer ? (
                    <div className={cn('border-t border-gray-100/90 bg-gray-50/40 px-5 py-4 dark:border-white/10 dark:bg-[#0c0a08]/50', footerClassName)}>
                        {footer}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
