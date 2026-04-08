import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Perfect Scrollbar
import 'react-perfect-scrollbar/dist/css/styles.css';

// Tailwind css
import './tailwind.css';

// i18n (needs to be bundled)
import './i18n';

// Router
import { RouterProvider } from 'react-router-dom';
import router from './router/index';

// Redux
import { Provider } from 'react-redux';
import store from './store/index';
import { registerAccessTokenSync, registerAuthClear } from './services/auth-events';
import { setToken, logout } from './store/authSlice';

registerAccessTokenSync((token) => {
    store.dispatch(setToken(token));
});
registerAuthClear(() => {
    store.dispatch(logout());
});
import { AdtLegacySessionMigration } from './components/adt/AdtLegacySessionMigration';

// Contexts
import { SettingsProvider } from './contexts/SettingsContext';
import { SidebarProvider } from './contexts/SidebarContext';

// Toast
import { Toaster } from 'sonner';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
    },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <Suspense>
            <QueryClientProvider client={queryClient}>
                <Provider store={store}>
                    <AdtLegacySessionMigration />
                    <SettingsProvider>
                        <SidebarProvider>
                            <RouterProvider router={router} />
                            <Toaster position="top-right" />
                            <ToastContainer position="top-right" />
                        </SidebarProvider>
                    </SettingsProvider>
                </Provider>
            </QueryClientProvider>
        </Suspense>
    </React.StrictMode>
);

