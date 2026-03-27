import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client'

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

// Contexts
import { SettingsProvider } from './contexts/SettingsContext';
import { SidebarProvider } from './contexts/SidebarContext';

// Toast
import { Toaster } from 'sonner';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <Suspense>
            <Provider store={store}>
                <SettingsProvider>
                    <SidebarProvider>
                        <RouterProvider router={router} />
                        <Toaster position="top-right" />
                        <ToastContainer position="top-right" />
                    </SidebarProvider>
                </SettingsProvider>
            </Provider>
        </Suspense>
    </React.StrictMode>
);

