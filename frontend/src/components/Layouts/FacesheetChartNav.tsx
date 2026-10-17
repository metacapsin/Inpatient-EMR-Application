import { useSelector } from 'react-redux';
import type { IRootState } from '../../store';
import { FacesheetChartNavList } from './FacesheetChartNavList';

/**
 * Desktop patient chart rail — sits below encounter header, beside module content.
 */
export function FacesheetChartNav() {
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);

    return (
        <aside
            className={`facesheet-chart-nav hidden h-full min-h-0 w-[220px] shrink-0 flex flex-col overflow-hidden border-r border-emr-border lg:flex ${
                semidark ? 'dark' : ''
            }`}
            aria-label="Patient chart navigation"
        >
            <FacesheetChartNavList />
        </aside>
    );
}
