import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, ShieldOff, ShieldCheck, Trash2, LogOut,
  Search, RefreshCw, AlertTriangle, Loader, CheckCircle,
  Mail, Eye, Send, AlertCircle, CheckCircle2,
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/AdminDashboard.css';

/* ── helpers ─────────────────────────────────────── */
const getSession = () => {
  try {
    const s = localStorage.getItem('adminSession');
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

/* ── component ───────────────────────────────────── */
const AdminDashboard = () => {
  const navigate = useNavigate();

  const [users, setUsers]             = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // uid of user being acted on

  // Confirm-delete modal state
  const [confirmUser, setConfirmUser] = useState(null); // { uid, name, email }
  const [deleting, setDeleting]       = useState(false);

  // Toast
  const [toast, setToast]             = useState(null); // { type: 'success'|'error', msg }

  // Broadcast Email State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastCCEmails, setBroadcastCCEmails] = useState('');
  const [broadcastBCCEmails, setBroadcastBCCEmails] = useState('');
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastPreview, setBroadcastPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [broadcastStats, setBroadcastStats] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);

  const session = getSession();

  /* ── data loading ─────────────────────────────── */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/admin/users`);
      if (resp.data.status === 'success') {
        setUsers(resp.data.users || []);
      }
    } catch (err) {
      showToast('error', 'Failed to fetch users.');
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filter on search
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(users);
    } else {
      const q = search.toLowerCase();
      setFiltered(
        users.filter(
          (u) =>
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.uid?.toLowerCase().includes(q)
        )
      );
    }
  }, [search, users]);

  /* ── toast util ───────────────────────────────── */
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── logout ───────────────────────────────────── */
  const handleLogout = () => {
    localStorage.removeItem('adminSession');
    navigate('/admin-login', { replace: true });
  };

  /* ── block ────────────────────────────────────── */
  const handleBlock = async (uid) => {
    setActionLoading(uid);
    try {
      await axios.post(`${API_BASE_URL}/api/admin/users/${uid}/block`);
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status: 'blocked' } : u))
      );
      showToast('success', 'User blocked successfully.');
    } catch {
      showToast('error', 'Failed to block user.');
    } finally {
      setActionLoading(null);
    }
  };

  /* ── unblock ──────────────────────────────────── */
  const handleUnblock = async (uid) => {
    setActionLoading(uid);
    try {
      await axios.post(`${API_BASE_URL}/api/admin/users/${uid}/unblock`);
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, status: 'active' } : u))
      );
      showToast('success', 'User unblocked successfully.');
    } catch {
      showToast('error', 'Failed to unblock user.');
    } finally {
      setActionLoading(null);
    }
  };

  /* ── delete ───────────────────────────────────── */
  const handleDeleteConfirm = async () => {
    if (!confirmUser) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/users/${confirmUser.uid}`);
      setUsers((prev) => prev.filter((u) => u.uid !== confirmUser.uid));
      showToast('success', `${confirmUser.name || confirmUser.email} deleted.`);
      setConfirmUser(null);
    } catch {
      showToast('error', 'Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Broadcast Email Functions ─────────────────── */
  const handleGeneratePreview = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      showToast('error', 'Title and message are required');
      return;
    }

    setBroadcastLoading(true);
    try {
      const resp = await axios.post(`${API_BASE_URL}/api/admin/broadcast/preview`, {
        title: broadcastTitle,
        message: broadcastMessage,
      });

      if (resp.data.status === 'success') {
        setBroadcastPreview(resp.data.preview);
        setShowPreview(true);
      }
    } catch (err) {
      showToast('error', 'Failed to generate preview');
      console.error('Preview error:', err);
    } finally {
      setBroadcastLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      showToast('error', 'Test email address is required');
      return;
    }

    setTestSending(true);
    try {
      const resp = await axios.post(`${API_BASE_URL}/api/admin/broadcast/test`, {
        test_email: testEmail,
        title: broadcastTitle || 'Test Email',
        message: broadcastMessage || 'This is a test message',
      });

      if (resp.data.status === 'success' || resp.data.message === 'Test email sent successfully') {
        showToast('success', `Test email sent to ${testEmail}`);
        setTestEmail('');
      } else {
        showToast('error', resp.data.message || 'Failed to send test email');
      }
    } catch (err) {
      showToast('error', 'Failed to send test email');
      console.error('Test email error:', err);
    } finally {
      setTestSending(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      showToast('error', 'Title and message are required');
      return;
    }

    // Confirm before sending
    if (!window.confirm(`Send broadcast email to all ${users.length} users? This action cannot be undone.`)) {
      return;
    }

    setBroadcastLoading(true);
    try {
      // Parse CC and BCC emails
      const ccEmails = broadcastCCEmails
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0);
      
      const bccEmails = broadcastBCCEmails
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0);

      const resp = await axios.post(`${API_BASE_URL}/api/admin/broadcast/send`, {
        title: broadcastTitle,
        message: broadcastMessage,
        cc_emails: ccEmails,
        bcc_emails: bccEmails,
      });

      if (resp.data.status === 'success' || resp.data.status === 'partial') {
        setBroadcastStats(resp.data.stats);
        showToast('success', `Emails sent: ${resp.data.stats.sent}/${resp.data.stats.total}`);
        
        // Reset form
        setBroadcastTitle('');
        setBroadcastMessage('');
        setBroadcastCCEmails('');
        setBroadcastBCCEmails('');
        setShowPreview(false);
        setBroadcastPreview(null);
        
        // Close modal after 2 seconds
        setTimeout(() => setShowBroadcastModal(false), 2000);
      } else {
        showToast('error', resp.data.message || 'Failed to send broadcast');
      }
    } catch (err) {
      showToast('error', 'Failed to send broadcast email');
      console.error('Broadcast error:', err);
    } finally {
      setBroadcastLoading(false);
    }
  };

  /* ── stats ────────────────────────────────────── */
  const totalUsers   = users.length;
  const activeUsers  = users.filter((u) => (u.status || 'active') !== 'blocked').length;
  const blockedUsers = users.filter((u) => u.status === 'blocked').length;

  /* ── render ───────────────────────────────────── */
  return (
    <div className="admin-page">
      {/* ── Header ──────────────────────────── */}
      <div className="admin-header">
        <div className="admin-header-left">
          <div className="admin-header-icon">🛡️</div>
          <div>
            <div className="admin-header-title">Admin Dashboard</div>
            <div className="admin-header-meta">
              Logged in as &nbsp;
              <span style={{ color: 'var(--accent)' }}>
                {session?.username || 'Admin'}
              </span>
            </div>
          </div>
        </div>
        <div className="admin-header-actions">
          <ThemeToggle />
          <button
            className="admin-logout-btn"
            onClick={() => navigate('/admin/reports')}
            title="Manage Community Reports"
            style={{ gap: '6px', borderColor: 'rgba(239, 68, 68, 0.8)', color: '#ef4444' }}
          >
            Moderate Reports
          </button>
          <button
            className="admin-logout-btn"
            onClick={() => navigate('/admin/messages')}
            title="Manage Community Messages"
            style={{ gap: '6px', borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            Moderate Messages
          </button>
          <button
            className="admin-logout-btn"
            onClick={fetchUsers}
            title="Refresh user list"
            style={{ gap: '6px' }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <button className="admin-logout-btn" onClick={handleLogout}>
            <LogOut size={13} />
            Logout
          </button>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────── */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-icon stat-icon-total">
            <Users size={20} color="#3b82f6" />
          </div>
          <div className="admin-stat-info">
            <div className="admin-stat-value">{totalUsers}</div>
            <div className="admin-stat-label">Total Users</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon stat-icon-active">
            <ShieldCheck size={20} color="var(--accent)" />
          </div>
          <div className="admin-stat-info">
            <div className="admin-stat-value">{activeUsers}</div>
            <div className="admin-stat-label">Active</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon stat-icon-blocked">
            <ShieldOff size={20} color="#f87171" />
          </div>
          <div className="admin-stat-info">
            <div className="admin-stat-value">{blockedUsers}</div>
            <div className="admin-stat-label">Blocked</div>
          </div>
        </div>
      </div>

      {/* ── Users Table ─────────────────────── */}
      <div className="admin-users-section">
        <div className="admin-users-header">
          <div className="admin-users-title">
            Registered Users
            {!loading && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginLeft: '10px',
                }}
              >
                ({filtered.length})
              </span>
            )}
          </div>
          <div className="admin-search-wrap">
            <span className="admin-search-icon">
              <Search size={14} />
            </span>
            <input
              className="admin-search-input"
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="admin-table-empty">
            <div className="admin-spinner" />
            <p>Loading users…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">
            <p>{search ? 'No users match your search.' : 'No users found.'}</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>UID</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const isBlocked  = user.status === 'blocked';
                  const isBusy     = actionLoading === user.uid;

                  return (
                    <tr key={user.uid}>
                      <td>{user.name || '—'}</td>
                      <td>{user.email || '—'}</td>
                      <td>
                        <span className="uid-cell" title={user.uid}>
                          {user.uid}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${isBlocked ? 'blocked' : 'active'}`}
                        >
                          <span className="status-dot" />
                          {isBlocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          {isBlocked ? (
                            <button
                              className="action-btn unblock"
                              onClick={() => handleUnblock(user.uid)}
                              disabled={isBusy}
                              title="Unblock user"
                            >
                              {isBusy
                                ? <Loader size={11} className="animate-spin" />
                                : <ShieldCheck size={11} />}
                              Unblock
                            </button>
                          ) : (
                            <button
                              className="action-btn block"
                              onClick={() => handleBlock(user.uid)}
                              disabled={isBusy}
                              title="Block user"
                            >
                              {isBusy
                                ? <Loader size={11} className="animate-spin" />
                                : <ShieldOff size={11} />}
                              Block
                            </button>
                          )}
                          <button
                            className="action-btn delete"
                            onClick={() =>
                              setConfirmUser({
                                uid: user.uid,
                                name: user.name,
                                email: user.email,
                              })
                            }
                            disabled={isBusy}
                            title="Delete user"
                          >
                            <Trash2 size={11} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Confirm Delete Modal ─────────────── */}
      {confirmUser && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target.classList.contains('modal-overlay')) setConfirmUser(null);
          }}
        >
          <div className="confirm-modal">
            <div className="confirm-modal-icon">⚠️</div>
            <h3>Delete User?</h3>
            <p>
              This will permanently remove the user from Firebase Auth, the
              database, and add their email to the blacklist. This action cannot
              be undone.
            </p>
            <div className="confirm-modal-user">
              <strong>{confirmUser.name || 'Unknown'}</strong>
              <br />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {confirmUser.email}
              </span>
            </div>
            <div className="confirm-modal-actions">
              <button
                className="confirm-cancel-btn"
                onClick={() => setConfirmUser(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-btn"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ───────────────────────────── */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === 'success'
            ? <CheckCircle size={16} />
            : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Broadcast Email Modal ────────────────── */}
      {showBroadcastModal && (
        <div className="broadcast-modal-overlay" onClick={(e) => {
          if (e.target.classList.contains('broadcast-modal-overlay')) setShowBroadcastModal(false);
        }}>
          <div className="broadcast-modal">
            <div className="broadcast-modal-header">
              <div className="broadcast-modal-title">
                <Mail size={18} />
                Emergency Broadcast Email
              </div>
              <button
                className="broadcast-modal-close"
                onClick={() => setShowBroadcastModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="broadcast-modal-body">
              {/* Email Title */}
              <div className="broadcast-form-group">
                <label className="broadcast-form-label">Email Title</label>
                <input
                  type="text"
                  className="broadcast-form-input"
                  placeholder="e.g., System Maintenance Alert"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                />
              </div>

              {/* Email Message */}
              <div className="broadcast-form-group">
                <label className="broadcast-form-label">Email Message</label>
                <textarea
                  className="broadcast-form-textarea"
                  placeholder="Write your message here. You can use line breaks..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                />
                <div className="broadcast-form-hint">
                  {broadcastMessage.length} characters
                </div>
              </div>

              {/* CC/BCC Section */}
              <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <div className="broadcast-section-title">Optional: CC & BCC</div>
                <div className="broadcast-form-group">
                  <label className="broadcast-form-label">CC Emails</label>
                  <input
                    type="text"
                    className="broadcast-form-input"
                    placeholder="Comma-separated: email1@example.com, email2@example.com"
                    value={broadcastCCEmails}
                    onChange={(e) => setBroadcastCCEmails(e.target.value)}
                  />
                </div>
                <div className="broadcast-form-group">
                  <label className="broadcast-form-label">BCC Emails</label>
                  <input
                    type="text"
                    className="broadcast-form-input"
                    placeholder="Comma-separated: email1@example.com, email2@example.com"
                    value={broadcastBCCEmails}
                    onChange={(e) => setBroadcastBCCEmails(e.target.value)}
                  />
                </div>
              </div>

              {/* Test Email Section */}
              <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <div className="broadcast-section-title">Test Email</div>
                <div className="broadcast-test-section">
                  <input
                    type="email"
                    className="broadcast-test-input"
                    placeholder="your@email.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                  <button
                    className="broadcast-test-btn"
                    onClick={handleSendTestEmail}
                    disabled={testSending || !testEmail.trim()}
                  >
                    {testSending ? (
                      <>
                        <Loader size={12} className="animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        Send Test
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="broadcast-button-group">
                <button
                  className="broadcast-preview-btn"
                  onClick={handleGeneratePreview}
                  disabled={broadcastLoading || !broadcastTitle.trim() || !broadcastMessage.trim()}
                >
                  <Eye size={14} />
                  Preview
                </button>
                <button
                  className="broadcast-send-btn"
                  onClick={handleSendBroadcast}
                  disabled={broadcastLoading || !broadcastTitle.trim() || !broadcastMessage.trim()}
                >
                  {broadcastLoading ? (
                    <>
                      <Loader size={14} className="animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Send to All ({users.length})
                    </>
                  )}
                </button>
              </div>

              {/* Stats Display */}
              {broadcastStats && (
                <div className="broadcast-stats-box">
                  <div className="broadcast-stat success">
                    <div className="broadcast-stat-value">{broadcastStats.sent}</div>
                    <div className="broadcast-stat-label">Sent</div>
                  </div>
                  <div className="broadcast-stat">
                    <div className="broadcast-stat-value">{broadcastStats.total}</div>
                    <div className="broadcast-stat-label">Total</div>
                  </div>
                  <div className="broadcast-stat error">
                    <div className="broadcast-stat-value">{broadcastStats.failed}</div>
                    <div className="broadcast-stat-label">Failed</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Email Preview Modal ────────────────── */}
      {showPreview && broadcastPreview && (
        <div className="broadcast-preview-modal-overlay" onClick={(e) => {
          if (e.target.classList.contains('broadcast-preview-modal-overlay')) setShowPreview(false);
        }}>
          <div className="broadcast-preview-modal">
            <div className="broadcast-preview-header">
              <div className="broadcast-preview-title">Email Preview</div>
              <button
                className="broadcast-preview-close"
                onClick={() => setShowPreview(false)}
              >
                ✕
              </button>
            </div>
            <div className="broadcast-preview-content">
              <div className="broadcast-preview-iframe-wrap">
                <iframe
                  className="broadcast-preview-iframe"
                  srcDoc={broadcastPreview}
                  title="Email Preview"
                  height="500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Broadcast Button in Header ────────── */}
      <div style={{ position: 'fixed', bottom: '28px', left: '28px', zIndex: '8000' }}>
        <button
          onClick={() => setShowBroadcastModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'var(--accent)',
            color: '#080d0f',
            border: 'none',
            borderRadius: '10px',
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
            boxShadow: '0 6px 20px var(--accent-glow)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.target.style.opacity = '0.88';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.opacity = '1';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          <Mail size={16} />
          Broadcast
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;
