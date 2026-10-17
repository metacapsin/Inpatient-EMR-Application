/**
 * When true, the subscription page skips Stripe: "Subscribe Now" marks the plan
 * as active in the client store and navigates to the dashboard.
 * Default is bypass ON (unset/empty env). Set `VITE_BYPASS_STRIPE_SUBSCRIPTION=false` in `.env` for real Stripe checkout.
 */
const raw = import.meta.env.VITE_BYPASS_STRIPE_SUBSCRIPTION;
export const BYPASS_STRIPE_SUBSCRIPTION =
    raw === undefined || raw === '' ? true : raw === 'true';
