/**
 * Shared “outlined field” notch labels (Shift date / registry style).
 * Opaque strip + z-index above inner controls hides the top border behind text.
 */
/** Wider opaque strip + high z-index so the field border never shows through the label. */
const NOTCHED_LABEL_STRIP =
    'absolute left-3 top-0 z-[25] -translate-y-1/2 bg-white px-2 leading-tight shadow-[0_0_0_1px_rgb(255_255_255)] dark:bg-[#141210] dark:shadow-[0_0_0_1px_rgb(20_18_16)]';

/** Default flowsheet / form text fields — use on <label htmlFor="…"> */
export const NOTCHED_FIELD_LABEL_CLASS = `${NOTCHED_LABEL_STRIP} cursor-default text-[12px] font-medium text-gray-500 dark:text-gray-400`;

/** Same typography over a button or non-label control */
export const NOTCHED_FIELD_LABEL_OVERLAY_CLASS = `${NOTCHED_LABEL_STRIP} pointer-events-none text-[12px] font-medium text-gray-500 dark:text-gray-400`;

/** Calendar / date copy (slightly stronger than generic fields) */
export const NOTCHED_DATE_LABEL_CLASS = `${NOTCHED_LABEL_STRIP} cursor-default text-xs font-semibold text-gray-700 dark:text-gray-200`;

export const NOTCHED_DATE_LABEL_OVERLAY_CLASS = `${NOTCHED_LABEL_STRIP} pointer-events-none text-xs font-semibold text-gray-700 dark:text-gray-200`;

/** Compact outlined dropdowns (patient list, date range) */
export const NOTCHED_COMPACT_LABEL_OVERLAY_CLASS = `${NOTCHED_LABEL_STRIP} pointer-events-none text-xs font-bold text-dark dark:text-gray-200`;

export const NOTCHED_COMPACT_LABEL_CLASS = `${NOTCHED_LABEL_STRIP} cursor-pointer text-xs font-bold text-dark dark:text-gray-200`;

/** Outlined control shell — isolate keeps notch above inner focus rings / inputs */
export const NOTCHED_FIELD_FRAME_CLASS =
    'relative isolate rounded-lg border border-gray-200/70 bg-white shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 dark:border-gray-600 dark:bg-[#141210]';
