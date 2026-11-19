import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { IRootState } from "../../store";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useSelector((state: IRootState) => state.auth.token);
  const bootstrapped = useSelector((state: IRootState) => state.auth.bootstrapped);

  // The access token is never persisted across reloads (SEC-09), so a genuinely still-logged-in
  // user starts every page load with token === null until App.tsx's bootstrapAuth() silently
  // restores it from the httpOnly refresh cookie. Wait for that first attempt to resolve before
  // deciding to redirect — otherwise every reload would bounce straight to /login.
  if (!bootstrapped) {
    return <div>Loading...</div>;
  }

  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;

