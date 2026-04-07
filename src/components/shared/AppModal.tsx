import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AppModalProps {
    open: boolean;
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    onClose: () => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function AppModal({ open, title, description, children, footer, onClose, size = 'md', className }: AppModalProps) {
    if (!open) return null;

    const width =
        size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-lg';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
            <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
                aria-label="Close dialog"
                onClick={onClose}
            />
            <div
                className={cn(
                    'relative z-[101] flex max-h-[min(90vh,720px)] w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#141210]',
                    width,
                    className
                )}
            >
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/10">
                    <div className="min-w-0">
                        <h2 id="app-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                            {title}
                        </h2>
                        {description ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p> : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/10"
                    >
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer ? <div className="border-t border-gray-100 px-5 py-4 dark:border-white/10">{footer}</div> : null}
            </div>
        </div>
    );
}
