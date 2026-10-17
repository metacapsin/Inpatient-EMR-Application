import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import { toggleSidebar } from '../../store/themeConfigSlice';
import { IRootState } from '../../store';
import IconCaretsDown from '../Icon/IconCaretsDown';
import logoLight from '../../assets/images/codavia-logo.svg';
import logoDark from '../../assets/images/codavia-logo_dark.svg';
import { FacesheetChartNavList } from './FacesheetChartNavList';

/** Mobile drawer for patient chart navigation (desktop rail lives in FacesheetPage). */
const FacesheetSidebar = () => {
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);
    const dispatch = useDispatch();

    const closeDrawer = () => {
        if (themeConfig.sidebar) dispatch(toggleSidebar());
    };

    return (
        <div className={semidark ? 'dark' : ''}>
            <nav
                className={`sidebar facesheet-chart-nav fixed bottom-0 top-0 z-50 h-full min-h-screen w-[260px] border-r border-emr-border transition-all duration-300 lg:hidden ${
                    semidark ? 'text-white-dark' : ''
                } ${themeConfig.sidebar ? 'ltr:left-0 rtl:right-0' : 'ltr:-left-[260px] rtl:-right-[260px]'}`}
            >
                <div className="flex h-full flex-col bg-emr-sidebar dark:bg-black">
                    <div className="flex shrink-0 items-center justify-between border-b border-gray-100/80 px-4 py-3 dark:border-white/10">
                        <NavLink to="/app/dashboard" className="main-logo flex min-w-0 shrink-0 items-center gap-2" onClick={closeDrawer}>
                            <img className="h-8 w-auto shrink-0 object-contain dark:hidden" src={logoLight} alt="Codavia Health" />
                            <img className="hidden h-8 w-auto shrink-0 object-contain dark:block" src={logoDark} alt="Codavia Health" />
                        </NavLink>
                        <button
                            type="button"
                            className="collapse-icon flex h-8 w-8 shrink-0 items-center rounded-full transition duration-300 hover:bg-gray-500/10 dark:hover:bg-dark-light/10 dark:text-white-light rtl:rotate-180"
                            onClick={() => dispatch(toggleSidebar())}
                            aria-label="Close menu"
                        >
                            <IconCaretsDown className="m-auto rotate-90" />
                        </button>
                    </div>

                    <FacesheetChartNavList onNavigate={closeDrawer} />
                </div>
            </nav>
        </div>
    );
};

export default FacesheetSidebar;
