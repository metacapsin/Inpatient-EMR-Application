import { PropsWithChildren, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState, AppDispatch } from './store';
import { toggleRTL, toggleTheme, toggleLocale, toggleMenu, toggleLayout, toggleAnimation, toggleNavbar, toggleSemidark } from './store/themeConfigSlice';
import { fetchCloudSubscriptions, checkTokenExpiration } from './store/authSlice';
import store from './store';

function App({ children }: PropsWithChildren) {
    const themeConfig = useSelector((state: IRootState) => state.themeConfig);
    const token = useSelector((state: IRootState) => state.auth.token);
    const dispatch = useDispatch<AppDispatch>();
    const [steps, setSteps] = useState(0);
    useEffect(() => {
        dispatch(toggleTheme(localStorage.getItem('theme') || themeConfig.theme));
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
    useEffect(() => {
        function onDeviceReady() {
          if (window.pedometer) {
            window.pedometer.startPedometerUpdates(
              (data) => {
                console.log("Steps:", data.numberOfSteps);
                setSteps(data.numberOfSteps);
              },
              (error) => {
                console.error(error);
              }
            );
          } else {
            console.log("Pedometer plugin not available");
          }
        }
    
        document.addEventListener("deviceready", onDeviceReady);
    
        return () => {
          document.removeEventListener("deviceready", onDeviceReady);
        };
      }, []);
    return (
        <div
            className={`${(store.getState().themeConfig.sidebar && 'toggle-sidebar') || ''} ${themeConfig.menu} ${themeConfig.layout} ${
                themeConfig.rtlClass
            } main-section antialiased relative font-nunito text-sm font-normal`}
        >
            {children}
            <p>Steps: {steps}</p>
        </div>
    );
}

export default App;
