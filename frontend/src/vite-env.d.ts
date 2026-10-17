/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** EMR API origin (no trailing slash), e.g. https://your-api.example.com — used by axios `api` client. */
  readonly VITE_EMR_API_BASE_URL?: string;
  readonly VITE_STRIPE_LINK_BASIC_MONTHLY?: string;
  readonly VITE_STRIPE_LINK_BASIC_YEARLY?: string;
  readonly VITE_STRIPE_LINK_PREMIUM_MONTHLY?: string;
  readonly VITE_STRIPE_LINK_PREMIUM_YEARLY?: string;
  readonly VITE_STRIPE_LINK_FAMILY_MONTHLY?: string;
  readonly VITE_STRIPE_LINK_FAMILY_YEARLY?: string;
  readonly VITE_STRIPE_DEMO_LINK?: string;
  /** When "true", skip Stripe: Subscribe Now goes straight to dashboard; routes are not gated by subscription. */
  readonly VITE_BYPASS_STRIPE_SUBSCRIPTION?: string;
  /** When "true", ward/room/bed use in-app mock data instead of Wards/Rooms/Beds HTTP APIs. */
  readonly VITE_USE_MOCK_FACILITY?: string;
  /** When not "false", medication management (MAR, PRN/STAT, dispense, discharge meds) uses in-memory mock APIs. Set to "false" to call EMR backend routes. */
  readonly VITE_MEDICATION_API_MOCK?: string;
  /** When not "false", staff scheduling uses in-memory mock APIs. */
  readonly VITE_STAFF_SCHEDULING_MOCK?: string;
  /** When not "false", live staffing dashboard uses in-memory mock with API fallback. */
  readonly VITE_STAFFING_API_MOCK?: string;
  /** When not "false", care plan uses in-memory mock with API fallback. */
  readonly VITE_CARE_PLAN_MOCK?: string;
  /** When "true", consent management and patient rights use in-memory mock APIs. */
  readonly VITE_USE_MOCK_API?: string;
  /** When not "false", intake/output tracking falls back to in-memory mock data. */
  readonly VITE_IO_MOCK?: string;
  /** When not "false", HAI events use mock data with API fallback. */
  readonly VITE_HAI_EVENT_MOCK?: string;
  /** When not "false", CDI queries and claim denials use the in-memory mock store. */
  readonly VITE_CDI_DENIAL_MOCK?: string;
  /** When not "false", radiology orders fall back to the in-memory mock. */
  readonly VITE_RADIOLOGY_MOCK?: string;
  /** When not "false", code events fall back to the in-memory mock. */
  readonly VITE_CODE_EVENT_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
