import { lazy } from 'react';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import RequireCloudAccess from '../components/auth/RequireCloudAccess';
import { ErrorBoundary } from '../components/ErrorBoundary';
import RequireSubscription from '../components/auth/RequireSubscription';

// Auth pages (BlankLayout)
const AuthPage = lazy(() => import('../pages/auth/AuthPage'));
const OTPPage = lazy(() => import('../pages/auth/OTPPage'));
const SignupPage = lazy(() => import('../pages/auth/SignupPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const ConfirmResetPasswordPage = lazy(() => import('../pages/auth/ConfirmResetPasswordPage'));

// Dashboard and main pages (DefaultLayout)
const Dashboard = lazy(() => import('../pages/Dashboard'));
const AIAssistantPage = lazy(() => import('../pages/AIAssistantPage'));

// Appointment pages
const AppointmentList = lazy(() => import('../pages/appointments/AppointmentList'));
const AddAppointment = lazy(() => import('../pages/appointments/AddAppointment'));
const AppointmentCalendarPage = lazy(() => import('../pages/appointments/AppointmentCalendarPage'));

// Patient pages
const Vitals = lazy(() => import('../pages/patient/Vitals'));
const Demographic = lazy(() => import('../pages/patient/Demographic'));
const History = lazy(() => import('../pages/patient/History'));
const Diagnoses = lazy(() => import('../pages/patient/Diagnoses'));
const Medications = lazy(() => import('../pages/patient/Medications'));
const Prescriptions = lazy(() => import('../pages/patient/Prescriptions'));
const Allergies = lazy(() => import('../pages/patient/Allergies'));
const Documents = lazy(() => import('../pages/patient/Documents'));
const Labs = lazy(() => import('../pages/patient/Labs'));
const LabOrders = lazy(() => import('../pages/patient/LabOrders'));
const Invoices = lazy(() => import('../pages/patient/Invoices'));
const Notes = lazy(() => import('../pages/patient/Notes'));
const Immunizations = lazy(() => import('../pages/patient/Immunizations'));
const PreventiveScreening = lazy(() => import('../pages/patient/PreventiveScreening'));
const Pharmacies = lazy(() => import('../pages/patient/Pharmacies'));
const PharmacyMessage = lazy(() => import('../pages/patient/PharmacyMessage'));
const PatientAssessment = lazy(() => import('../pages/patient/PatientAssessment'));
const HealthSummary = lazy(() => import('../pages/patient/HealthSummary'));
const DailyLog = lazy(() => import('../pages/patient/DailyLog'));
const HealthAlerts = lazy(() => import('../pages/patient/HealthAlerts'));
const HealthTrends = lazy(() => import('../pages/patient/HealthTrends'));

// Provider pages
const PatientRiskList = lazy(() => import('../pages/provider/PatientRiskList'));

// Azure pages
const ResourceActivities = lazy(() => import('../pages/azure/ResourceActivities'));
const ResourcesTable = lazy(() => import('../pages/azure/ResourcesTable'));
const CostAnalysis = lazy(() => import('../pages/azure/CostAnalysis'));
const AzureBudgets = lazy(() => import('../pages/azure/AzureBudgets'));
const BusinessUnits = lazy(() => import('../pages/azure/BusinessUnits'));

// AWS pages
const AwsCostAnalysis = lazy(() => import('../pages/aws/AwsCostAnalysis'));
const AwsResourceActivities = lazy(() => import('../pages/aws/AwsResourceActivities'));
const AwsResources = lazy(() => import('../pages/aws/AwsResources'));

// Reports pages
const Reports = lazy(() => import('../pages/reports/Reports'));
const ExecutiveCostSummary = lazy(() => import('../pages/reports/ExecutiveCostSummary'));
const ServiceWiseCostBreakdown = lazy(() => import('../pages/reports/ServiceWiseCostBreakdown'));
const BusinessUnitProjectCost = lazy(() => import('../pages/reports/BusinessUnitProjectCost'));
const MonthlyDailyComparison = lazy(() => import('../pages/reports/MonthlyDailyComparison'));
const ScheduleManagement = lazy(() => import('../pages/reports/ScheduleManagement'));

// Settings
const Settings = lazy(() => import('../pages/Settings'));

// Subscription
const SubscriptionPage = lazy(() => import('../pages/subscription/SubscriptionPage'));
const SubscriptionSuccessPage = lazy(() => import('../pages/subscription/SubscriptionSuccessPage'));

// Family (Family plan only)
const FamilyMembers = lazy(() => import('../pages/family/FamilyMembers'));
const Steps = lazy(() => import('../pages/patient/PatientSteps'));

const routes = [
    // Public routes (BlankLayout)
    {
        path: '/',
        element: <AuthPage />,
        layout: 'blank',
    },
    {
        path: '/otp',
        element: <OTPPage />,
        layout: 'blank',
    },
    {
        path: '/signup',
        element: <SignupPage />,
        layout: 'blank',
    },
    {
        path: '/forgot-password',
        element: <ResetPasswordPage />,
        layout: 'blank',
    },
    {
        path: '/reset-password',
        element: <ConfirmResetPasswordPage />,
        layout: 'blank',
    },

    // Subscription - full-screen (no sidebar/header), accessible without active subscription
    {
        path: '/app/subscription',
        element: (
            <ProtectedRoute>
                <SubscriptionPage />
            </ProtectedRoute>
        ),
        layout: 'blank',
    },
    // After Stripe payment: set Payment Link / return_url to this path; fetches status then redirects to dashboard
    {
        path: '/app/subscription/success',
        element: (
            <ProtectedRoute>
                <SubscriptionSuccessPage />
            </ProtectedRoute>
        ),
        layout: 'blank',
    },

    // Protected routes - require subscription
    {
        path: '/app/dashboard',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Dashboard />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/ai-assistant',
        element: (
            <ProtectedRoute>
                <AIAssistantPage />
            </ProtectedRoute>
        ),
        layout: 'default',
    },

    // Appointment routes
    {
        path: '/app/appointments',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <AppointmentList />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/appointments/add',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <AddAppointment />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/appointments/add/:id',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <AddAppointment />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/appointments/calendar',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <AppointmentCalendarPage />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },

    {
        path: '/app/vitals',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Vitals />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/demographic',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Demographic />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/history',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <History />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/diagnoses',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Diagnoses />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/medications',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Medications />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/prescriptions',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Prescriptions />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/allergies',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Allergies />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/documents',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Documents />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/labs',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Labs />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/lab-orders',
        element: (
            <ProtectedRoute>
                <LabOrders />
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    // {
    //     path: '/app/invoices',
    //     element: (
    //         <ProtectedRoute>
    //             <Invoices />
    //         </ProtectedRoute>
    //     ),
    //     layout: 'default',
    // },
    {
        path: '/app/notes',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Notes />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/immunizations',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Immunizations />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/preventive-screening',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <PreventiveScreening />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/pharmacies',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Pharmacies />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/pharmacy-message',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <PharmacyMessage />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/symptom-assessment',
        element: (
            <ProtectedRoute>
                <ErrorBoundary fallbackTitle="Assessment error" fallbackMessage="Something went wrong with the symptom assessment. Please try again or go back to the dashboard.">
                    <PatientAssessment />
                </ErrorBoundary>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/health-summary',
        element: (
            <ProtectedRoute>
                <HealthSummary />
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/daily-log',
        element: (
            <ProtectedRoute>
                <DailyLog />
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/health-alerts',
        element: (
            <ProtectedRoute>
                <HealthAlerts />
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/health-trends',
        element: (
            <ProtectedRoute>
                <HealthTrends />
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/provider/patient-risk-list',
        element: (
            <ProtectedRoute>
                <PatientRiskList />
            </ProtectedRoute>
        ),
        layout: 'default',
    },

    // Azure routes - Require Azure access
    {
        path: '/app/resourceActivities',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess requiredCloudProvider="azure">
                    <ResourceActivities />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/resourcestable',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess requiredCloudProvider="azure">
                    <ResourcesTable />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/costs',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess requiredCloudProvider="azure">
                    <CostAnalysis />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/budgets',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess requiredCloudProvider="azure">
                    <AzureBudgets />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/business-units',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess requiredCloudProvider="azure">
                    <BusinessUnits />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },

    // AWS routes - Require AWS access
    {
        path: '/app/aws/cost',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess requiredCloudProvider="aws">
                    <AwsCostAnalysis />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/aws/resourceActivities',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess requiredCloudProvider="aws">
                    <AwsResourceActivities />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/aws/resources',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess requiredCloudProvider="aws">
                    <AwsResources />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },

    // Reports routes - Require any cloud access
    {
        path: '/app/reports',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess>
                    <Reports />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/reports/executive-cost-summary',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess>
                    <ExecutiveCostSummary />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/reports/service-wise-cost-breakdown',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess>
                    <ServiceWiseCostBreakdown />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/reports/business-unit-project-cost',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess>
                    <BusinessUnitProjectCost />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/reports/monthly-daily-comparison',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess>
                    <MonthlyDailyComparison />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/reports/schedules',
        element: (
            <ProtectedRoute>
                <RequireCloudAccess>
                    <ScheduleManagement />
                </RequireCloudAccess>
            </ProtectedRoute>
        ),
        layout: 'default',
    },

    // Settings - No cloud access required
    {
        path: '/app/settings',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <Settings />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },

    // Family Members (Family plan feature)
    {
        path: '/app/family-members',
        element: (
            <ProtectedRoute>
                <RequireSubscription>
                    <FamilyMembers />
                </RequireSubscription>
            </ProtectedRoute>
        ),
        layout: 'default',
    },
    {
        path: '/app/patient-steps',
        element: (
            <ProtectedRoute>
                <Steps />
            </ProtectedRoute>
        ),
    },
];

export { routes };
