/** Shared enterprise EMR layout utility classes (Tailwind). */

export const emrTopNavClass =
    'border-b border-emr-border/80 bg-emr-topnav/95 text-emr-text backdrop-blur-md backdrop-saturate-150';

export const emrSidebarSurfaceClass = 'border-emr-border bg-emr-sidebar';

export const emrNavItemBaseClass =
    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-emr-text transition-colors duration-150';

export const emrNavItemActiveClass =
    'border-l-2 border-emr-accent bg-emr-active font-semibold text-emr-accent ltr:-ml-px ltr:pl-[calc(0.625rem-1px)] rtl:-mr-px rtl:pr-[calc(0.625rem-1px)]';

export const emrNavItemIdleClass = 'text-emr-text hover:bg-emr-hover';

export const emrChartGroupHeaderClass =
    'px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emr-muted';

export const emrModuleSurfaceClass =
    'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden border-l border-emr-border bg-white [overscroll-behavior:contain] dark:border-white/10 dark:bg-[#141210]';

/** Top nav primary link — compact enterprise density */
export const emrTopNavItemBaseClass =
    'group relative flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[12.5px] font-semibold tracking-tight transition-all duration-200 ease-out';

export const emrTopNavItemActiveClass =
    'bg-emr-active text-emr-accent shadow-[0_1px_2px_rgba(154,107,63,0.14),inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-emr-accent/20 dark:bg-primary/20 dark:text-primary-200 dark:shadow-[0_1px_4px_rgba(0,0,0,0.4)] dark:ring-primary/30';

export const emrTopNavItemIdleClass =
    'text-emr-text/90 hover:bg-emr-hover hover:text-emr-accent hover:shadow-sm dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-primary-200';

/** Top nav icon buttons (notifications, theme, AI) */
export const emrHeaderUtilityBtnClass =
    'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-emr-muted transition-all duration-200 hover:border-emr-border/80 hover:bg-emr-hover hover:text-emr-accent hover:shadow-[0_1px_3px_rgba(31,41,55,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emr-accent/40 dark:text-gray-400 dark:hover:border-white/10 dark:hover:bg-white/[0.06] dark:hover:text-primary-200';

/** Enterprise global search field in header */
export const emrHeaderSearchInputClass =
    'h-8 w-full min-w-0 max-w-full flex-1 rounded-lg border border-emr-border/90 bg-white py-0 pl-9 pr-3 text-[12.5px] font-medium leading-none text-emr-text shadow-[inset_0_1px_2px_rgba(31,41,55,0.05),0_1px_2px_rgba(31,41,55,0.04)] outline-none transition placeholder:font-normal placeholder:text-emr-muted/80 focus:border-emr-accent/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(154,107,63,0.1)] focus:ring-2 focus:ring-emr-accent/15 dark:border-white/10 dark:bg-[#1a1816]/95 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-primary/45 dark:focus:ring-primary/20';

/** Dropdown / mega-menu panel */
export const emrTopNavDropdownClass =
    'overflow-hidden rounded-lg border border-emr-border/90 bg-emr-topnav py-1 shadow-[0_8px_24px_-4px_rgba(31,41,55,0.12),0_2px_8px_-2px_rgba(31,41,55,0.06)] ring-1 ring-black/[0.03] dark:border-white/10 dark:bg-[#141210] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.55)] dark:ring-white/[0.04]';

export function emrNavLinkClass(isActive: boolean): string {
    return [emrNavItemBaseClass, isActive ? emrNavItemActiveClass : emrNavItemIdleClass].join(' ');
}

export function emrTopNavLinkClass(isActive: boolean): string {
    return [emrTopNavItemBaseClass, isActive ? emrTopNavItemActiveClass : emrTopNavItemIdleClass].join(' ');
}
