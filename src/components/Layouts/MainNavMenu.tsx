import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import IconCaretDown from '../Icon/IconCaretDown';
import IconMenuDashboard from '../Icon/Menu/IconMenuDashboard';
import IconMenuUsers from '../Icon/Menu/IconMenuUsers';
import IconMenuCalendar from '../Icon/Menu/IconMenuCalendar';
import IconMenuNotes from '../Icon/Menu/IconMenuNotes';
import IconMenuApps from '../Icon/Menu/IconMenuApps';
import IconMenuPages from '../Icon/Menu/IconMenuPages';
import { toggleSidebar } from '../../store/themeConfigSlice';
import {
    APPOINTMENT_SUB_LINKS,
    CLINICAL_SUB_LINKS,
    isAppointmentsSectionActive,
    BILLING_SUB_LINKS,
    isBillingSectionActive,
    isClinicalSectionActive,
    isDropdownGroupActive,
    isOperationsSectionActive,
    isPatientsSectionActive,
    MAIN_NAV_DROPDOWN_GROUPS,
    OPERATIONS_SUB_LINKS,
    PATIENT_SUB_LINKS,
} from './mainNavConfig';
import { TopNavDropdown } from './TopNavDropdown';
import { emrTopNavLinkClass } from '../../styles/emrLayoutClasses';

const linkClass = 'text-emr-text dark:text-gray-300 dark:group-hover:text-white-dark';

const navIconClass =
    'h-4 w-4 shrink-0 opacity-75 transition-opacity group-hover:opacity-100 group-[.is-active]:opacity-100';

type MainNavMenuProps = {
    variant: 'sidebar' | 'top';
};

const DROPDOWN_ICONS = {
    patients: IconMenuUsers,
    clinical: IconMenuNotes,
    operations: IconMenuApps,
    billing: IconMenuPages,
} as const;

export function MainNavMenu({ variant }: MainNavMenuProps) {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const dispatch = useDispatch();

    const [sidebarSections, setSidebarSections] = useState<Record<string, boolean>>({
        appointments: false,
        patients: true,
        clinical: false,
        operations: false,
    });

    useEffect(() => {
        setSidebarSections((prev) => ({
            ...prev,
            patients: isPatientsSectionActive(pathname) ? true : prev.patients,
            clinical: isClinicalSectionActive(pathname) ? true : prev.clinical,
            operations: isOperationsSectionActive(pathname) ? true : prev.operations,
            billing: isBillingSectionActive(pathname) ? true : prev.billing,
            appointments: isAppointmentsSectionActive(pathname) ? true : prev.appointments,
        }));
    }, [pathname]);

    const closeMobileSidebar = () => {
        if (window.innerWidth < 1024) {
            dispatch(toggleSidebar());
        }
    };

    const toggleSidebarSection = (id: string) => {
        setSidebarSections((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    if (variant === 'top') {
        return (
            <nav className="hidden min-w-0 lg:block" aria-label="Main navigation">
                <ul className="flex flex-nowrap items-center gap-1 lg:gap-1.5 [&>li]:shrink-0">
                    <li>
                        <NavLink to="/app/dashboard" className={({ isActive }) => emrTopNavLinkClass(isActive)}>
                            <IconMenuDashboard className={navIconClass} />
                            <span>{t('dashboard')}</span>
                        </NavLink>
                    </li>

                    <TopNavDropdown
                        label="Appointments"
                        items={APPOINTMENT_SUB_LINKS}
                        sectionActive={isAppointmentsSectionActive(pathname)}
                        icon={<IconMenuCalendar className={navIconClass} />}
                        minWidthClass="min-w-[210px]"
                    />

                    {MAIN_NAV_DROPDOWN_GROUPS.map((group) => {
                        const Icon = DROPDOWN_ICONS[group.id as keyof typeof DROPDOWN_ICONS];
                        const minWidth =
                            group.id === 'clinical' ? 'min-w-[260px]' : group.id === 'patients' ? 'min-w-[200px]' : 'min-w-[210px]';
                        return (
                            <TopNavDropdown
                                key={group.id}
                                label={group.label}
                                items={group.items}
                                sectionActive={isDropdownGroupActive(pathname, group)}
                                icon={<Icon className={navIconClass} />}
                                minWidthClass={minWidth}
                                menuAlign={group.menuAlign}
                            />
                        );
                    })}

                    <li className="shrink-0">
                        <NavLink to="/app/settings" className={({ isActive }) => emrTopNavLinkClass(isActive)}>
                            <IconMenuPages className={navIconClass} />
                            <span className="whitespace-nowrap">Settings</span>
                        </NavLink>
                    </li>
                </ul>
            </nav>
        );
    }

    const renderSidebarDropdown = (
        id: string,
        label: string,
        Icon: typeof IconMenuUsers,
        items: typeof PATIENT_SUB_LINKS,
    ) => (
        <li className="menu nav-item" key={id}>
            <button
                type="button"
                className={`group ${sidebarSections[id] ? 'active' : ''}`}
                onClick={() => toggleSidebarSection(id)}
                aria-expanded={sidebarSections[id]}
            >
                <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center">
                        <Icon className="shrink-0 text-black/50 group-hover:!text-primary dark:text-white/50" />
                        <span className={`ltr:pl-3 rtl:pr-3 ${linkClass}`}>{label}</span>
                    </div>
                    <IconCaretDown
                        className={`h-4 w-4 shrink-0 text-black/40 transition-transform dark:text-white/40 ${sidebarSections[id] ? 'rotate-180' : ''}`}
                    />
                </div>
            </button>
            {sidebarSections[id] && (
                <ul className="sub-menu">
                    {items.map((item) => (
                        <li key={item.to}>
                            <NavLink
                                to={item.to}
                                title={item.title}
                                onClick={closeMobileSidebar}
                            >
                                {item.label}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );

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

            {renderSidebarDropdown('appointments', 'Appointments', IconMenuCalendar, APPOINTMENT_SUB_LINKS)}

            {renderSidebarDropdown('patients', 'Patients', IconMenuUsers, PATIENT_SUB_LINKS)}

            {renderSidebarDropdown('clinical', 'Clinical', IconMenuNotes, CLINICAL_SUB_LINKS)}

            {renderSidebarDropdown('operations', 'Operations', IconMenuApps, OPERATIONS_SUB_LINKS)}

            {renderSidebarDropdown('billing', 'Billing', IconMenuPages, BILLING_SUB_LINKS)}

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
