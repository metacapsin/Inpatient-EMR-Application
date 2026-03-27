import PerfectScrollbar from 'react-perfect-scrollbar';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation } from 'react-router-dom';
import { toggleSidebar } from '../../store/themeConfigSlice';
import AnimateHeight from 'react-animate-height';
import { IRootState } from '../../store';
import { useState, useEffect } from 'react';
import IconCaretsDown from '../Icon/IconCaretsDown';
import IconCaretDown from '../Icon/IconCaretDown';
import IconMenuDashboard from '../Icon/Menu/IconMenuDashboard';
import IconMinus from '../Icon/IconMinus';
import IconMenuChat from '../Icon/Menu/IconMenuChat';
import IconMenuMailbox from '../Icon/Menu/IconMenuMailbox';
import IconMenuTodo from '../Icon/Menu/IconMenuTodo';
import IconMenuNotes from '../Icon/Menu/IconMenuNotes';
import IconMenuScrumboard from '../Icon/Menu/IconMenuScrumboard';
import IconMenuContacts from '../Icon/Menu/IconMenuContacts';
import IconMenuInvoice from '../Icon/Menu/IconMenuInvoice';
import IconMenuCalendar from '../Icon/Menu/IconMenuCalendar';
import IconMenuComponents from '../Icon/Menu/IconMenuComponents';
import IconMenuElements from '../Icon/Menu/IconMenuElements';
import IconMenuCharts from '../Icon/Menu/IconMenuCharts';
import IconMenuWidgets from '../Icon/Menu/IconMenuWidgets';
import IconMenuFontIcons from '../Icon/Menu/IconMenuFontIcons';
import IconMenuDragAndDrop from '../Icon/Menu/IconMenuDragAndDrop';
import IconMenuTables from '../Icon/Menu/IconMenuTables';
import IconMenuDatatables from '../Icon/Menu/IconMenuDatatables';
import IconMenuForms from '../Icon/Menu/IconMenuForms';
import IconMenuUsers from '../Icon/Menu/IconMenuUsers';
import IconMenuPages from '../Icon/Menu/IconMenuPages';
import IconMenuAuthentication from '../Icon/Menu/IconMenuAuthentication';
import IconMenuDocumentation from '../Icon/Menu/IconMenuDocumentation';
import IconSettings from '../Icon/IconSettings';
import IconCreditCard from '../Icon/IconCreditCard';
import IconLock from '../Icon/IconLock';
import IconUsersGroup from '../Icon/IconUsersGroup';
import mdCareLogo from '../../assets/images/mdcare-logo.png';

const Sidebar = () => {
    const [currentMenu, setCurrentMenu] = useState<string>('');
    const [errorSubMenu, setErrorSubMenu] = useState(false);
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const premiumSubscription = useSelector((state: IRootState) => state.auth.premiumSubscription);
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);
    const location = useLocation();
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const toggleMenu = (value: string) => {
        setCurrentMenu((oldValue) => {
            return oldValue === value ? '' : value;
        });
    };

    useEffect(() => {
        const selector = document.querySelector('.sidebar ul a[href="' + window.location.pathname + '"]');
        if (selector) {
            selector.classList.add('active');
            const ul: any = selector.closest('ul.sub-menu');
            if (ul) {
                let ele: any = ul.closest('li.menu').querySelectorAll('.nav-link') || [];
                if (ele.length) {
                    ele = ele[0];
                    setTimeout(() => {
                        ele.click();
                    });
                }
            }
        }
    }, []);

    useEffect(() => {
        if (window.innerWidth < 1024 && themeConfig.sidebar) {
            dispatch(toggleSidebar());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

    return (
        <div className={semidark ? 'dark' : ''}>
            <nav
                className={`sidebar fixed min-h-screen h-full top-0 bottom-0 w-[260px] shadow-[5px_0_25px_0_rgba(151,112,79,0.08)] transition-all duration-300 border-r border-primary-100/30 dark:border-primary-900/20 ${semidark ? 'text-white-dark' : ''} ${themeConfig.sidebar ? 'z-[50] lg:z-10' : 'z-10'}`}
            >
                <div className="bg-white dark:bg-black h-full">
                    <div className="flex justify-between items-center px-4 py-3">
                        <NavLink to="/" className="main-logo flex items-center shrink-0">
                            {/* Logo image - shown in dark mode only */}
                            <img className="h-8 w-auto object-contain hidden dark:block" src={mdCareLogo} alt="MD Care" />
                            {/* Text - shown in light mode only */}
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
                                <span>Patient Portal</span>
                            </h2>

                            <li className="nav-item">
                                <ul>
                                    <li className="nav-item">
                                        <NavLink to="/app/dashboard" className="group">
                                            <div className="flex items-center">
                                                <IconMenuDashboard className="group-hover:!text-primary shrink-0" />
                                                <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">{t('dashboard')}</span>
                                            </div>
                                        </NavLink>
                                    </li>
                                    <li className="menu nav-item">
                                        <button type="button" className={`${currentMenu === 'healthSymptom' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('healthSymptom')}>
                                            <div className="flex items-center">
                                                <IconMenuCharts className="group-hover:!text-primary shrink-0" />
                                                <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">Health Monitoring</span>
                                            </div>
                                            <div className={currentMenu !== 'healthSymptom' ? 'rtl:rotate-90 -rotate-90' : ''}>
                                                <IconCaretDown />
                                            </div>
                                        </button>
                                        <AnimateHeight duration={300} height={currentMenu === 'healthSymptom' ? 'auto' : 0}>
                                            <ul className="sub-menu text-gray-500">
                                                <li>
                                                    <NavLink to="/app/symptom-assessment">Symptom Assessment</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/daily-log">Daily Log</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/health-trends">Health Trends</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/health-alerts">Health Alerts</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/provider/patient-risk-list">Patient Risk List</NavLink>
                                                </li>
                                            </ul>
                                        </AnimateHeight>
                                    </li>
                                    <li className="nav-item">
                                        <NavLink to="/app/appointments" className="group">
                                            <div className="flex items-center">
                                                <IconMenuCalendar className="group-hover:!text-primary shrink-0" />
                                                <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">Appointments</span>
                                            </div>
                                        </NavLink>
                                    </li>
                                    <li className="menu nav-item">
                                        <button type="button" className={`${currentMenu === 'patient' ? 'active' : ''} nav-link group w-full`} onClick={() => toggleMenu('patient')}>
                                            <div className="flex items-center">
                                                <IconMenuUsers className="group-hover:!text-primary shrink-0" />
                                                <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">Patient</span>
                                            </div>
                                            <div className={currentMenu !== 'patient' ? 'rtl:rotate-90 -rotate-90' : ''}>
                                                <IconCaretDown />
                                            </div>
                                        </button>
                                        <AnimateHeight duration={300} height={currentMenu === 'patient' ? 'auto' : 0}>
                                            <ul className="sub-menu text-gray-500">
                                                <li>
                                                    <NavLink to="/app/health-summary">Health Summary</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/vitals">Vitals</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/demographic">Demographic</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/history">History</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/diagnoses">Diagnoses</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/medications">Medications</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/prescriptions">Prescriptions</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/allergies">Allergies</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/documents">Documents</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/notes">Notes</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/labs">Labs</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/lab-orders">Lab Orders</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/immunizations">Immunizations</NavLink>
                                                </li>
                                                <li>
                                                    <NavLink to="/app/preventive-screening">Preventive Screening</NavLink>
                                                </li>
                                            </ul>
                                        </AnimateHeight>
                                    </li>
                                    <li className="nav-item">
                                        <NavLink to="/app/patient-steps" className="group">
                                            <div className="flex items-center">
                                                <IconSettings className="group-hover:!text-primary shrink-0" />
                                                <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">Steps</span>
                                            </div>
                                        </NavLink>
                                    </li>
                                </ul>
                            </li>

                            <li className="nav-item">
                                <NavLink to="/app/subscription" className="group">
                                    <div className="flex items-center">
                                        <IconCreditCard className="group-hover:!text-primary shrink-0" />
                                        <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">Subscription</span>
                                        {!premiumSubscription?.active && (
                                            <span className="ml-auto flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary dark:bg-primary/25 shrink-0">
                                                <IconLock className="w-2.5 h-2.5" /> Upgrade
                                            </span>
                                        )}
                                    </div>
                                </NavLink>
                            </li>

                            <li className="nav-item">
                                <NavLink to="/app/settings" className="group">
                                    <div className="flex items-center">
                                        <IconSettings className="group-hover:!text-primary shrink-0" />
                                        <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">Settings</span>
                                    </div>
                                </NavLink>
                            </li>

                            {premiumSubscription?.planId === 'family' && (
                                <li className="nav-item">
                                    <NavLink to="/app/family-members" className="group">
                                        <div className="flex items-center">
                                            <IconUsersGroup className="group-hover:!text-primary shrink-0" />
                                            <span className="ltr:pl-3 rtl:pr-3 text-black dark:text-[#506690] dark:group-hover:text-white-dark">Family Members</span>
                                        </div>
                                    </NavLink>
                                </li>
                            )}
                        </ul>
                    </PerfectScrollbar>
                </div>
            </nav>
        </div>
    );
};

export default Sidebar;
