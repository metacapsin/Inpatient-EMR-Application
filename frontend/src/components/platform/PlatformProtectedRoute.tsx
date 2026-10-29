import React from 'react';
import { Navigate } from 'react-router-dom';
import { getPlatformToken } from '../../services/platformApi';

/** Gates Super Admin Console routes on the platform JWT — never the tenant one (see platformApi.ts). */
const PlatformProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = getPlatformToken();
  return token ? <>{children}</> : <Navigate to="/platform/login" replace />;
};

export default PlatformProtectedRoute;
