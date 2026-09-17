import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2, Clock, Loader, Search, RefreshCw, AlertCircle, CheckCircle2,
  CheckCircle, MessageSquare
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import ThemeToggle from '../components/ThemeToggle';
import '../styles/AdminDashboard.css';

const getSession = () => {
  try {
    const s = localStorage.getItem('adminSession');
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

const CommunityReportsAdmin = () => {
  const navigate = useNavigate();
  const session = getSession();

  const [reports, setReports] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/admin/reports`);
      if (resp.data.status === 'success') {
        setReports(resp.data.reports || []);
      }
    } catch (err) {
      showToast('error', 'Failed to fetch reports');
      console.error('Fetch reports error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(reports);
    } else {
      const q = search.toLowerCase();
      setFiltered(
        reports.filter(
          (r) =>
            r.type?.toLowerCase().includes(q) ||
            r.city?.toLowerCase().includes(q) ||
            r.description?.toLowerCase().includes(q)
        )
      );
    }
  }, [search, reports]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/reports/${confirmDelete.id}`);
      setReports((prev) => prev.filter((r) => r.id !== confirmDelete.id));
      showToast('success', 'Report deleted successfully');
      setConfirmDelete(null);
    } catch (err) {
      showToast('error', 'Failed to delete report');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleResolve = async (report) => {
    setResolvingId(report.id);
    const isResolved = report.status === 'resolved';
    const endpoint = isResolved ? 'unresolve' : 'resolve';
    try {
      await axios.post(`${API_BASE_URL}/api/admin/reports/${report.id}/${endpoint}`);
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? { ...r, status: isResolved ? 'unresolved' : 'resolved' }
            : r
        )
      );
      showToast('success', `Report marked as ${isResolved ? 'unresolved' : 'resolved'}`);
    } catch (err) {
      showToast('error', `Failed to ${endpoint} report`);
    } finally {
      setResolvingId(null);
    }
  };

  const getEmoji = (type) => {
    switch (type) {
      case "fire": return "🔥";
      case "dust": return "💨";
      case "smoke": return "🏭";
      case "smell": return "🤢";
      default: return "⚠️";
    }
  };

  return (
    <div className="admin-page">
      {/* ── Header ──────────────────────────── */}
      <div className="admin-header">
        <div className="admin-header-left">
          <div className="admin-header-icon">🚨</div>
          <div>
            <div className="admin-header-title">Community Reports</div>
            <div className="admin-header-meta">Manage user-submitted pollution reports</div>
          </div>
        </div>
        <div className="admin-header-actions">
          <ThemeToggle />
          <button
            className="admin-logout-btn"
            onClick={() => navigate(-1)}
            title="Back"
            style={{ gap: '6px' }}
          >
            Back
          </button>
          <button
            className="admin-logout-btn"
            onClick={fetchReports}
            title="Refresh reports"
            style={{ gap: '6px' }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Reports Grid ──────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0' }}>All Reports</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {filtered.length} of {reports.length} reports
            </p>
          </div>
          <div className="admin-search-wrap">
            <span className="admin-search-icon">
              <Search size={14} />
            </span>
            <input
              className="admin-search-input"
              type="text"
              placeholder="Search reports…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="admin-spinner" />
            <p style={{ color: 'var(--text-muted)' }}>Loading reports…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--bg-card)',
            border: '1px dashed var(--border)',
            borderRadius: '12px'
          }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
              {search ? 'No reports match your search.' : 'No reports yet.'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '16px'
          }}>
            {filtered.map((report) => {
              const timestamp = new Date(report.timestamp);
              const isResolved = report.status === 'resolved';

              return (
                <div
                  key={report.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    opacity: isResolved ? 0.7 : 1
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{getEmoji(report.type)}</span>
                      <h3 style={{ margin: 0, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {report.type} Issue
                      </h3>
                    </div>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '4px 8px',
                      background: isResolved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: isResolved ? '#10b981' : '#ef4444',
                      borderRadius: '6px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {report.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>City:</strong> {report.city}
                  </div>

                  <p style={{
                    margin: 0,
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: '1.5',
                  }}>
                    {report.description || 'No description provided.'}
                  </p>

                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {timestamp.toLocaleDateString()} {timestamp.toLocaleTimeString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={() => handleToggleResolve(report)}
                      disabled={resolvingId === report.id}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: isResolved ? 'transparent' : 'rgba(16, 185, 129, 0.1)',
                        border: `1px solid ${isResolved ? 'var(--border)' : 'rgba(16, 185, 129, 0.3)'}`,
                        color: isResolved ? 'var(--text-muted)' : '#10b981',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-display)',
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {resolvingId === report.id ? <Loader size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                      {isResolved ? 'Unresolve' : 'Mark Resolved'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(report)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: 'transparent',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: '#f87171',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-display)',
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Trash2 size={10} />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Confirm Delete Modal ─────────────── */}
      {confirmDelete && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target.classList.contains('modal-overlay')) setConfirmDelete(null);
          }}
        >
          <div className="confirm-modal">
            <div className="confirm-modal-icon">⚠️</div>
            <h3>Delete Report?</h3>
            <p>
              This will remove the report permanently.
            </p>
            <div className="confirm-modal-actions">
              <button
                className="confirm-cancel-btn"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-btn"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <><Loader size={14} className="animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 size={14} /> Delete</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ───────────────────────────── */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default CommunityReportsAdmin;
