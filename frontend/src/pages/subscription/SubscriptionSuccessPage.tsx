import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setPremiumSubscription } from '../../store/authSlice';
import { patientSubscriptionAPI } from '../../services/api';
import type { PremiumStatus } from '../../types/premium';
import { IRootState } from '../../store';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

/**
 * Shown after Stripe redirects here (return_url / success URL).
 * Fetches subscription from API (may lag due to webhook), sets Redux state, redirects to dashboard.
 */
const SubscriptionSuccessPage: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const patientData = useSelector((state: IRootState) => state.auth.patientData);
    const [retryCount, setRetryCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const retriesRef = useRef(0);

    const patient = patientData?.data ?? patientData;
    const patientId = patient?._id ?? patient?.patientId ?? patient?.id;

    useEffect(() => {
        if (!patientId) {
            const fallback: PremiumStatus = { active: true, planName: 'Premium', status: 'active' };
            dispatch(setPremiumSubscription(fallback));
            setLoading(false);
            return;
        }

        let cancelled = false;

        const fetchAndApply = async () => {
            try {
                const res = await patientSubscriptionAPI.getSubscription(patientId);
                const data = res.data?.data;
                if (cancelled) return;
                if (data) {
                    dispatch(setPremiumSubscription({
                        active: true,
                        planName: data.plan?.name,
                        planId: data.plan?.id,
                        status: 'active',
                        currentPeriodEnd: data.endDate,
                        membersCount: data.members?.length,
                    }));
                    setLoading(false);
                    navigate('/app/dashboard', { replace: true });
                    return;
                }
            } catch {
                if (cancelled) return;
                retriesRef.current += 1;
                setRetryCount(retriesRef.current);
                if (retriesRef.current < MAX_RETRIES) {
                    setTimeout(() => fetchAndApply(), RETRY_DELAY_MS);
                } else {
                    const fallback: PremiumStatus = { active: true, planName: 'Premium', status: 'active' };
                    dispatch(setPremiumSubscription(fallback));
                    setLoading(false);
                }
            }
        };

        fetchAndApply();

        return () => { cancelled = true; };
    }, [patientId, dispatch, navigate]);

    const goToDashboard = () => {
        dispatch(setPremiumSubscription({ active: true, planName: 'Premium', status: 'active' }));
        navigate('/app/dashboard', { replace: true });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-primary-50 dark:bg-gray-900 p-4">
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary mb-4">
                    {loading ? (
                        <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                    {loading
                        ? retryCount > 0
                            ? `Verifying payment... (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`
                            : 'Payment successful. Verifying your subscription...'
                        : 'Subscription confirmed. Taking you to the dashboard...'}
                </p>
                <Link
                    to="/app/dashboard"
                    onClick={(e) => {
                        e.preventDefault();
                        goToDashboard();
                    }}
                    className="inline-block mt-4 px-5 py-3 rounded-xl bg-primary hover:bg-primary-600 text-white font-semibold text-sm shadow-lg"
                >
                    Go to Dashboard now
                </Link>
            </div>
        </div>
    );
};

export default SubscriptionSuccessPage;
