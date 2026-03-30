import { lazy, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { ErrorBoundary } from '../components/ErrorBoundary';

const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const PatientList = lazy(() => import('../pages/patients/PatientList'));
const FacesheetPage = lazy(() => import('../pages/facesheet/FacesheetPage'));
const HealthMonitoring = lazy(() => import('../pages/patient/HealthSummary'));
const AppointmentList = lazy(() => import('../pages/appointments/AppointmentList'));
const AppointmentCalendarPage = lazy(() => import('../pages/appointments/AppointmentCalendarPage'));
const AddAppointment = lazy(() => import('../pages/appointments/AddAppointment'));
const Settings = lazy(() => import('../pages/Settings'));
const Demographic = lazy(() => import('../pages/patient/Demographic'));
const Vitals = lazy(() => import('../pages/patient/Vitals'));
const History = lazy(() => import('../pages/patient/History'));
const Diagnoses = lazy(() => import('../pages/patient/Diagnoses'));
const Medications = lazy(() => import('../pages/patient/Medications'));
const Prescriptions = lazy(() => import('../pages/patient/Prescriptions'));
const Allergies = lazy(() => import('../pages/patient/Allergies'));
const Documents = lazy(() => import('../pages/patient/Documents'));
const Labs = lazy(() => import('../pages/patient/Labs'));
const LabOrders = lazy(() => import('../pages/patient/LabOrders'));
const Notes = lazy(() => import('../pages/patient/Notes'));
const Immunizations = lazy(() => import('../pages/patient/Immunizations'));
const PreventiveScreening = lazy(() => import('../pages/patient/PreventiveScreening'));
const Pharmacies = lazy(() => import('../pages/patient/Pharmacies'));
const PharmacyMessage = lazy(() => import('../pages/patient/PharmacyMessage'));
const PatientAssessment = lazy(() => import('../pages/patient/PatientAssessment'));
const DailyLog = lazy(() => import('../pages/patient/DailyLog'));
const HealthAlerts = lazy(() => import('../pages/patient/HealthAlerts'));
const HealthTrends = lazy(() => import('../pages/patient/HealthTrends'));
const AIAssistantPage = lazy(() => import('../pages/AIAssistantPage'));
const SubscriptionPage = lazy(() => import('../pages/subscription/SubscriptionPage'));
const SubscriptionSuccessPage = lazy(() => import('../pages/subscription/SubscriptionSuccessPage'));

function guard(page: ReactNode) {
    return <ProtectedRoute>{page}</ProtectedRoute>;
}

const routes = [
    {
        path: '/',
        element: <Navigate to="/login" replace />,
        layout: 'blank' as const,
    },
    {
        path: '/app',
        element: <Navigate to="/app/dashboard" replace />,
        layout: 'blank' as const,
    },
    {
        path: '/login',
        element: <LoginPage />,
        layout: 'blank' as const,
    },
    {
        path: '/forgot-password',
        element: <ForgotPasswordPage />,
        layout: 'blank' as const,
    },
    {
        path: '/app/dashboard',
        element: guard(<Dashboard />),
        layout: 'default' as const,
    },
    {
        path: '/app/patients/list',
        element: guard(<PatientList />),
        layout: 'default' as const,
    },
    {
        path: '/app/health-monitoring',
        element: guard(<HealthMonitoring />),
        layout: 'default' as const,
    },
    {
        path: '/app/health-summary',
        element: guard(<Navigate to="/app/health-monitoring" replace />),
        layout: 'default' as const,
    },
    {
        path: '/app/ai-assistant',
        element: guard(<AIAssistantPage />),
        layout: 'default' as const,
    },
    {
        path: '/app/appointments',
        element: guard(<AppointmentList />),
        layout: 'default' as const,
    },
    {
        path: '/app/appointments/calendar',
        element: guard(<AppointmentCalendarPage />),
        layout: 'default' as const,
    },
    {
        path: '/app/appointments/add',
        element: guard(<AddAppointment />),
        layout: 'default' as const,
    },
    {
        path: '/app/settings',
        element: guard(<Settings />),
        layout: 'default' as const,
    },
    {
        path: '/app/facesheet',
        element: guard(<Navigate to="/app/patients/list" replace />),
        layout: 'default' as const,
    },
    {
        path: '/app/facesheet/:id/*',
        element: guard(<FacesheetPage />),
        layout: 'default' as const,
    },
    {
        path: '/app/demographic',
        element: guard(<Demographic />),
        layout: 'default' as const,
    },
    {
        path: '/app/vitals',
        element: guard(<Vitals />),
        layout: 'default' as const,
    },
    {
        path: '/app/history',
        element: guard(<History />),
        layout: 'default' as const,
    },
    {
        path: '/app/diagnoses',
        element: guard(<Diagnoses />),
        layout: 'default' as const,
    },
    {
        path: '/app/medications',
        element: guard(<Medications />),
        layout: 'default' as const,
    },
    {
        path: '/app/prescriptions',
        element: guard(<Prescriptions />),
        layout: 'default' as const,
    },
    {
        path: '/app/allergies',
        element: guard(<Allergies />),
        layout: 'default' as const,
    },
    {
        path: '/app/documents',
        element: guard(<Documents />),
        layout: 'default' as const,
    },
    {
        path: '/app/labs',
        element: guard(<Labs />),
        layout: 'default' as const,
    },
    {
        path: '/app/lab-orders',
        element: guard(<LabOrders />),
        layout: 'default' as const,
    },
    {
        path: '/app/notes',
        element: guard(<Notes />),
        layout: 'default' as const,
    },
    {
        path: '/app/immunizations',
        element: guard(<Immunizations />),
        layout: 'default' as const,
    },
    {
        path: '/app/preventive-screening',
        element: guard(<PreventiveScreening />),
        layout: 'default' as const,
    },
    {
        path: '/app/pharmacies',
        element: guard(<Pharmacies />),
        layout: 'default' as const,
    },
    {
        path: '/app/pharmacy-message',
        element: guard(<PharmacyMessage />),
        layout: 'default' as const,
    },
    {
        path: '/app/symptom-assessment',
        element: guard(
            <ErrorBoundary fallbackTitle="Assessment error" fallbackMessage="Something went wrong with the symptom assessment. Please try again or go back to the dashboard.">
                <PatientAssessment />
            </ErrorBoundary>
        ),
        layout: 'default' as const,
    },
    {
        path: '/app/daily-log',
        element: guard(<DailyLog />),
        layout: 'default' as const,
    },
    {
        path: '/app/health-alerts',
        element: guard(<HealthAlerts />),
        layout: 'default' as const,
    },
    {
        path: '/app/health-trends',
        element: guard(<HealthTrends />),
        layout: 'default' as const,
    },
    {
        path: '/app/subscription',
        element: guard(<SubscriptionPage />),
        layout: 'default' as const,
    },
    {
        path: '/app/subscription/success',
        element: guard(<SubscriptionSuccessPage />),
        layout: 'default' as const,
    },
];

export { routes };
