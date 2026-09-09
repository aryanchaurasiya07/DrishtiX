import React from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthToken, getStoredRole } from '../api/client';
import { UserRole } from '../api/types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  children,
}) => {
  const token = getAuthToken();
  const role = getStoredRole();

  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect to their respective authorized dashboard
    return <Navigate to={`/${role}`} replace />;
  }

  return <>{children}</>;
};
