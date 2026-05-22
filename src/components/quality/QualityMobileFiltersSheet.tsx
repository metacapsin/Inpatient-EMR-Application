import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import AppButton from '../ui/AppButton';
import { useQualityMeasuresStore } from '../../store/quality/qualityMeasuresStore';
import { QualityFilterFields } from './QualityFilterFields';
function QualityMobileFiltersSheetInner() {
    const open = useQualityMeasuresStore((s) => s.mobileFiltersOpen);
    const setOpen = useQualityMeasuresStore((s) => s.setMobileFiltersOpen);

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
                        onClick={() => setOpen(false)}
                        aria-hidden
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Filters"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-emr-border bg-white p-4 shadow-[0_-8px_32px_-8px_rgba(31,41,55,0.15)] dark:border-white/10 dark:bg-[#161412] md:hidden"
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-sm font-bold tracking-tight text-emr-text dark:text-white">
                                Filters
                            </h2>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-emr-muted transition hover:bg-emr-hover dark:hover:bg-white/10"
                                aria-label="Close filters"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <QualityFilterFields layout="stacked" compact showClear />

                        <div className="mt-4 flex flex-col gap-2">
                            <AppButton
                                type="button"
                                className="w-full justify-center"
                                onClick={() => setOpen(false)}
                            >
                                <Download className="h-4 w-4" aria-hidden />
                                Export (UI)
                            </AppButton>
                            <AppButton type="button" className="w-full justify-center" onClick={() => setOpen(false)}>
                                Apply filters
                            </AppButton>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export const QualityMobileFiltersSheet = memo(QualityMobileFiltersSheetInner);
