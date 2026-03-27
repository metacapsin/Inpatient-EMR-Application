import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { BYPASS_STRIPE_SUBSCRIPTION } from '../../config/subscription';
import { IRootState } from '../../store';

interface RequireSubscriptionProps {
    children: React.ReactNode;
    fallbackPath?: string;
}

/**
 * Gates protected content behind an active subscription (unless VITE_BYPASS_STRIPE_SUBSCRIPTION is enabled).
 * Redirects to /app/subscription if user has no active subscription.
 */
const RequireSubscription: React.FC<RequireSubscriptionProps> = ({
    children,
    fallbackPath = '/app/subscription',
}) => {
    const premiumSubscription = useSelector((state: IRootState) => state.auth.premiumSubscription);
    const location = useLocation();
    const isActive = premiumSubscription?.active === true;

    // if (!isActive) {
    //     return <Navigate to={fallbackPath} state={{ from: location }} replace />;
    // }
    // return <>{children}</>;

    if (BYPASS_STRIPE_SUBSCRIPTION || isActive) {
        return <>{children}</>;
    }

    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
};

export default RequireSubscription;
