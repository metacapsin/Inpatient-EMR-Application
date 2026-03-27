import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { IRootState } from '../../store';
import { setPremiumSubscription } from '../../store/authSlice';
import { patientSubscriptionAPI } from '../../services/api';
import StripeEmbeddedCheckout from '../../components/subscription/StripeEmbeddedCheckout';
import { BYPASS_STRIPE_SUBSCRIPTION } from '../../config/subscription';
import type { PremiumPlan, SubscriptionResponse } from '../../types/premium';
import { format } from 'date-fns';
import {
    CreditCard,
    Lock,
    Check,
    Sparkles,
    Users,
    Heart,
    FileText,
    Shield,
    Zap,
} from 'lucide-react';

const PLAN_ICONS: Record<string, React.ReactNode> = {
    basic: <FileText className="w-5 h-5" />,
    premium: <Sparkles className="w-5 h-5" />,
    family: <Users className="w-5 h-5" />,
};

const SubscriptionPage: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const premiumSubscription = useSelector((state: IRootState) => state.auth.premiumSubscription);
    const patientData = useSelector((state: IRootState) => state.auth.patientData);

    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
    const [managingPortal, setManagingPortal] = useState(false);
    const [subscriptionData, setSubscriptionData] = useState<SubscriptionResponse | null>(null);
    const [loadingSubscription, setLoadingSubscription] = useState(true);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [selectedPlanName, setSelectedPlanName] = useState<string>('');

    const patient = patientData?.data ?? patientData;
    const patientId = patient?._id ?? patient?.patientId ?? patient?.id;

    const isActive = premiumSubscription?.active === true || (subscriptionData !== null && subscriptionData !== undefined);
    const currentPlanName = subscriptionData?.plan?.name ?? premiumSubscription?.planName ?? 'Premium';
    const currentPeriodEnd = subscriptionData?.endDate ?? premiumSubscription?.currentPeriodEnd;
    const membersCount = subscriptionData?.members?.length ?? 0;

    useEffect(() => {
        if (!patientId) {
            setLoadingSubscription(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await patientSubscriptionAPI.getSubscription(patientId);
                if (cancelled) return;
                const data = res.data?.data;
                if (data) {
                    setSubscriptionData(data);
                    dispatch(setPremiumSubscription({
                        active: true,
                        planName: data.plan?.name,
                        planId: data.plan?.id,
                        status: 'active',
                        currentPeriodEnd: data.endDate,
                        membersCount: data.members?.length,
                    }));
                } else {
                    setSubscriptionData(null);
                }
            } catch (err: unknown) {
                if (cancelled) return;
                const axiosErr = err as { response?: { status?: number } };
                if (axiosErr?.response?.status === 404) {
                    setSubscriptionData(null);
                } else {
                    toast.error('Failed to load subscription');
                }
            } finally {
                if (!cancelled) setLoadingSubscription(false);
            }
        })();
        return () => { cancelled = true; };
    }, [patientId, dispatch]);

    const [apiPlans, setApiPlans] = useState<PremiumPlan[]>([]);
    useEffect(() => {
        if (subscriptionData) return;
        patientSubscriptionAPI.getPlans().then((res) => {
            const data = res.data?.data;
            if (Array.isArray(data) && data.length > 0) {
                setApiPlans(data.map((p: Record<string, unknown>) => ({
                    id: String(p.id),
                    name: String(p.name),
                    description: String(p.description || ''),
                    priceMonthly: Number(p.monthlyPrice) || 0,
                    priceYearly: Number(p.annuallyPrice) || 0,
                    features: Array.isArray(p.features) ? p.features.map(String) : [],
                    popular: p.id === 'premium',
                    numberOfMembers: Number(p.numberOfMembers) || 1,
                })));
            }
        }).catch(() => {});
    }, [subscriptionData]);

    const PLANS: PremiumPlan[] = apiPlans.length > 0 ? apiPlans : [
        { id: 'basic', name: 'Basic', description: 'Essential access to your health records', priceMonthly: 9.99, priceYearly: 99, features: ['View vitals & demographics', 'Appointments scheduling', 'Basic document access', 'Email support'], popular: false, numberOfMembers: 1 },
        { id: 'premium', name: 'Premium', description: 'Full access to all patient portal features', priceMonthly: 19.99, priceYearly: 199, features: ['Everything in Basic', 'Labs, prescriptions & medications', 'Immunizations & screenings', 'Priority support', 'Download documents'], popular: true, numberOfMembers: 1 },
        { id: 'family', name: 'Family', description: 'Manage health for your whole family', priceMonthly: 29.99, priceYearly: 299, features: ['Everything in Premium', 'Up to 5 family members', 'Shared health dashboard', '24/7 support'], popular: false, numberOfMembers: 5 },
    ];

    const handleSubscribe = async (plan: PremiumPlan) => {
        if (!patientId) {
            toast.error('Please log in to subscribe');
            return;
        }
        if (BYPASS_STRIPE_SUBSCRIPTION) {
            dispatch(setPremiumSubscription({
                active: true,
                planName: plan.name,
                planId: plan.id,
                status: 'active',
            }));
            toast.success('Welcome! Taking you to the dashboard.');
            navigate('/app/dashboard', { replace: true });
            return;
        }
        setLoadingPlanId(plan.id);
        setSelectedPlanName(plan.name);
        try {
            const baseUrl = window.location.origin;
            const res = await patientSubscriptionAPI.createCheckoutSession({
                patientId: String(patientId),
                planId: plan.id,
                billingCycle,
                embedded: true,
                successUrl: `${baseUrl}/app/subscription/success`,
                cancelUrl: `${baseUrl}/app/subscription`,
            });
            const secret = res.data?.data?.clientSecret;
            if (secret) {
                setClientSecret(secret);
                return;
            }
            const url = res.data?.data?.url;
            if (url) {
                window.location.href = url;
                return;
            }
            toast.error('Could not start checkout');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg || 'Something went wrong');
        } finally {
            setLoadingPlanId(null);
        }
    };

    const handleCheckoutSuccess = async () => {
        setClientSecret(null);
        if (!patientId) return;
        try {
            const res = await patientSubscriptionAPI.getSubscription(patientId);
            const data = res.data?.data;
            if (data) {
                setSubscriptionData(data);
                dispatch(setPremiumSubscription({
                    active: true,
                    planName: data.plan?.name,
                    planId: data.plan?.id,
                    status: 'active',
                    currentPeriodEnd: data.endDate,
                    membersCount: data.members?.length,
                }));
            }
            toast.success('Subscription activated!');
            navigate('/app/dashboard', { replace: true });
        } catch {
            dispatch(setPremiumSubscription({
                active: true,
                planName: selectedPlanName,
                planId: PLANS.find((p) => p.name === selectedPlanName)?.id,
                status: 'active',
            }));
            toast.success('Payment successful! Taking you to the dashboard.');
            navigate('/app/dashboard', { replace: true });
        }
    };

    const handleManageSubscription = async () => {
        setManagingPortal(true);
        try {
            toast.info('Subscription management can be enabled with Stripe Customer Portal.');
        } finally {
            setManagingPortal(false);
        }
    };

    const handleChangePlan = () => {
        dispatch(setPremiumSubscription(null));
        setSubscriptionData(null);
        toast.info('Select a new plan below');
    };

    if (loadingSubscription) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-10 w-10 text-primary" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-gray-600 dark:text-gray-400">Loading subscription...</p>
                </div>
            </div>
        );
    }

    if (clientSecret) {
        return (
            <StripeEmbeddedCheckout
                clientSecret={clientSecret}
                onClose={() => setClientSecret(null)}
                onSuccess={handleCheckoutSuccess}
                planName={selectedPlanName || 'Subscription'}
            />
        );
    }

    return (
        <div className="h-screen min-h-screen relative overflow-hidden flex flex-col">
            <div className="fixed inset-0 bg-gradient-to-br from-primary-50/90 via-white to-primary-100/60 dark:from-black dark:via-primary-950/40 dark:to-primary-900/30 -z-10" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(151,112,79,0.12)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_right,_rgba(151,112,79,0.08)_0%,_transparent_50%)] -z-10" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(151,112,79,0.1)_0%,_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_bottom_left,_rgba(151,112,79,0.06)_0%,_transparent_50%)] -z-10" />
            <div className="fixed top-20 left-10 w-48 sm:w-72 h-48 sm:h-72 bg-primary/5 rounded-full blur-3xl animate-pulse -z-10" />
            <div className="fixed bottom-20 right-10 w-64 sm:w-96 h-64 sm:h-96 bg-primary/5 rounded-full blur-3xl animate-pulse -z-10" style={{ animationDelay: '1s' }} />

            <div className="relative max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="text-center mb-6 sm:mb-10 animate-fade-in-up">
                    <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-primary-700 text-white shadow-primary/30 shadow-xl mb-4 sm:mb-6 ring-4 ring-primary/20">
                        <CreditCard className="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-2 sm:mb-3 tracking-tight px-2">
                        {isActive ? 'Your Subscription' : 'Choose Your Plan'}
                    </h1>
                    <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto px-2">
                        {isActive ? 'Manage your subscription and billing' : 'Get full access to your patient portal.'}
                    </p>
                </div>

                {isActive ? (
                    <div className="max-w-2xl mx-auto animate-fade-in-up px-2 sm:px-0">
                        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-primary-200/60 dark:border-primary-800/60 bg-white/90 dark:bg-black/90 backdrop-blur-xl shadow-2xl shadow-primary/10">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                            <div className="relative p-5 sm:p-8 lg:p-10">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 flex items-center justify-center text-primary shrink-0">
                                        <Sparkles className="w-7 h-7 sm:w-8 sm:h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{currentPlanName} Plan</h2>
                                        <span className="inline-flex items-center gap-1.5 mt-2 px-4 py-1.5 rounded-full text-sm font-semibold bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-400">
                                            <Shield className="w-4 h-4" /> Active
                                        </span>
                                        {membersCount > 0 && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{membersCount} family member{membersCount !== 1 ? 's' : ''}</p>
                                        )}
                                    </div>
                                </div>

                                {currentPeriodEnd && (
                                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                                        Next billing: <span className="font-bold text-gray-900 dark:text-white">{format(new Date(currentPeriodEnd), 'MMMM d, yyyy')}</span>
                                    </p>
                                )}

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button type="button" onClick={handleManageSubscription} disabled={managingPortal} className="btn btn-primary flex-1 py-3 sm:py-3.5 rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all text-sm sm:text-base">
                                        {managingPortal ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Opening portal...</span> : 'Manage Subscription'}
                                    </button>
                                    <button type="button" onClick={handleChangePlan} className="btn btn-outline-primary flex-1 py-3 sm:py-3.5 rounded-xl font-semibold hover:bg-primary/5 transition-all text-sm sm:text-base">
                                        Change Plan
                                    </button>
                                </div>

                                <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">Update payment methods or change your plan via Stripe Customer Portal when configured.</p>
                            </div>
                        </div>

                        <div className="mt-8 text-center">
                            <button type="button" onClick={() => navigate('/app/dashboard')} className="text-primary hover:text-primary-700 font-semibold hover:underline transition-colors">
                                ← Back to Dashboard
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-center mb-5 sm:mb-8 px-2 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                            <div className="inline-flex p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-white/90 dark:bg-black/90 border-2 border-primary-200/60 dark:border-primary-800/60 shadow-lg shadow-primary/10 backdrop-blur-sm w-full sm:w-auto max-w-xs sm:max-w-none">
                                <button type="button" onClick={() => setBillingCycle('monthly')} className={`flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${billingCycle === 'monthly' ? 'bg-primary text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                                    Monthly
                                </button>
                                <button type="button" onClick={() => setBillingCycle('yearly')} className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${billingCycle === 'yearly' ? 'bg-primary text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                                    <span>Yearly</span>
                                    <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap ${billingCycle === 'yearly' ? 'bg-white/25 text-white' : 'bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary-200'}`}>Save 17%</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 lg:gap-6">
                            {PLANS.map((plan, index) => (
                                <div key={plan.id} className={`group relative animate-fade-in-up ${plan.popular ? 'lg:-mt-2 lg:mb-2' : ''}`} style={{ animationDelay: `${0.2 + index * 0.1}s` }}>
                                    <div className={`h-full relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/25 hover:border-primary-300/80 active:translate-y-0 active:scale-[0.99] ${plan.popular ? 'border-primary bg-gradient-to-b from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 shadow-xl shadow-primary/20 scale-[1.02] lg:scale-[1.03]' : 'border-primary-200/50 dark:border-primary-900/50 bg-white/90 dark:bg-black/90 hover:border-primary-400 dark:hover:border-primary-600 shadow-lg'} backdrop-blur-sm`}>
                                        {plan.popular && <div className="absolute top-0 left-0 right-0 py-2 sm:py-2.5 bg-gradient-to-r from-primary to-primary-700 text-white text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider">Most Popular</div>}
                                        <div className={`p-4 sm:p-6 lg:p-8 flex flex-col min-h-[400px] sm:min-h-[420px] ${plan.popular ? 'pt-12 sm:pt-14' : ''}`}>
                                            <div className={`flex items-start sm:items-center gap-3 mb-3 sm:mb-4 ${plan.popular ? 'mt-5' : ''}`}>
                                                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/15 dark:bg-primary/25 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shrink-0">
                                                    {PLAN_ICONS[plan.id] || <Heart className="w-5 h-5" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                                                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{plan.description}</p>
                                                </div>
                                            </div>
                                            <div className="mb-4 sm:mb-6">
                                                <span className="text-3xl sm:text-4xl font-extrabold text-primary">${billingCycle === 'monthly' ? plan.priceMonthly.toFixed(2) : plan.priceYearly.toFixed(0)}</span>
                                                <span className="text-gray-500 dark:text-gray-400 ml-1 font-medium text-sm sm:text-base">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                                            </div>
                                            <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8 flex-1">
                                                {plan.features.map((feature, i) => (
                                                    <li key={i} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                                                        <span className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5"><Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" /></span>
                                                        <span>{feature}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <button type="button" onClick={() => handleSubscribe(plan)} disabled={loadingPlanId !== null} className={`btn w-full py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all mt-auto ${plan.popular ? 'btn-primary shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40' : 'btn-outline-primary hover:bg-primary/5 hover:text-primary'}`}>
                                                {loadingPlanId === plan.id ? (<><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Processing...</>) : (<><Zap className="w-5 h-5" />Subscribe Now</>)}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p className="text-center mt-4 sm:mt-6 text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2 animate-fade-in-up px-2" style={{ animationDelay: '0.5s' }}>
                            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            Cancel anytime.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default SubscriptionPage;
