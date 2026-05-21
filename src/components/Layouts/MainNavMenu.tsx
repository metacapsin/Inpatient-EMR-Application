import { useEffect, useState, type ReactNode } from 'react';

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

import {

    emrTopNavDropdownClass,

    emrTopNavItemActiveClass,

    emrTopNavItemBaseClass,

    emrTopNavItemIdleClass,

    emrTopNavLinkClass,

} from '../../styles/emrLayoutClasses';



const linkClass = 'text-emr-text dark:text-gray-300 dark:group-hover:text-white-dark';



const navIconClass =

    'h-4 w-4 shrink-0 opacity-75 transition-opacity group-hover:opacity-100 group-[.is-active]:opacity-100';



type MainNavMenuProps = {

    variant: 'sidebar' | 'top';

};



function dropdownItemClass(isActive: boolean) {

    return [

        'block px-3 py-2 text-[12.5px] font-medium transition-colors duration-150',

        isActive

            ? 'bg-emr-active font-semibold text-emr-accent dark:bg-primary/15 dark:text-primary-200'

            : 'text-emr-text hover:bg-emr-hover hover:text-emr-accent dark:text-gray-300 dark:hover:bg-white/5',

    ].join(' ');

}



function TopNavDropdown({

    open,

    children,

    className = '',

}: {

    open: boolean;

    children: ReactNode;

    className?: string;

}) {

    return (

        <div

            className={[

                'absolute left-0 top-full z-[60] pt-1.5',

                open ? 'pointer-events-auto' : 'pointer-events-none',

            ].join(' ')}

        >

            <div
                className={[
                    emrTopNavDropdownClass,
                    'origin-top transition-all duration-200 ease-out',
                    open ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-1 scale-[0.98] opacity-0',
                    className,
                ].join(' ')}
            >
                {children}
            </div>

        </div>

    );

}



export function MainNavMenu({ variant }: MainNavMenuProps) {

    const { t } = useTranslation();

    const { pathname } = useLocation();

    const dispatch = useDispatch();

    const [patientsOpen, setPatientsOpen] = useState(true);

    const [patientsHover, setPatientsHover] = useState(false);

    const [appointmentsOpen, setAppointmentsOpen] = useState(false);

    const [appointmentsHover, setAppointmentsHover] = useState(false);



    useEffect(() => {

        if (isPatientsSectionActive(pathname)) {

            setPatientsOpen(true);

        }

    }, [pathname]);



    const closeMobileSidebar = () => {

        if (window.innerWidth < 1024) {

            dispatch(toggleSidebar());

        }

    };



    const topDropdownTriggerClass = (sectionActive: boolean, hover: boolean) =>

        [

            emrTopNavItemBaseClass,

            'group',

            sectionActive || hover ? emrTopNavItemActiveClass : emrTopNavItemIdleClass,

        ].join(' ');



    if (variant === 'top') {

        return (

            <nav className="hidden min-w-0 flex-1 lg:block" aria-label="Main navigation">

                <ul className="flex items-center gap-0.5">

                    <li>

                        <NavLink to="/app/dashboard" className={({ isActive }) => emrTopNavLinkClass(isActive)}>

                            <IconMenuDashboard className={navIconClass} />

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

                            className={topDropdownTriggerClass(

                                isAppointmentsSectionActive(pathname),

                                appointmentsHover,

                            )}

                            aria-expanded={appointmentsHover}

                            aria-haspopup="true"

                            onClick={() => setAppointmentsHover((o) => !o)}

                        >

                            <IconMenuCalendar className={navIconClass} />

                            <span>Appointments</span>

                            <IconCaretDown

                                className={`h-3 w-3 shrink-0 opacity-50 transition-transform duration-200 ${appointmentsHover ? 'rotate-180' : ''}`}

                            />

                        </button>

                        <TopNavDropdown open={appointmentsHover}>

                            <ul className="min-w-[210px] py-0.5">

                                {APPOINTMENT_SUB_LINKS.map((item) => (

                                    <li key={item.to}>

                                        <NavLink

                                            to={item.to}

                                            end={item.to === '/app/appointments'}

                                            className={({ isActive }) => dropdownItemClass(isActive)}

                                            onClick={() => setAppointmentsHover(false)}

                                        >

                                            {item.label}

                                        </NavLink>

                                    </li>

                                ))}

                            </ul>

                        </TopNavDropdown>

                    </li>

                    <li>

                        <NavLink to="/app/staff-scheduling" className={({ isActive }) => emrTopNavLinkClass(isActive)}>

                            <IconMenuContacts className={navIconClass} />

                            <span className="hidden xl:inline">Staff scheduling</span>

                            <span className="xl:hidden">Scheduling</span>

                        </NavLink>

                    </li>

                    <li

                        className="relative"

                        onMouseEnter={() => setPatientsHover(true)}

                        onMouseLeave={() => setPatientsHover(false)}

                    >

                        <button

                            type="button"

                            className={topDropdownTriggerClass(isPatientsSectionActive(pathname), patientsHover)}

                            aria-expanded={patientsHover}

                            aria-haspopup="true"

                            onClick={() => setPatientsHover((o) => !o)}

                        >

                            <IconMenuUsers className={navIconClass} />

                            <span>Patients</span>

                            <IconCaretDown

                                className={`h-3 w-3 shrink-0 opacity-50 transition-transform duration-200 ${patientsHover ? 'rotate-180' : ''}`}

                            />

                        </button>

                        <TopNavDropdown open={patientsHover} className="min-w-[320px]">

                            <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-0">

                                <div className="border-b border-emr-border/60 px-1 py-1 sm:border-b-0 sm:border-r dark:border-white/10">

                                    <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emr-muted">

                                        Registry

                                    </p>

                                    <ul>

                                        {PATIENT_SUB_LINKS.slice(0, 2).map((item) => (

                                            <li key={item.to}>

                                                <NavLink

                                                    to={item.to}

                                                    className={({ isActive }) => dropdownItemClass(isActive)}

                                                    onClick={() => setPatientsHover(false)}

                                                >

                                                    {item.label}

                                                </NavLink>

                                            </li>

                                        ))}

                                    </ul>

                                </div>

                                <div className="px-1 py-1">

                                    <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emr-muted">

                                        Inpatient

                                    </p>

                                    <ul>

                                        {PATIENT_SUB_LINKS.slice(2).map((item) => (

                                            <li key={item.to}>

                                                <NavLink

                                                    to={item.to}

                                                    title={'title' in item ? item.title : undefined}

                                                    className={({ isActive }) => dropdownItemClass(isActive)}

                                                    onClick={() => setPatientsHover(false)}

                                                >

                                                    <span className="line-clamp-2 leading-snug">{item.label}</span>

                                                </NavLink>

                                            </li>

                                        ))}

                                    </ul>

                                </div>

                            </div>

                        </TopNavDropdown>

                    </li>

                    <li>

                        <NavLink to="/app/settings" className={({ isActive }) => emrTopNavLinkClass(isActive)}>

                            <IconMenuPages className={navIconClass} />

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

