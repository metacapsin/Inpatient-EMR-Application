/**
 * Stripe configuration for subscription checkout.
 *
 * Option 1 - Backend API: Your backend creates Checkout Sessions and returns { url } or { clientSecret } for embedded.
 * Option 2 - Payment Links: Create Payment Links in Stripe Dashboard (test mode),
 *    add URLs to .env. In each Payment Link set "After payment" → Success URL to
 *    https://YOUR_DOMAIN/app/subscription/success so users are redirected to the dashboard.
 *
 * For embedded checkout (cards, UPI, QR): set VITE_STRIPE_PUBLISHABLE_KEY and ensure backend
 * creates sessions with ui_mode: 'embedded' and returns clientSecret when requested.
 */

export type PlanId = 'basic' | 'premium' | 'family';
export type BillingCycle = 'monthly' | 'yearly';

/** Publishable key for Stripe.js (embedded checkout). Get from Stripe Dashboard → Developers → API keys. */
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

const STRIPE_ENV = {
  // Payment Links from Stripe Dashboard (create in test mode)
  // Format: https://buy.stripe.com/test_xxxxx
  BASIC_MONTHLY: import.meta.env.VITE_STRIPE_LINK_BASIC_MONTHLY as string | undefined,
  BASIC_YEARLY: import.meta.env.VITE_STRIPE_LINK_BASIC_YEARLY as string | undefined,
  PREMIUM_MONTHLY: import.meta.env.VITE_STRIPE_LINK_PREMIUM_MONTHLY as string | undefined,
  PREMIUM_YEARLY: import.meta.env.VITE_STRIPE_LINK_PREMIUM_YEARLY as string | undefined,
  FAMILY_MONTHLY: import.meta.env.VITE_STRIPE_LINK_FAMILY_MONTHLY as string | undefined,
  FAMILY_YEARLY: import.meta.env.VITE_STRIPE_LINK_FAMILY_YEARLY as string | undefined,
  // Single demo link for quick testing (used when per-plan links not set)
  DEMO_LINK: import.meta.env.VITE_STRIPE_DEMO_LINK as string | undefined,
};

const PAYMENT_LINK_MAP: Record<PlanId, Record<BillingCycle, string | undefined>> = {
  basic: { monthly: STRIPE_ENV.BASIC_MONTHLY, yearly: STRIPE_ENV.BASIC_YEARLY },
  premium: { monthly: STRIPE_ENV.PREMIUM_MONTHLY, yearly: STRIPE_ENV.PREMIUM_YEARLY },
  family: { monthly: STRIPE_ENV.FAMILY_MONTHLY, yearly: STRIPE_ENV.FAMILY_YEARLY },
};

/**
 * Get Stripe Payment Link URL for a plan + billing cycle.
 * Falls back to VITE_STRIPE_DEMO_LINK if per-plan link not configured.
 */
export function getStripePaymentLink(planId: PlanId, billingCycle: BillingCycle): string | undefined {
  return PAYMENT_LINK_MAP[planId]?.[billingCycle] || STRIPE_ENV.DEMO_LINK;
}

/**
 * Check if any Stripe Payment Links are configured.
 */
export function hasStripePaymentLinks(): boolean {
  return !!(STRIPE_ENV.DEMO_LINK || Object.values(STRIPE_ENV).some(Boolean));
}
