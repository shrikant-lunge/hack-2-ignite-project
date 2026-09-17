import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * AdminProtectedRoute
 * Checks for a valid admin session in localStorage.
 * Redirects to /admin-login if no session found.
 */
const AdminProtectedRoute = ({ children }) => {
  const isAdminAuthenticated = () => {
    try {
      const session = localStorage.getItem('adminSession');
      if (!session) return false;
      const parsed = JSON.parse(session);
      return !!parsed?.username;
    } catch {
      return false;
    }
  };

  if (!isAdminAuthenticated()) {
    return <Navigate to="/admin-login" replace />;
  }

  return children;
};

export default AdminProtectedRoute;
