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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
