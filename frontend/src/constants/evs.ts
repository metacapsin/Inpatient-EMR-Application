/** EVS / bed turnaround workflow statuses (match backend evs_queue.status). */
export const EVS_STATUS = {
    DIRTY: 'dirty',
    IN_CLEANING: 'in_cleaning',
    PENDING_INSPECTION: 'pending_inspection',
    CLEAN: 'clean',
} as const;

export type EvsStatus = (typeof EVS_STATUS)[keyof typeof EVS_STATUS];

export const EVS_STATUS_LABEL: Record<EvsStatus, string> = {
    [EVS_STATUS.DIRTY]: 'Dirty',
    [EVS_STATUS.IN_CLEANING]: 'In Cleaning',
    [EVS_STATUS.PENDING_INSPECTION]: 'Pending Inspection',
    [EVS_STATUS.CLEAN]: 'Clean',
};

/** Bed board strip labels (shorter copy). */
export const EVS_STRIP_LABEL: Record<EvsStatus, string> = {
    [EVS_STATUS.DIRTY]: 'Dirty',
    [EVS_STATUS.IN_CLEANING]: 'Cleaning',
    [EVS_STATUS.PENDING_INSPECTION]: 'Inspect',
    [EVS_STATUS.CLEAN]: 'Available',
};

export const EVS_STATUS_CHIP_CLASS: Record<EvsStatus, string> = {
    [EVS_STATUS.DIRTY]:
        'bg-red-100 text-red-800 ring-red-200/80 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900/40',
    [EVS_STATUS.IN_CLEANING]:
        'bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-950/45 dark:text-amber-200 dark:ring-amber-900/40',
    [EVS_STATUS.PENDING_INSPECTION]:
        'bg-blue-100 text-blue-800 ring-blue-200/80 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-900/40',
    [EVS_STATUS.CLEAN]:
        'bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900/40',
};

export const EVS_STRIP_CLASS: Record<EvsStatus, string> = {
    [EVS_STATUS.DIRTY]: 'bg-red-600 text-white dark:bg-red-700',
    [EVS_STATUS.IN_CLEANING]: 'bg-amber-500 text-amber-950 dark:bg-amber-500 dark:text-amber-950',
    [EVS_STATUS.PENDING_INSPECTION]: 'bg-blue-600 text-white dark:bg-blue-700',
    [EVS_STATUS.CLEAN]: 'bg-emerald-600 text-white dark:bg-emerald-700',
};

export const EVS_CLEAN_TYPES = ['Terminal', 'Routine', 'Isolation', 'Discharge'] as const;
export type EvsCleanType = (typeof EVS_CLEAN_TYPES)[number];

/** Queue wait turns red after this many minutes. */
export const EVS_QUEUE_OVERDUE_MINUTES = 120;

