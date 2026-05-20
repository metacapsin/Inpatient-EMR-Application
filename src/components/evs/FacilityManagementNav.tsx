import { NavLink, useLocation } from 'react-router-dom';
import { FACILITY_MANAGEMENT_LINKS } from '../../constants/facilityNav';

export function FacilityManagementNav() {
    const { pathname } = useLocation();

    return (
        <nav
            className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-[#191e3a]"
            aria-label="Facility management"
        >
            {FACILITY_MANAGEMENT_LINKS.map((link) => (
                <NavLink
                    key={link.to}
                    to={link.to}
                    title={link.title}
                    className={() =>
                        [
                            'rounded-lg px-4 py-2 text-sm font-semibold transition',
                            pathname === link.to || pathname.startsWith(`${link.to}/`)
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5',
                        ].join(' ')
                    }
                >
                    {link.label}
                </NavLink>
            ))}
        </nav>
    );
}
