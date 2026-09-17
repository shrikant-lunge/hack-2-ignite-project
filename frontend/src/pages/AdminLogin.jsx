import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdmins } from '../utils/firebase';
import { Loader, ShieldCheck, AlertTriangle } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/AdminDashboard.css';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If already logged in as admin, redirect to /admin
  React.useEffect(() => {
    const session = localStorage.getItem('adminSession');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed?.username) {
          navigate('/admin', { replace: true });
        }
      } catch {
        localStorage.removeItem('adminSession');
      }
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const admins = await getAdmins();

      if (!admins) {
        setError('Invalid admin credentials');
        return;
      }

      // Check against all entries in the `admins` node
      const matched = Object.values(admins).find(
        (admin) =>
          admin.username === username.trim() &&
          admin.password === password
      );

      if (matched) {
        // Store session
        localStorage.setItem(
          'adminSession',
          JSON.stringify({
            username: matched.username,
            loggedInAt: new Date().toISOString(),
          })
        );
        navigate('/admin', { replace: true });
      } else {
        setError('Invalid admin credentials');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <div className="admin-login-brand-icon">
            <ShieldCheck size={26} color="var(--accent)" />
          </div>
          <h1>EcoStride Admin</h1>
          <p>Secure Admin Portal</p>
        </div>

        <form className="admin-login-form" onSubmit={handleLogin} noValidate>
          {error && (
            <div className="admin-login-error">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="admin-username">
              Username
            </label>
            <input
              id="admin-username"
              className="admin-form-input"
              type="text"
              autoComplete="username"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              className="admin-form-input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button className="admin-login-btn" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader size={15} className="animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <ShieldCheck size={15} />
                Sign In as Admin
              </>
            )}
          </button>
        </form>
      </div>
      
      <div style={{ position: 'absolute', top: 24, right: 24 }}>
        <ThemeToggle />
      </div>
    </div>
  );
};

export default AdminLogin;
