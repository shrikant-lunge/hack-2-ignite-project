import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute Component
 * Checks if user is authenticated
 * If not authenticated: redirects to landing page
 * If authenticated but profile not complete: redirects to profile setup
 * If authenticated and profile complete: renders the component
 */
export function ProtectedRoute({ element, requireProfileComplete = false }) {
  const { isAuthenticated, isProfileComplete, loading, isBlocked } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is blocked, always redirect to blocked screen
  if (isBlocked) {
    return <Navigate to="/account-blocked" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireProfileComplete && !isProfileComplete) {
    return <Navigate to="/profile-setup" replace />;
  }

  return element;
}

export default ProtectedRoute;
