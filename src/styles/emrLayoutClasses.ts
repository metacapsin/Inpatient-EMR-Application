/** Shared enterprise EMR layout utility classes (Tailwind). */

export const emrTopNavClass =
    'border-b border-emr-border bg-emr-topnav text-emr-text';

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

export function emrNavLinkClass(isActive: boolean): string {
    return [emrNavItemBaseClass, isActive ? emrNavItemActiveClass : emrNavItemIdleClass].join(' ');
}
