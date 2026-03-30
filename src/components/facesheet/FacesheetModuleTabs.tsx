import { NavLink } from 'react-router-dom';
import { FACESHEET_MODULES } from '../../facesheet/facesheetModules';

interface FacesheetModuleTabsProps {
    base: string;
    className?: string;
}

/**
 * Horizontal module switcher for small viewports; large screens use {@link FacesheetSidebar}.
 */
export function FacesheetModuleTabs({ base, className = '' }: FacesheetModuleTabsProps) {
    return (
        <div className={`rounded-2xl border border-gray-200/80 bg-white/90 p-2 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#141210]/95 ${className}`}>
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 lg:hidden">Modules</p>
            <div
                className="-mx-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]"
                role="tablist"
                aria-label="Chart modules"
            >
                {FACESHEET_MODULES.map((m) => {
                    const Icon = m.icon;
                    return (
                        <NavLink
                            key={m.path}
                            to={`${base}/${m.path}`}
                            end
                            className={({ isActive }) =>
                                `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                                    isActive
                                        ? 'bg-primary text-white shadow-md shadow-primary/25'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                                }`
                            }
                        >
                            <Icon className="h-3.5 w-3.5 opacity-90" strokeWidth={2} aria-hidden />
                            {m.label}
                        </NavLink>
                    );
                })}
            </div>
        </div>
    );
}
