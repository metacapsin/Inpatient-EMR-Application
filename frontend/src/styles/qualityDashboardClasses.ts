/**
 * Quality measures — high-density operational clinical dashboard tokens.
 * Compact rhythm aligned with IPD operations (Epic/Cerner-style scan efficiency).
 */

export const qmShellClass =
    'flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden';

/** Sticky command + filter stack */
export const qmStickyShellClass =
    'sticky top-0 z-30 -mx-3 shrink-0 border-b border-emr-border/80 bg-emr-canvas/98 px-3 pb-1 backdrop-blur-md sm:-mx-4 sm:px-4 dark:border-white/10 dark:bg-[#0f0d0b]/95';

export const qmCommandRowClass =
    'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-1';

export const qmEyebrowClass =
    'text-[9px] font-bold uppercase tracking-[0.14em] text-emr-muted dark:text-gray-500';

export const qmPageTitleClass =
    'text-base font-bold leading-tight tracking-tight text-emr-text dark:text-white';

export const qmMetaLineClass =
    'truncate text-[10px] font-medium text-emr-muted dark:text-gray-500';

export const qmHeaderIconClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/15';

export const qmComplianceChipsClass = 'flex flex-wrap items-center gap-1';

export const qmChipClass =
    'inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-semibold leading-tight tabular-nums';

export const qmHeaderActionsBtnClass =
    'inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md border border-primary-200 bg-white px-2 text-[11px] font-semibold text-[#8B5E3C] shadow-sm transition hover:border-primary-300 hover:bg-primary/5 disabled:opacity-50 dark:border-primary-700 dark:bg-[#141210] dark:text-amber-100/90 dark:hover:border-primary-600';

/** Single-line clinical filter strip (no extra card chrome) */
export const qmFilterStripClass =
    'flex min-w-0 items-center gap-1.5 border-t border-emr-border/60 py-1 dark:border-white/[0.06]';

export const qmMetricsBandClass = 'shrink-0';

/** Compact operational KPI — sparkline preserved, reduced vertical footprint */
export const qmKpiCardClass =
    'group relative flex min-h-[3.25rem] flex-col justify-between overflow-hidden rounded-lg border border-emr-border/90 bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(31,41,55,0.04)] transition-colors hover:border-emr-accent/20 dark:border-white/10 dark:bg-[#161412]/90 dark:hover:border-primary/25';

export const qmKpiGridClass =
    'grid grid-cols-3 gap-1 min-[900px]:grid-cols-6 min-[900px]:gap-1.5';

/** Primary module — table-first */
export const qmModuleCardClass =
    'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-emr-border/90 bg-white shadow-[0_1px_2px_rgba(31,41,55,0.04)] dark:border-white/10 dark:bg-[#161412]/95';

export const qmModuleHeaderClass =
    'flex shrink-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0 border-b border-emr-border/70 bg-gradient-to-b from-[#faf9f7] to-white px-2.5 py-1 dark:border-white/10 dark:from-[#1c1916] dark:to-[#161412]';

export const qmModuleTitleClass =
    'text-xs font-bold tracking-tight text-emr-text dark:text-white';

export const qmModuleDescClass = 'text-[10px] text-emr-muted dark:text-gray-500';

/** Table body scroll — fills remaining viewport below chrome */
export const qmTableScrollClass =
    'min-h-0 flex-1 overflow-auto overscroll-contain';

export const qmTableHeadCellClass =
    'whitespace-nowrap px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-emr-muted dark:text-gray-500';

export const qmTableBodyCellClass = 'px-2 py-1 align-middle text-xs';

export const qmTableHeadRowClass =
    'border-b border-emr-border/80 bg-gray-50/98 backdrop-blur-sm dark:border-white/10 dark:bg-[#141210]/98';

export const qmTableBodyRowClass =
    'border-b border-emr-border/50 transition-colors hover:bg-emr-hover/50 dark:border-white/[0.04] dark:hover:bg-white/[0.03]';

/** Collapsed bundle rules — below fold */
export const qmRulesModuleClass =
    'shrink-0 overflow-hidden rounded-lg border border-emr-border/80 bg-white dark:border-white/10 dark:bg-[#161412]/90';

export const qmRulesHeaderClass =
    'flex items-center gap-1.5 border-b border-emr-border/60 px-2.5 py-1 dark:border-white/10';

/** Compact search field overrides (wrap SearchInput) */
export const qmCompactSearchWrapClass =
    '[&_input]:h-7 [&_input]:max-h-7 [&_input]:py-0 [&_input]:pl-7 [&_input]:pr-2 [&_input]:text-xs [&_span]:pl-2';
