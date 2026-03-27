import React, { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '../../config/stripe';
import { X } from 'lucide-react';

type StripeEmbeddedCheckoutProps = {
  clientSecret: string;
  onClose: () => void;
  /** Called when payment completes successfully (Stripe onComplete). Use to set subscription and redirect to dashboard. */
  onSuccess?: () => void;
  planName?: string;
};

/**
 * Renders Stripe Embedded Checkout in a modal.
 * Supports cards (including international), UPI, and QR-based UPI when enabled in your Stripe account.
 * Backend must create the Checkout Session with ui_mode: 'embedded' and return clientSecret.
 */
const StripeEmbeddedCheckout: React.FC<StripeEmbeddedCheckoutProps> = ({
  clientSecret,
  onClose,
  onSuccess,
  planName = 'Subscription',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!STRIPE_PUBLISHABLE_KEY || !clientSecret || !containerRef.current) {
      setError('Stripe is not configured or missing client secret.');
      return;
    }

    let mountedCheckout: { destroy?: () => void } | null = null;

    const init = async () => {
      try {
        if (!STRIPE_PUBLISHABLE_KEY) {
          setError('Stripe publishable key is missing.');
          return;
        }
        const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY as string);
        if (!stripe) {
          setError('Failed to load Stripe.');
          return;
        }

        const embeddedCheckout = await stripe.initEmbeddedCheckout({
          clientSecret,
          onComplete: () => {
            // Parent will unmount and navigate; avoid destroying here in case Stripe expects sync return
            onSuccessRef.current?.();
          },
        });

        if (!containerRef.current) return;

        embeddedCheckout.mount(containerRef.current);
        mountedCheckout = embeddedCheckout;
        setMounted(true);
      } catch (err: any) {
        setError(err?.message || 'Failed to load payment form.');
      }
    };

    init();

    return () => {
      if (mountedCheckout?.destroy) {
        try {
          mountedCheckout.destroy();
        } catch (_) {}
      }
    };
  }, [clientSecret]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-primary-50/95 dark:bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-[480px] max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl border-2 border-primary-200/60 dark:border-primary-800/60 bg-white/95 dark:bg-black/95 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden">
        {/* Decorative blob like subscription cards */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        {/* Header – same as subscription page card */}
        <div className="relative flex items-center justify-between shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-primary-200/60 dark:border-primary-800/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 flex items-center justify-center text-primary shrink-0">
              <span className="text-lg font-bold">$</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Complete payment
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{planName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative px-3 sm:px-4 py-2.5 text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400 border-b border-primary-200/50 dark:border-primary-800/50 bg-primary-50/30 dark:bg-primary-950/20">
          Cards, UPI, and more • Secure payment by Stripe
        </div>

        {/* Always-visible escape: if Stripe shows success but onComplete never fires, user can click this */}
        {onSuccess && (
          <div className="shrink-0 px-4 py-3 border-t border-primary-200/50 dark:border-primary-800/50 bg-primary-50/20 dark:bg-primary-950/30 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Payment done? Continue to your dashboard</p>
            <button
              type="button"
              onClick={() => onSuccess()}
              className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-600 text-white font-semibold text-sm shadow-lg shadow-primary/20 transition-all"
            >
              Continue to Dashboard
            </button>
          </div>
        )}

        <div className="relative flex-1 min-h-[360px] overflow-auto p-4 sm:p-5 bg-white dark:bg-gray-900/30">
          {error ? (
            <div className="flex flex-col items-center justify-center min-h-[320px] text-center">
              <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 px-5 py-3 rounded-xl bg-primary hover:bg-primary-600 text-white font-semibold shadow-lg shadow-primary/25 transition-all"
              >
                Close
              </button>
            </div>
          ) : !mounted ? (
            <div className="flex flex-col items-center justify-center min-h-[320px]">
              <svg
                className="animate-spin h-10 w-10 text-primary"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Loading payment form...
              </p>
            </div>
          ) : null}
          <div
            ref={containerRef}
            className={error || !mounted ? 'hidden' : ''}
            id="stripe-embedded-checkout"
          />
        </div>
      </div>
    </div>
  );
};

export default StripeEmbeddedCheckout;
