import { ScanLine } from 'lucide-react';
import { RADIOLOGY_PAGE_HEADER_CLASS } from '../constants/radiologyLayout';

type RadiologyPageHeaderProps = {
    encounterHint?: string;
};

export function RadiologyPageHeader({ encounterHint }: RadiologyPageHeaderProps) {
    return (
        <header className={RADIOLOGY_PAGE_HEADER_CLASS}>
            <div className="flex min-w-0 items-start gap-2.5">
                <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/5 text-primary dark:border-primary/30 dark:bg-primary/10"
                    aria-hidden
                >
                    <ScanLine className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <h1 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                            Radiology
                        </h1>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Imaging orders &amp; results
                        </span>
                    </div>
                    {encounterHint ? (
                        <p className="mt-0.5 truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            {encounterHint}
                        </p>
                    ) : (
                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                            Order entry, resulted studies, critical results, and PACS viewer
                        </p>
                    )}
                </div>
            </div>
        </header>
    );
}
