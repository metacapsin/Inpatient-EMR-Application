import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveFacesheetModuleFromPath } from '../../facesheet/facesheetModules';

/** Breadcrumb inside the facesheet module card — top-left, `Patient / {module}`. */
export function FacesheetModuleBreadcrumb() {
    const { pathname } = useLocation();
    const label = useMemo(() => {
        const mod = resolveFacesheetModuleFromPath(pathname);
        if (mod) return mod.label;
        if (pathname.includes('/clinical/nursing-flowsheet')) return 'Nursing Flowsheet';
        if (pathname.includes('/radiology')) return 'Radiology';
        return 'Chart';
    }, [pathname]);

    return (
        <div className="facesheet-module-card-header shrink-0 border-b border-emr-border bg-white dark:border-white/10 dark:bg-[#141210]">
            <nav aria-label="Breadcrumb" className="px-4 py-2.5 sm:px-5 sm:py-3">
                <ol className="flex items-center gap-1.5 text-xs font-medium leading-none">
                    <li className="text-emr-muted">Patient</li>
                    <li className="text-emr-muted/70" aria-hidden>
                        /
                    </li>
                    <li className="text-emr-text dark:text-gray-100">{label}</li>
                </ol>
            </nav>
        </div>
    );
}
