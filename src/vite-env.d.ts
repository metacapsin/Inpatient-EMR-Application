/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_LINK_BASIC_MONTHLY?: string;
  readonly VITE_STRIPE_LINK_BASIC_YEARLY?: string;
  readonly VITE_STRIPE_LINK_PREMIUM_MONTHLY?: string;
  readonly VITE_STRIPE_LINK_PREMIUM_YEARLY?: string;
  readonly VITE_STRIPE_LINK_FAMILY_MONTHLY?: string;
  readonly VITE_STRIPE_LINK_FAMILY_YEARLY?: string;
  readonly VITE_STRIPE_DEMO_LINK?: string;
  /** When "true", skip Stripe: Subscribe Now goes straight to dashboard; routes are not gated by subscription. */
  readonly VITE_BYPASS_STRIPE_SUBSCRIPTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
