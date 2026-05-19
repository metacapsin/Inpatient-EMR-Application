import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import IconCaretDown from '../Icon/IconCaretDown';
import IconMenuDashboard from '../Icon/Menu/IconMenuDashboard';
import IconMenuUsers from '../Icon/Menu/IconMenuUsers';
import IconMenuCalendar from '../Icon/Menu/IconMenuCalendar';
import IconMenuContacts from '../Icon/Menu/IconMenuContacts';
import IconMenuPages from '../Icon/Menu/IconMenuPages';
import { toggleSidebar } from '../../store/themeConfigSlice';
import {
    APPOINTMENT_SUB_LINKS,
    isAppointmentsSectionActive,
    isPatientsSectionActive,
    PATIENT_SUB_LINKS,
} from './mainNavConfig';

const linkClass = 'text-black dark:text-[#506690] dark:group-hover:text-white-dark';

type MainNavMenuProps = {
    variant: 'sidebar' | 'top';
};

export function MainNavMenu({ variant }: MainNavMenuProps) {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const dispatch = useDispatch();
    const [patientsOpen, setPatientsOpen] = useState(() => isPatientsSectionActive(pathname));
    const [patientsHover, setPatientsHover] = useState(false);
    const [appointmentsOpen, setAppointmentsOpen] = useState(() => isAppointmentsSectionActive(pathname));
    const [appointmentsHover, setAppointmentsHover] = useState(false);

    useEffect(() => {
        if (isPatientsSectionActive(pathname)) {
            setPatientsOpen(true);
        }
        if (isAppointmentsSectionActive(pathname)) {
            setAppointmentsOpen(true);
        }
    }, [pathname]);

    const closeMobileSidebar = () => {
        if (window.innerWidth < 1024) {
            dispatch(toggleSidebar());
        }
    };

    const topItemClass = ({ isActive }: { isActive: boolean }) =>
        [
            'group flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold transition-colors',
            isActive
                ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-200'
                : 'text-gray-700 hover:bg-primary/5 hover:text-primary dark:text-gray-300 dark:hover:bg-primary/10',
        ].join(' ');

    if (variant === 'top') {
        return (
            <nav className="hidden min-w-0 flex-1 lg:block" aria-label="Main navigation">
                <ul className="flex flex-wrap items-center gap-0.5 font-semibold">
                    <li>
                        <NavLink to="/app/dashboard" className={topItemClass}>
                            <IconMenuDashboard className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100" />
                            <span>{t('dashboard')}</span>
                        </NavLink>
                    </li>
                    <li
                        className="relative"
                        onMouseEnter={() => setAppointmentsHover(true)}
                        onMouseLeave={() => setAppointmentsHover(false)}
                    >
                        <button
                            type="button"
                            className={[
                                'group flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold transition-colors',
                                isAppointmentsSectionActive(pathname) || appointmentsHover
                                    ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-200'
                                    : 'text-gray-700 hover:bg-primary/5 hover:text-primary dark:text-gray-300 dark:hover:bg-primary/10',
                            ].join(' ')}
                            aria-expanded={appointmentsHover}
                            aria-haspopup="true"
                            onClick={() => setAppointmentsHover((o) => !o)}
                        >
                            <IconMenuCalendar className="h-4 w-4 shrink-0 opacity-70" />
                            <span>Appointments</span>
                            <IconCaretDown
                                className={`h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${appointmentsHover ? 'rotate-180' : ''}`}
                            />
                        </button>
                        <ul
                            className={[
                                'absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-primary-100/60 bg-white py-1.5 shadow-lg dark:border-primary-900/40 dark:bg-[#141210]',
                                'transition-all duration-150',
                                appointmentsHover ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                            ].join(' ')}
                        >
                            {APPOINTMENT_SUB_LINKS.map((item) => (
                                <li key={item.to}>
                                    <NavLink
                                        to={item.to}
                                        end={item.to === '/app/appointments'}
                                        className={({ isActive }) =>
                                            [
                                                'block px-3 py-2 text-[13px] font-medium transition-colors',
                                                isActive
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-gray-700 hover:bg-primary/5 hover:text-primary dark:text-gray-300 dark:hover:bg-primary/10',
                                            ].join(' ')
                                        }
                                        onClick={() => setAppointmentsHover(false)}
                                    >
                                        {item.label}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </li>
                    <li>
                        <NavLink to="/app/staff-scheduling" className={topItemClass}>
                            <IconMenuContacts className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100" />
                            <span>Staff scheduling</span>
                        </NavLink>
                    </li>
                    <li
                        className="relative"
                        onMouseEnter={() => setPatientsHover(true)}
                        onMouseLeave={() => setPatientsHover(false)}
                    >
                        <button
                            type="button"
                            className={[
                                'group flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold transition-colors',
                                isPatientsSectionActive(pathname) || patientsHover
                                    ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-200'
                                    : 'text-gray-700 hover:bg-primary/5 hover:text-primary dark:text-gray-300 dark:hover:bg-primary/10',
                            ].join(' ')}
                            aria-expanded={patientsHover}
                            aria-haspopup="true"
                            onClick={() => setPatientsHover((o) => !o)}
                        >
                            <IconMenuUsers className="h-4 w-4 shrink-0 opacity-70" />
                            <span>Patients</span>
                            <IconCaretDown
                                className={`h-3.5 w-3.5 shrink-0 opacity-50 transition-transform ${patientsHover ? 'rotate-180' : ''}`}
                            />
                        </button>
                        <ul
                            className={[
                                'absolute left-0 top-full z-50 mt-1 min-w-[240px] rounded-lg border border-primary-100/60 bg-white py-1.5 shadow-lg dark:border-primary-900/40 dark:bg-[#141210]',
                                'transition-all duration-150',
                                patientsHover ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                            ].join(' ')}
                        >
                            {PATIENT_SUB_LINKS.map((item) => (
                                <li key={item.to}>
                                    <NavLink
                                        to={item.to}
                                        title={'title' in item ? item.title : undefined}
                                        className={({ isActive }) =>
                                            [
                                                'block px-3 py-2 text-[13px] font-medium transition-colors',
                                                isActive
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-gray-700 hover:bg-primary/5 hover:text-primary dark:text-gray-300 dark:hover:bg-primary/10',
                                            ].join(' ')
                                        }
                                        onClick={() => setPatientsHover(false)}
                                    >
                                        {item.label}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </li>
                    <li>
                        <NavLink to="/app/settings" className={topItemClass}>
                            <IconMenuPages className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100" />
                            <span>Settings</span>
                        </NavLink>
                    </li>
                </ul>
            </nav>
        );
    }

    return (
        <ul className="relative space-y-0.5 p-4 py-0 font-semibold">
            <li className="nav-item">
                <NavLink to="/app/dashboard" className="group" onClick={closeMobileSidebar}>
                    <div className="flex items-center">
                        <IconMenuDashboard className="shrink-0 group-hover:!text-primary" />
                        <span className={`ltr:pl-3 rtl:pr-3 ${linkClass}`}>{t('dashboard')}</span>
                    </div>
                </NavLink>
            </li>
            <li className="menu nav-item">
                <button
                    type="button"
                    className={`group ${appointmentsOpen ? 'active' : ''}`}
                    onClick={() => setAppointmentsOpen((o) => !o)}
                >
                    <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center">
                            <IconMenuCalendar className="shrink-0 text-black/50 group-hover:!text-primary dark:text-white/50" />
                            <span className={`ltr:pl-3 rtl:pr-3 ${linkClass}`}>Appointments</span>
                        </div>
                        <IconCaretDown
                            className={`h-4 w-4 shrink-0 text-black/40 transition-transform dark:text-white/40 ${appointmentsOpen ? 'rotate-180' : ''}`}
                        />
                    </div>
                </button>
                {appointmentsOpen && (
                    <ul className="sub-menu">
                        {APPOINTMENT_SUB_LINKS.map((item) => (
                            <li key={item.to}>
                                <NavLink to={item.to} end={item.to === '/app/appointments'} onClick={closeMobileSidebar}>
                                    {item.label}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                )}
            </li>
            <li className="nav-item">
                <NavLink to="/app/staff-scheduling" className="group" onClick={closeMobileSidebar}>
                    <div className="flex items-center">
                        <IconMenuContacts className="shrink-0 group-hover:!text-primary" />
                        <span className={`ltr:pl-3 rtl:pr-3 ${linkClass}`}>Staff scheduling</span>
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
                            <IconMenuUsers className="shrink-0 text-black/50 group-hover:!text-primary dark:text-white/50" />
                            <span className={`ltr:pl-3 rtl:pr-3 ${linkClass}`}>Patients</span>
                        </div>
                        <IconCaretDown
                            className={`h-4 w-4 shrink-0 text-black/40 transition-transform dark:text-white/40 ${patientsOpen ? 'rotate-180' : ''}`}
                        />
                    </div>
                </button>
                {patientsOpen && (
                    <ul className="sub-menu">
                        {PATIENT_SUB_LINKS.map((item) => (
                            <li key={item.to}>
                                <NavLink
                                    to={item.to}
                                    title={'title' in item ? item.title : undefined}
                                    onClick={closeMobileSidebar}
                                >
                                    {item.label}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                )}
            </li>
            <li className="nav-item">
                <NavLink to="/app/settings" className="group" onClick={closeMobileSidebar}>
                    <div className="flex items-center">
                        <IconMenuPages className="shrink-0 group-hover:!text-primary" />
                        <span className={`ltr:pl-3 rtl:pr-3 ${linkClass}`}>Settings</span>
                    </div>
                </NavLink>
            </li>
        </ul>
    );
}
