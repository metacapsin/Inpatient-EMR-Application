import { NavLink, useParams } from 'react-router-dom';
import { facesheetModulesByGroup } from '../../facesheet/facesheetModules';
import { useAppLayout } from '../../contexts/AppLayoutContext';
import { emrChartGroupHeaderClass, emrNavLinkClass } from '../../styles/emrLayoutClasses';

type FacesheetChartNavListProps = {
    onNavigate?: () => void;
};

function moduleHref(base: string, path: string): string {
    return `${base}/${path}`;
}

/** Patient chart module links — shared by desktop rail and mobile drawer. */
export function FacesheetChartNavList({ onNavigate }: FacesheetChartNavListProps) {
    const { id: paramId } = useParams<{ id: string }>();
    const { facesheetPatientId } = useAppLayout();
    const rawId = paramId?.trim() || facesheetPatientId || '';
    const patientId = rawId ? encodeURIComponent(rawId) : '';
    const base = patientId ? `/app/facesheet/${patientId}` : '/app/patients/list';
    const groups = facesheetModulesByGroup();

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="shrink-0 border-b border-emr-border px-4 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-emr-muted">
                Patient chart
            </p>

            <nav
                className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-2 pb-4 pt-2 [overscroll-behavior:contain]"
                aria-label="Chart sections"
            >
                {groups.map(({ group, title, items }) => (
                    <div key={group} className="space-y-0.5">
                        <p className={emrChartGroupHeaderClass}>{title}</p>
                        <ul className="space-y-0.5 pl-0.5">
                            {items.map((m) => {
                                const Icon = m.icon;
                                return (
                                    <li key={m.path}>
                                        <NavLink
                                            to={moduleHref(base, m.path)}
                                            onClick={onNavigate}
                                            className={({ isActive }) => emrNavLinkClass(isActive)}
                                        >
                                            <Icon className="h-4 w-4 shrink-0 opacity-75" strokeWidth={1.75} aria-hidden />
                                            <span className="truncate">{m.label}</span>
                                        </NavLink>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>
        </div>
    );
}
