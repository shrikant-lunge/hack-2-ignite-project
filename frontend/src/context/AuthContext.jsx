import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import { getUserByUid } from '../utils/firebase';

// Create Auth Context
export const AuthContext = createContext();

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);

  // Check if user is logged in on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = localStorage.getItem('firebaseIdToken');
        const storedUser = localStorage.getItem('ecostrideUser');

        if (storedToken && storedUser) {
          // Verify token is still valid
          const response = await axios.post(`${API_BASE_URL}/api/auth/verify`, {
            idToken: storedToken
          });

          if (response.data.valid) {
            setIdToken(storedToken);
            const storedUserObj = JSON.parse(storedUser);
            setUser(storedUserObj);
            setIsBlocked(storedUserObj.status === 'blocked');
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('firebaseIdToken');
            localStorage.removeItem('ecostrideUser');
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Store token in localStorage for API calls
  useEffect(() => {
    if (idToken) {
      localStorage.setItem('firebaseIdToken', idToken);
    }
  }, [idToken]);

  const signInWithGoogle = async (googleIdToken, firebaseUser) => {
    try {
      setError(null);
      setLoading(true);

      // Check blocked status from Realtime Database using Firebase UID
      let blocked = false;
      if (firebaseUser?.uid) {
        const dbUser = await getUserByUid(firebaseUser.uid);
        if (dbUser && dbUser.status === 'blocked') {
          blocked = true;
        }
      }

      if (blocked) {
        setIsBlocked(true);
        // Do not proceed with backend sign-in for blocked users
        return {
          success: false,
          blocked: true,
          error: 'Your account has been blocked. Please contact the administrator. Contact with Admin (ecoadmin@gmail.com)'
        };
      }

      // Send token to backend for verification for non-blocked users
      const response = await axios.post(`${API_BASE_URL}/api/auth/signin`, {
        idToken: googleIdToken
      });

      if (response.data.status === 'success') {
        const userData = response.data.user;
        setUser(userData);
        setIdToken(googleIdToken);
        setIsBlocked(userData.status === 'blocked');

        // Store in localStorage
        localStorage.setItem('ecostrideUser', JSON.stringify(userData));
        localStorage.setItem('firebaseIdToken', googleIdToken);
        localStorage.setItem('userEmail', userData.email);
        localStorage.setItem('userName', userData.name);
        localStorage.setItem('userUid', userData.uid);

        return {
          success: true,
          isNewUser: response.data.user.isNewUser,
          user: userData
        };
      }

      throw new Error(response.data.message || 'Sign in failed');
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      setError(errorMessage);
      console.error('Sign in error:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      setError(null);
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/profile`,
        profileData,
        {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        }
      );

      if (response.data.status === 'success') {
        const updatedUser = {
          ...user,
          ...response.data.user
        };
        setUser(updatedUser);
        localStorage.setItem('ecostrideUser', JSON.stringify(updatedUser));

        return {
          success: true,
          user: updatedUser
        };
      }

      throw new Error(response.data.message || 'Profile update failed');
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      setError(errorMessage);
      console.error('Profile update error:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  const getProfile = async () => {
    try {
      if (!idToken) {
        throw new Error('No authentication token');
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/auth/profile`,
        {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        }
      );

      if (response.data.status === 'success') {
        const userData = response.data.user;
        setUser(userData);
        return userData;
      }

      throw new Error(response.data.message || 'Failed to fetch profile');
    } catch (err) {
      console.error('Get profile error:', err.message);
      return null;
    }
  };

  const logout = () => {
    setUser(null);
    setIdToken(null);
    setIsBlocked(false);
    localStorage.removeItem('firebaseIdToken');
    localStorage.removeItem('ecostrideUser');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userUid');
  };

  const isAuthenticated = !!user && !!idToken && !isBlocked;
  const isProfileComplete = user?.profile_completed === true;

  const value = {
    user,
    loading,
    error,
    idToken,
    isAuthenticated,
    isProfileComplete,
    isBlocked,
    signInWithGoogle,
    updateProfile,
    getProfile,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
