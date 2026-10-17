import PerfectScrollbar from 'react-perfect-scrollbar';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useLocation } from 'react-router-dom';
import { toggleSidebar } from '../../store/themeConfigSlice';
import { IRootState } from '../../store';
import { useEffect } from 'react';
import IconCaretsDown from '../Icon/IconCaretsDown';
import IconMinus from '../Icon/IconMinus';
import logoLight from '../../assets/images/codavia-logo.svg';
import logoDark from '../../assets/images/codavia-logo_dark.svg';
import { MainNavMenu } from './MainNavMenu';

/** Mobile/tablet drawer only — desktop nav lives in the header. */
const Sidebar = () => {
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const semidark = useSelector((state: IRootState) => state.themeConfig.semidark);
    const location = useLocation();
    const dispatch = useDispatch();

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

    return (
        <div className={semidark ? 'dark' : ''}>
            <nav
                className={`sidebar fixed bottom-0 top-0 z-[50] h-full min-h-screen w-[200px] border-r border-emr-border bg-emr-sidebar transition-all duration-300 lg:hidden ${semidark ? 'text-white-dark' : ''} ${themeConfig.sidebar ? 'z-[50]' : 'z-10'}`}
            >
                <div className="h-full bg-emr-sidebar dark:bg-black">
                    <div className="flex items-center justify-between px-4 py-3">
                        <NavLink to="/app/dashboard" className="main-logo flex shrink-0 items-center">
                            <img className="h-8 w-auto object-contain dark:hidden" src={logoLight} alt="Codavia Health" />
                            <img className="hidden h-8 w-auto object-contain dark:block" src={logoDark} alt="Codavia Health" />
                        </NavLink>
                        <button
                            type="button"
                            className="collapse-icon flex h-8 w-8 items-center rounded-full transition duration-300 hover:bg-gray-500/10 dark:hover:bg-dark-light/10 dark:text-white-light rtl:rotate-180"
                            onClick={() => dispatch(toggleSidebar())}
                            aria-label="Close menu"
                        >
                            <IconCaretsDown className="m-auto rotate-90" />
                        </button>
                    </div>
                    <PerfectScrollbar className="relative h-[calc(100vh-80px)]">
                        <h2 className="-mx-4 mb-1 flex items-center bg-white-light/30 px-7 py-3 text-xs font-extrabold uppercase dark:bg-dark dark:bg-opacity-[0.08]">
                            <IconMinus className="hidden h-5 w-4 flex-none" />
                            <span>EMR Inpatient</span>
                        </h2>
                        <MainNavMenu variant="sidebar" />
                    </PerfectScrollbar>
                </div>
            </nav>
        </div>
    );
};

export default Sidebar;
