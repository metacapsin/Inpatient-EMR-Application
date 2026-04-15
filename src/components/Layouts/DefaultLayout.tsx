import { PropsWithChildren, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import App from '../../App';
import { IRootState } from '../../store';
import { toggleSidebar } from '../../store/themeConfigSlice';
import Footer from './Footer';
import Header from './Header';
import Setting from './Setting';
import Sidebar from './Sidebar';
import FacesheetSidebar from './FacesheetSidebar';
import Portals from '../../components/Portals';
import { AppLayoutProvider, useAppLayout } from '../../contexts/AppLayoutContext';

function DefaultLayoutInner({ children }: PropsWithChildren) {
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const dispatch = useDispatch();
    const location = useLocation();
    const { variant } = useAppLayout();
    const isFacesheet = variant === 'facesheet';
    const isSymptomAssessmentPage = location.pathname === '/app/symptom-assessment';
    const isFullViewportPage = ['/app/health-trends', '/app/daily-log'].includes(location.pathname);
    const isPatientListPage = location.pathname === '/app/patients/list';
    const isBedBoardPage = location.pathname === '/app/bed-board';
    const isAppointmentsListPage = location.pathname === '/app/appointments';
    const isIpdDashboardPage = location.pathname === '/app/dashboard';

    const [showTopButton, setShowTopButton] = useState(false);

    const goToTop = () => {
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    };

    const onScrollHandler = () => {
        if (document.body.scrollTop > 50 || document.documentElement.scrollTop > 50) {
            setShowTopButton(true);
        } else {
            setShowTopButton(false);
        }
    };

    useEffect(() => {
        window.addEventListener('scroll', onScrollHandler);
        return () => {
            window.removeEventListener('scroll', onScrollHandler);
        };
    }, []);

    return (
        <App>
            {/* BEGIN MAIN CONTAINER */}
            <div className="relative">
                {/* sidebar menu overlay - z-40 so it sits below sidebar (z-50 on mobile); outside click closes sidebar */}
                <div
                    role="button"
                    tabIndex={0}
                    className={`${(!themeConfig.sidebar && 'hidden') || ''} fixed inset-0 bg-[black]/60 z-40 lg:hidden cursor-pointer`}
                    onClick={() => dispatch(toggleSidebar())}
                    onKeyDown={(e) => e.key === 'Enter' && dispatch(toggleSidebar())}
                    aria-label="Close menu"
                />
                <div className="fixed bottom-6 ltr:right-6 rtl:left-6 z-50">
                    {showTopButton && (
                        <button type="button" className="btn btn-outline-primary rounded-full p-2 animate-pulse bg-[#f8f6f4] dark:bg-[#0f0d0b] dark:hover:bg-primary" onClick={goToTop}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7l4-4m0 0l4 4m-4-4v18" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* BEGIN APP SETTING LAUNCHER */}
                <Setting />
                {/* END APP SETTING LAUNCHER */}

                <div
                    className={`${themeConfig.navbar} main-container text-black dark:text-white-dark min-h-screen${isFacesheet ? ' facesheet-shell' : ''}`}
                >
                    {/* BEGIN SIDEBAR */}
                    {isFacesheet ? <FacesheetSidebar /> : <Sidebar />}
                    {/* END SIDEBAR */}

                    <div
                        className={`main-content flex flex-col ${
                            isSymptomAssessmentPage || isFullViewportPage
                                ? 'h-screen overflow-hidden'
                                : isFacesheet
                                  ? 'h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden'
                                  : 'h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden'
                        }`}
                    >
                        {/* BEGIN TOP NAVBAR */}
                        <div className="shrink-0">
                            <Header />
                        </div>
                        {/* END TOP NAVBAR */}

                        {/* BEGIN CONTENT AREA */}
                        <Suspense>
                            <div
                                className={`flex min-w-0 flex-1 flex-col ${
                                    isSymptomAssessmentPage || isFullViewportPage
                                        ? 'min-h-0 h-full overflow-hidden'
                                        : isFacesheet
                                          ? 'min-h-0 overflow-x-hidden overflow-y-hidden'
                                          : isPatientListPage || isBedBoardPage || isAppointmentsListPage || isIpdDashboardPage
                                            ? 'min-h-0 overflow-x-hidden overflow-y-hidden'
                                            : 'min-h-0 overflow-y-auto overflow-x-hidden'
                                } ${
                                    isSymptomAssessmentPage
                                        ? 'py-4 sm:py-6 ltr:pl-4 ltr:pr-6 rtl:pr-4 rtl:pl-6'
                                        : isFacesheet
                                          ? 'p-2 sm:p-3 lg:p-4'
                                          : isBedBoardPage || isAppointmentsListPage || isIpdDashboardPage
                                            ? 'p-4 sm:p-5'
                                            : 'p-6'
                                }`}
                            >
                                {isFacesheet || isPatientListPage || isBedBoardPage || isAppointmentsListPage || isIpdDashboardPage ? (
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
                                ) : (
                                    children
                                )}
                            </div>
                        </Suspense>
                        {/* END CONTENT AREA */}

                        {/* BEGIN FOOTER */}
                        {!isFacesheet && <Footer />}
                        {/* END FOOTER */}
                        <Portals />
                    </div>
                </div>
            </div>
        </App>
    );
}

const DefaultLayout = ({ children }: PropsWithChildren) => (
    <AppLayoutProvider>
        <DefaultLayoutInner>{children}</DefaultLayoutInner>
    </AppLayoutProvider>
);

export default DefaultLayout;
