import PerfectScrollbar from 'react-perfect-scrollbar';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useParams } from 'react-router-dom';
import { toggleSidebar } from '../../store/themeConfigSlice';
import { IRootState } from '../../store';
import IconCaretsDown from '../Icon/IconCaretsDown';
import mdCareLogo from '../../assets/images/mdcare-logo.png';
import { facesheetModulesByGroup } from '../../facesheet/facesheetModules';
import { LayoutDashboard, ListOrdered, ChevronRight } from 'lucide-react';
import { useAppLayout } from '../../contexts/AppLayoutContext';

const FacesheetSidebar = () => {
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);
    const dispatch = useDispatch();
    const { id: paramId } = useParams<{ id: string }>();
    const { facesheetPatientId } = useAppLayout();
    const rawId = paramId?.trim() || facesheetPatientId || '';
    const patientId = rawId ? encodeURIComponent(rawId) : '';
    const base = patientId ? `/app/facesheet/${patientId}` : '/app/patients/list';
    const groups = facesheetModulesByGroup();

    return (
        <div className={semidark ? 'dark' : ''}>
            <nav
                className={`sidebar facesheet-chart-nav fixed min-h-screen h-full top-0 bottom-0 w-[260px] shadow-[5px_0_25px_0_rgba(151,112,79,0.08)] transition-all duration-300 border-r border-primary-100/30 dark:border-primary-900/20 ${
                    semidark ? 'text-white-dark' : ''
                } ${themeConfig.sidebar ? 'z-[50] lg:z-10' : 'z-10'}`}
            >
                <div className="bg-white dark:bg-black h-full flex flex-col">
                    <div className="flex justify-between items-center px-4 py-3 shrink-0 border-b border-gray-100/80 dark:border-white/10">
                        <NavLink to="/app/dashboard" className="main-logo flex items-center shrink-0 gap-2 min-w-0">
                            <img className="h-8 w-auto object-contain hidden dark:block shrink-0" src={mdCareLogo} alt="MD Care" />
                            <span className="text-xl font-extrabold tracking-wide text-primary truncate dark:hidden">MD CARE</span>
                        </NavLink>
                        <button
                            type="button"
                            className="collapse-icon w-8 h-8 rounded-full flex items-center hover:bg-gray-500/10 dark:hover:bg-dark-light/10 dark:text-white-light transition duration-300 rtl:rotate-180 shrink-0"
                            onClick={() => dispatch(toggleSidebar())}
                            aria-label="Close menu"
                        >
                            <IconCaretsDown className="m-auto rotate-90" />
                        </button>
                    </div>

                    <div className="px-3 py-3 shrink-0 space-y-1 border-b border-gray-100/80 dark:border-white/10">
                        <NavLink
                            to="/app/patients/list"
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10 transition-colors"
                        >
                            <ListOrdered className="h-4 w-4 shrink-0 opacity-70" />
                            <span className="truncate">Patient list</span>
                            <ChevronRight className="h-4 w-4 shrink-0 opacity-40 ltr:ml-auto rtl:mr-auto" />
                        </NavLink>
                        <NavLink
                            to="/app/dashboard"
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10 transition-colors"
                        >
                            <LayoutDashboard className="h-4 w-4 shrink-0 opacity-70" />
                            <span>Dashboard</span>
                        </NavLink>
                    </div>

                    <p className="px-5 pt-4 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 shrink-0">
                        Patient chart
                    </p>

                    <PerfectScrollbar className="flex-1 min-h-0 relative" options={{ suppressScrollX: true }}>
                        <nav className="px-3 pb-6 space-y-5" aria-label="Chart sections">
                            {groups.map(({ group, title, items }) => (
                                <div key={group}>
                                    <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                        {title}
                                    </p>
                                    <ul className="space-y-0.5">
                                        {items.map((m) => {
                                            const Icon = m.icon;
                                            return (
                                                <li key={m.path}>
                                                    <NavLink
                                                        to={`${base}/${m.path}`}
                                                        className={({ isActive }) =>
                                                            `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                                                                isActive
                                                                    ? 'bg-primary/12 text-primary font-semibold dark:bg-primary/20 dark:text-primary-200'
                                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                                                            }`
                                                        }
                                                    >
                                                        <Icon
                                                            className="h-4 w-4 shrink-0 opacity-80"
                                                            strokeWidth={1.75}
                                                            aria-hidden
                                                        />
                                                        <span className="truncate">{m.label}</span>
                                                    </NavLink>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </nav>
                    </PerfectScrollbar>
                </div>
            </nav>
        </div>
    );
};

export default FacesheetSidebar;
