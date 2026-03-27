// Premium subscription types (for Stripe-based patient portal premium)

export interface PremiumStatus {
    active: boolean;
    status?: string;
    currentPeriodEnd?: string;
    planId?: string;
    planName?: string;
    membersCount?: number;
}

export interface PremiumPlan {
    id: string;
    name: string;
    description: string;
    priceIdMonthly?: string;
    priceIdYearly?: string;
    priceMonthly: number;
    priceYearly: number;
    features: string[];
    popular?: boolean;
    numberOfMembers?: number;
}

export interface SubscriptionMember {
    patientId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    dob?: string;
}

export interface SubscriptionPayment {
    id: string;
    reference: string;
    amount: number;
    status: string;
}

export interface SubscriptionPlanInfo {
    id: string;
    name: string;
    description: string;
    annuallyPrice: number;
    monthlyPrice: number;
    numberOfMembers: number;
}

export interface SubscriptionResponse {
    tenantId: string;
    patientId: string;
    subscriptionId: string;
    members: SubscriptionMember[];
    startDate: string;
    endDate: string;
    frequency: 'monthly' | 'yearly';
    patient: Record<string, unknown> | null;
    plan: SubscriptionPlanInfo | null;
    payments: SubscriptionPayment[];
}

export interface CreateCheckoutSessionRequest {
    priceId?: string;
    planId?: string;
    billingCycle?: string;
    embedded?: boolean;
    successUrl?: string;
    cancelUrl?: string;
    patientId?: string;
}

export interface CreateCheckoutSessionResponse {
    url?: string;
    clientSecret?: string;
    sessionId?: string;
}

export interface CreatePortalSessionRequest {
    returnUrl?: string;
}

export interface CreatePortalSessionResponse {
    url: string;
}
