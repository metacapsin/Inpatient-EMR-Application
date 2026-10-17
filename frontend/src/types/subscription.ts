export type SubscriptionType = 'aws' | 'azure' | 'combo' | 'custom';
export type UserRole = 'admin' | 'company_admin' | 'user';

export interface SubscriptionPlan {
    type: SubscriptionType;
    price: number;
    features: string[];
}

export interface SubscriptionTier {
    users: number;
    discount: number;
}

export interface CompanyRegistration {
    name: string;
    address: string;
    industry: string;
    email: string;
    password: string;
    subdomain?: string;
}

export interface CustomPlan {
    users: number;
    selectedServices: string[];
    totalPrice: number;
}

