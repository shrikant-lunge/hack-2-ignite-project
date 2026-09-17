import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AccountBlocked = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4">
      <div className="max-w-md w-full bg-white/95 border border-red-100 shadow-2xl rounded-2xl p-8 text-center backdrop-blur-sm">
        {/* Warning Icon */}
        <div className="mx-auto mb-4 flex items-center justify-center h-16 w-16 rounded-full bg-red-100 shadow-md">
          <svg
            className="h-10 w-10 text-red-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
            />
          </svg>
        </div>

        {/* Title & Message */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Account Blocked</h1>
        <p className="text-gray-600 mb-3">
          Your account has been blocked due to a policy violation or security concern.
        </p>
        <p className="text-xs text-gray-400 mb-4">
          If you believe this is a mistake, please reach out to the administrator with your
          registered email address and any relevant details.
        </p>

        {/* Contact */}
        <div className="mb-6">
          <p className="text-gray-700">
            Contact:{' '}
            <a
              href="mailto:admin@gmail.com"
              className="text-red-600 font-medium underline underline-offset-2"
            >
              admin@gmail.com
            </a>
          </p>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-gray-900 hover:bg-black transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1"
            />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AccountBlocked;
