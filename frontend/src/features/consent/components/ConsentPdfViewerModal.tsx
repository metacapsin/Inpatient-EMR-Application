import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileCheck2, Loader2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { ConsentRecord } from '../../../types/consent';
import { resolveConsentPdfUrl } from '../../../services/consent.service';

type Props = {
    open: boolean;
    record: ConsentRecord | null;
    onClose: () => void;
};

export function ConsentPdfViewerModal({ open, record, onClose }: Props) {
    const [loading, setLoading] = useState(true);
    const url = record ? resolveConsentPdfUrl(record) : '';

    useEffect(() => {
        if (open) setLoading(true);
    }, [open, url]);

    if (!open || !record) return null;

    const signed = record.status === 'Signed';

    return (
        <div className="fixed inset-0 z-[110] flex items-stretch justify-end" role="dialog" aria-modal="true">
            <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
            <div className="relative z-[111] flex h-full w-full max-w-3xl flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#141210] sm:max-w-4xl">
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10">
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                            {record.consentType}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Consent document preview</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {signed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-200">
                                <FileCheck2 className="h-3.5 w-3.5" aria-hidden />
                                Signed
                            </span>
                        ) : null}
                        <a
                            href={url}
                            download={`consent-${record.consentId}.pdf`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                        >
                            <Download className="h-4 w-4" aria-hidden />
                            Download
                        </a>
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                        >
                            <ExternalLink className="h-4 w-4" aria-hidden />
                            Open
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
                        >
                            <X className="h-4 w-4" aria-hidden />
                        </button>
                    </div>
                </div>
                <div className="relative min-h-0 flex-1 bg-gray-100 dark:bg-black/40">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary/80" aria-hidden />
                            <p className="text-sm text-gray-600 dark:text-gray-400">Loading document…</p>
                        </div>
                    ) : null}
                    <iframe
                        title={`Consent PDF ${record.consentId}`}
                        src={url}
                        className={cn('h-full w-full border-0', loading && 'opacity-0')}
                        onLoad={() => setLoading(false)}
                    />
                </div>
            </div>
        </div>
    );
}
