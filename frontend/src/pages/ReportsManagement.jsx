import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, AlertCircle, CheckCircle2, Trash2, MessageSquare,
  Search, RefreshCw, Filter, Loader, Clock
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';
import '../styles/AdminDashboard.css';

const getSession = () => {
  try {
    const s = localStorage.getItem('adminSession');
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

const ReportsManagement = () => {
  const navigate = useNavigate();
  const session = getSession();

  const [reports, setReports] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  // Comment modal state
  const [selectedReport, setSelectedReport] = useState(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Confirm delete modal
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, resolved: 0, unresolved: 0 });

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let query = '';
      if (statusFilter !== 'all') {
        query = `?status=${statusFilter}`;
      }
      const resp = await axios.get(`${API_BASE_URL}/api/admin/reports${query}`);
      if (resp.data.status === 'success') {
        setReports(resp.data.reports || []);
      }
    } catch (err) {
      showToast('error', 'Failed to fetch reports');
      console.error('Fetch reports error:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/admin/reports/stats`);
      if (resp.data.status === 'success') {
        setStats(resp.data.stats);
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [fetchReports, fetchStats]);

  // Filter reports by search
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(reports);
    } else {
      const q = search.toLowerCase();
      setFiltered(
        reports.filter(
          (r) =>
            r.email?.toLowerCase().includes(q) ||
            r.description?.toLowerCase().includes(q) ||
            r.id?.toLowerCase().includes(q) ||
            r.type?.toLowerCase().includes(q)
        )
      );
    }
  }, [search, reports]);

  const handleResolve = async (reportId) => {
    setActionLoading(reportId);
    try {
      await axios.post(`${API_BASE_URL}/api/admin/reports/${reportId}/resolve`);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, status: 'resolved', resolvedAt: new Date().toISOString() }
            : r
        )
      );
      showToast('success', 'Report marked as resolved');
      fetchStats();
    } catch (err) {
      showToast('error', 'Failed to resolve report');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnresolve = async (reportId) => {
    setActionLoading(reportId);
    try {
      await axios.post(`${API_BASE_URL}/api/admin/reports/${reportId}/unresolve`);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, status: 'unresolved' } : r
        )
      );
      showToast('success', 'Report marked as unresolved');
      fetchStats();
    } catch (err) {
      showToast('error', 'Failed to unresolve report');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      showToast('error', 'Comment cannot be empty');
      return;
    }

    setSubmittingComment(true);
    try {
      await axios.post(`${API_BASE_URL}/api/admin/reports/${selectedReport.id}/comment`, {
        adminEmail: session?.email || 'admin@ecostride.com',
        comment: commentText
      });
      
      // Update report with new comment
      setReports((prev) =>
        prev.map((r) => {
          if (r.id === selectedReport.id) {
            const updatedComments = [...(r.adminComments || [])];
            updatedComments.push({
              adminEmail: session?.email || 'admin@ecostride.com',
              comment: commentText,
              timestamp: new Date().toISOString()
            });
            return { ...r, adminComments: updatedComments };
          }
          return r;
        })
      );
      
      setCommentText('');
      showToast('success', 'Comment added successfully');
    } catch (err) {
      showToast('error', 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/reports/${confirmDelete.id}`);
      setReports((prev) => prev.filter((r) => r.id !== confirmDelete.id));
      showToast('success', 'Report deleted successfully');
      setConfirmDelete(null);
      fetchStats();
    } catch (err) {
      showToast('error', 'Failed to delete report');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-page">
      {/* ── Header ──────────────────────────── */}
      <div className="admin-header">
        <div className="admin-header-left">
          <div className="admin-header-icon">📋</div>
          <div>
            <div className="admin-header-title">Reports Management</div>
            <div className="admin-header-meta">
              Community reports and user submissions
            </div>
          </div>
        </div>
        <div className="admin-header-actions">
          <button
            className="admin-logout-btn"
            onClick={() => {
              fetchReports();
              fetchStats();
            }}
            title="Refresh reports"
            style={{ gap: '6px' }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────── */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-icon stat-icon-total">
            <FileText size={20} color="#3b82f6" />
          </div>
          <div className="admin-stat-info">
            <div className="admin-stat-value">{stats.total}</div>
            <div className="admin-stat-label">Total Reports</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon stat-icon-active">
            <AlertCircle size={20} color="#f59e0b" />
          </div>
          <div className="admin-stat-info">
            <div className="admin-stat-value">{stats.unresolved}</div>
            <div className="admin-stat-label">Unresolved</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon stat-icon-blocked">
            <CheckCircle2 size={20} color="var(--accent)" />
          </div>
          <div className="admin-stat-info">
            <div className="admin-stat-value">{stats.resolved}</div>
            <div className="admin-stat-label">Resolved</div>
          </div>
        </div>
      </div>

      {/* ── Reports Table ─────────────────────── */}
      <div className="admin-users-section">
        <div className="admin-users-header">
          <div className="admin-users-title">
            All Reports
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
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Reports</option>
              <option value="unresolved">Unresolved</option>
              <option value="resolved">Resolved</option>
            </select>
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
        </div>

        {loading ? (
          <div className="admin-table-empty">
            <div className="admin-spinner" />
            <p>Loading reports…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">
            <p>{search ? 'No reports match your search.' : 'No reports found.'}</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((report) => {
                  const isBusy = actionLoading === report.id;
                  const isResolved = report.status === 'resolved';
                  const timestamp = new Date(report.timestamp);

                  return (
                    <tr key={report.id}>
                      <td>{report.email || '—'}</td>
                      <td>
                        <span style={{
                          display: 'block',
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={report.description}>
                          {report.description || 'No description'}
                        </span>
                      </td>
                      <td>
                        <span style={{ textTransform: 'capitalize' }}>
                          {report.type || 'other'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {timestamp.toLocaleDateString()} {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${isResolved ? 'resolved' : 'unresolved'}`}
                          style={{ background: isResolved ? 'rgba(0,229,160,0.12)' : 'rgba(245,158,11,0.12)', color: isResolved ? 'var(--accent)' : '#f59e0b' }}>
                          <span className="status-dot" style={{ background: isResolved ? 'var(--accent)' : '#f59e0b' }} />
                          {isResolved ? 'Resolved' : 'Unresolved'}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns" style={{ gap: '6px' }}>
                          {isResolved ? (
                            <button
                              className="action-btn"
                              onClick={() => handleUnresolve(report.id)}
                              disabled={isBusy}
                              title="Mark as unresolved"
                              style={{
                                color: '#f59e0b',
                                borderColor: 'rgba(245,158,11,0.25)',
                                fontSize: '10px',
                                padding: '5px 10px'
                              }}
                            >
                              {isBusy ? <Loader size={10} /> : <AlertCircle size={10} />}
                              Unresolve
                            </button>
                          ) : (
                            <button
                              className="action-btn"
                              onClick={() => handleResolve(report.id)}
                              disabled={isBusy}
                              title="Mark as resolved"
                              style={{
                                color: 'var(--accent)',
                                borderColor: 'rgba(0,229,160,0.2)',
                                fontSize: '10px',
                                padding: '5px 10px'
                              }}
                            >
                              {isBusy ? <Loader size={10} /> : <CheckCircle2 size={10} />}
                              Resolve
                            </button>
                          )}
                          <button
                            className="action-btn"
                            onClick={() => {
                              setSelectedReport(report);
                              setShowCommentModal(true);
                            }}
                            disabled={isBusy}
                            title="Add comment"
                            style={{
                              color: '#3b82f6',
                              borderColor: 'rgba(59,130,246,0.25)',
                              fontSize: '10px',
                              padding: '5px 10px'
                            }}
                          >
                            <MessageSquare size={10} />
                            Comment
                          </button>
                          <button
                            className="action-btn delete"
                            onClick={() => setConfirmDelete(report)}
                            disabled={isBusy}
                            title="Delete report"
                            style={{
                              fontSize: '10px',
                              padding: '5px 10px'
                            }}
                          >
                            <Trash2 size={10} />
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

      {/* ── Comment Modal ─────────────────── */}
      {showCommentModal && selectedReport && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target.classList.contains('modal-overlay')) setShowCommentModal(false);
          }}
        >
          <div className="confirm-modal" style={{ maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '12px' }}>Add Comment to Report</h3>
            
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Report ID: {selectedReport.id}</p>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>User: {selectedReport.email}</p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{selectedReport.description}</p>
            </div>

            {selectedReport.adminComments && selectedReport.adminComments.length > 0 && (
              <div style={{ marginBottom: '16px', maxHeight: '200px', overflowY: 'auto', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Previous Comments</p>
                {selectedReport.adminComments.map((c, i) => (
                  <div key={i} style={{ marginBottom: '8px', padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <p style={{ margin: '0 0 4px 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {c.adminEmail} • {new Date(c.timestamp).toLocaleString()}
                    </p>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{c.comment}</p>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Enter your comment…"
              rows="4"
              style={{
                width: '100%',
                padding: '11px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                resize: 'vertical',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
            />

            <div className="confirm-modal-actions">
              <button
                className="confirm-cancel-btn"
                onClick={() => setShowCommentModal(false)}
                disabled={submittingComment}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-btn"
                onClick={handleAddComment}
                disabled={submittingComment}
                style={{ background: '#3b82f6' }}
              >
                {submittingComment ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    Posting…
                  </>
                ) : (
                  <>
                    <MessageSquare size={14} />
                    Post Comment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
              This will permanently remove the report from the system. This action cannot
              be undone.
            </p>
            <div className="confirm-modal-user">
              <strong>Report ID: {confirmDelete.id}</strong>
              <br />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {confirmDelete.email}
              </span>
            </div>
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
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default ReportsManagement;
