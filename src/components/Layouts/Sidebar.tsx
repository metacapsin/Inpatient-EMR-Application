import PerfectScrollbar from 'react-perfect-scrollbar';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation } from 'react-router-dom';
import { toggleSidebar } from '../../store/themeConfigSlice';
import { IRootState } from '../../store';
import { useEffect, useState } from 'react';
import IconCaretsDown from '../Icon/IconCaretsDown';
import IconCaretDown from '../Icon/IconCaretDown';
import IconMinus from '../Icon/IconMinus';
import IconMenuDashboard from '../Icon/Menu/IconMenuDashboard';
import IconMenuUsers from '../Icon/Menu/IconMenuUsers';
import IconMenuCalendar from '../Icon/Menu/IconMenuCalendar';
import IconMenuPages from '../Icon/Menu/IconMenuPages';
import mdCareLogo from '../../assets/images/mdcare-logo.png';

const linkClass =
    'text-black dark:text-[#506690] dark:group-hover:text-white-dark';

/** Only patient list lives in the main sidebar; chart modules use the facesheet sidebar. */
const PATIENT_SECTION_PREFIXES = ['/app/patients'] as const;

function isPatientSectionPath(pathname: string): boolean {
    return PATIENT_SECTION_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const Sidebar = () => {
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);
    const location = useLocation();
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const [patientsOpen, setPatientsOpen] = useState(() => isPatientSectionPath(location.pathname));

    useEffect(() => {
        const selector = document.querySelector('.sidebar ul a[href="' + window.location.pathname + '"]');
        if (selector) {
            selector.classList.add('active');
        }
    }, []);

    useEffect(() => {
        if (window.innerWidth < 1024 && themeConfig.sidebar) {
            dispatch(toggleSidebar());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

    useEffect(() => {
        if (isPatientSectionPath(location.pathname)) {
            setPatientsOpen(true);
        }
    }, [location.pathname]);

    return (
        <div className={semidark ? 'dark' : ''}>
            <nav
                className={`sidebar fixed min-h-screen h-full top-0 bottom-0 w-[260px] shadow-[5px_0_25px_0_rgba(151,112,79,0.08)] transition-all duration-300 border-r border-primary-100/30 dark:border-primary-900/20 ${semidark ? 'text-white-dark' : ''} ${themeConfig.sidebar ? 'z-[50] lg:z-10' : 'z-10'}`}
            >
                <div className="bg-white dark:bg-black h-full">
                    <div className="flex justify-between items-center px-4 py-3">
                        <NavLink to="/app/dashboard" className="main-logo flex items-center shrink-0">
                            <img className="h-8 w-auto object-contain hidden dark:block" src={mdCareLogo} alt="MD Care" />
                            <span className=" text-2xl font-extrabold tracking-wide text-primary align-middle dark:hidden">MD CARE</span>
                        </NavLink>

                        <button
                            type="button"
                            className="collapse-icon w-8 h-8 rounded-full flex items-center hover:bg-gray-500/10 dark:hover:bg-dark-light/10 dark:text-white-light transition duration-300 rtl:rotate-180"
                            onClick={() => dispatch(toggleSidebar())}
                        >
                            <IconCaretsDown className="m-auto rotate-90" />
                        </button>
                    </div>
                    <PerfectScrollbar className="h-[calc(100vh-80px)] relative">
                        <ul className="relative font-semibold space-y-0.5 p-4 py-0">
                            <h2 className="py-3 px-7 flex items-center uppercase font-extrabold bg-white-light/30 dark:bg-dark dark:bg-opacity-[0.08] -mx-4 mb-1">
                                <IconMinus className="w-4 h-5 flex-none hidden" />
                                <span>EMR Inpatient</span>
                            </h2>

                            <li className="nav-item">
                                <ul>
                                    <li className="nav-item">
                                        <NavLink to="/app/dashboard" className="group">
                                            <div className="flex items-center">
                                                <IconMenuDashboard className="group-hover:!text-primary shrink-0" />
                                                <span className={`ltr:pl-3 rtl:pr-3 ${linkClass}`}>{t('dashboard')}</span>
                                            </div>
                                        </NavLink>
                                    </li>

                                    <li className="menu nav-item">
                                        <button
                                            type="button"
                                            className={`group ${patientsOpen ? 'active' : ''}`}
                                            onClick={() => setPatientsOpen((o) => !o)}
                                        >
                                            <div className="flex w-full items-center justify-between gap-2">
                                                <div className="flex min-w-0 items-center">
                                                    <IconMenuUsers className="shrink-0 text-black/50 dark:text-white/50 group-hover:!text-primary" />
                                                    <span className={`ltr:pl-3 rtl:pr-3 ${linkClass}`}>Patients</span>
                                                </div>
                                                <IconCaretDown
                                                    className={`h-4 w-4 shrink-0 text-black/40 transition-transform dark:text-white/40 ${patientsOpen ? 'rotate-180' : ''}`}
                                                />
                                            </div>
                                        </button>
                                        {patientsOpen && (
                                            <ul className="sub-menu">
                                                <li>
                                                    <NavLink to="/app/patients/list">Patient List</NavLink>
                                                </li>
                                            </ul>
                                        )}
                                    </li>

                                    <li className="nav-item">
                                        <NavLink to="/app/appointments" className="group">
                                            <div className="flex items-center">
                                                <IconMenuCalendar className="group-hover:!text-primary shrink-0" />
                                                <span className={`ltr:pl-3 rtl:pr-3 ${linkClass}`}>Appointments</span>
                                            </div>
                                        </NavLink>
                                    </li>

                                    <li className="nav-item">
                                        <NavLink to="/app/settings" className="group">
                                            <div className="flex items-center">
                                                <IconMenuPages className="group-hover:!text-primary shrink-0" />
                                                <span className={`ltr:pl-3 rtl:pr-3 ${linkClass}`}>Settings</span>
                                            </div>
                                        </NavLink>
                                    </li>
                                </ul>
                            </li>
                        </ul>
                    </PerfectScrollbar>
                </div>
            </nav>
        </div>
    );
};

export default Sidebar;
