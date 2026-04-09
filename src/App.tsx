import { PropsWithChildren, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState, AppDispatch } from './store';
import { toggleRTL, toggleTheme, toggleLocale, toggleMenu, toggleLayout, toggleAnimation, toggleNavbar, toggleSemidark } from './store/themeConfigSlice';
import { fetchCloudSubscriptions, checkTokenExpiration, hydrateStaffSession } from './store/authSlice';
import store from './store';

function App({ children }: PropsWithChildren) {
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const token = useSelector((state: IRootState) => state.auth.token);
    const role = useSelector((state: IRootState) => state.auth.role);
    const user = useSelector((state: IRootState) => state.auth.user);
    const dispatch = useDispatch<AppDispatch>();
    const staffHydrateStarted = useRef(false);
    useEffect(() => {
        dispatch(toggleTheme(localStorage.getItem('theme') || themeConfig.theme || 'light'));
        dispatch(toggleMenu(localStorage.getItem('menu') || themeConfig.menu));
        dispatch(toggleLayout(localStorage.getItem('layout') || themeConfig.layout));
        dispatch(toggleRTL(localStorage.getItem('rtlClass') || themeConfig.rtlClass));
        dispatch(toggleAnimation(localStorage.getItem('animation') || themeConfig.animation));
        dispatch(toggleNavbar(localStorage.getItem('navbar') || themeConfig.navbar));
        dispatch(toggleLocale(localStorage.getItem('i18nextLng') || themeConfig.locale));
        dispatch(toggleSemidark(localStorage.getItem('semidark') || themeConfig.semidark));
    }, [dispatch, themeConfig.theme, themeConfig.menu, themeConfig.layout, themeConfig.rtlClass, themeConfig.animation, themeConfig.navbar, themeConfig.locale, themeConfig.semidark]);

    // Check token expiration and fetch cloud subscriptions on mount
    useEffect(() => {
        if (token) {
            dispatch(checkTokenExpiration());
            dispatch(fetchCloudSubscriptions());
        }
    }, [dispatch, token]);

    /** Login only returns JWTs; load `/Users/getUserProfile` once when role is missing (e.g. page refresh). */
    useEffect(() => {
        if (!token) {
            staffHydrateStarted.current = false;
            return;
        }
        const hasRole =
            Boolean(role && String(role).trim()) ||
            (user?.role != null && String(user.role).trim() !== '');
        if (hasRole || staffHydrateStarted.current) return;
        staffHydrateStarted.current = true;
        void dispatch(hydrateStaffSession());
    }, [dispatch, token, role, user]);

    return (
        <div
            className={`${(store.getState().themeConfig.sidebar && 'toggle-sidebar') || ''} ${themeConfig.menu} ${themeConfig.layout} ${
                themeConfig.rtlClass
            } main-section antialiased relative font-nunito text-sm font-normal`}
        >
            {children}
        </div>
    );
}

export default App;
