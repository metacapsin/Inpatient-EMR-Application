import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { IRootState } from "../../store";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useSelector((state: IRootState) => state.auth.token);
  const loading = useSelector((state: IRootState) => state.auth.loading);

  if (loading) {
    // Optionally, render a loading spinner or placeholder while auth state is being resolved
    return <div>Loading...</div>;
  }

  // If no token and not loading, redirect to login
  return token ? <>{children}</> : <Navigate to="/" replace />;
};

export default ProtectedRoute;

