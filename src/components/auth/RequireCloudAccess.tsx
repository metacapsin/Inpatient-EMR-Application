import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { IRootState } from '../../store';

interface RequireCloudAccessProps {
  children: React.ReactNode;
  requiredCloudProvider?: 'azure' | 'aws' | 'gcp';
  fallbackPath?: string;
}

const RequireCloudAccess: React.FC<RequireCloudAccessProps> = ({ 
  children, 
  requiredCloudProvider,
  fallbackPath = '/app/dashboard'
}) => {
  const cloudSubscriptions = useSelector((state: IRootState) => state.auth.cloudSubscriptions);
  const loading = useSelector((state: IRootState) => state.auth.loading);
  const location = useLocation();

  // Show loading state while fetching cloud subscriptions
  if (loading || !cloudSubscriptions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no specific cloud provider is required, just check if user has any cloud access
  if (!requiredCloudProvider) {
    const hasAnyCloudAccess = Object.values(cloudSubscriptions).some(Boolean);
    
    if (!hasAnyCloudAccess) {
      return <Navigate to={fallbackPath} state={{ from: location }} replace />;
    }
    
    return <>{children}</>;
  }

  // Check if user has access to the specific required cloud provider
  const hasRequiredAccess = cloudSubscriptions[requiredCloudProvider];

  if (!hasRequiredAccess) {
    // Redirect to dashboard with a message about missing access
    return <Navigate to={fallbackPath} state={{ 
      from: location, 
      message: `You don't have access to ${requiredCloudProvider.toUpperCase()} services. Please contact your administrator.` 
    }} replace />;
  }

  return <>{children}</>;
};

export default RequireCloudAccess;

