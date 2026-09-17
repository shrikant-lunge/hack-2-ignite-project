import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Plus, Trash2, Edit2, Calendar, Clock, Loader, Search,
  RefreshCw, AlertCircle, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

const CommunityMessageAdmin = () => {
  const navigate = useNavigate();
  const session = getSession();

  const [messages, setMessages] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // Form modal state
  const [showForm, setShowForm] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    expiresAt: ''
  });

  // Confirm delete modal
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/community/messages`);
      if (resp.data.status === 'success') {
        setMessages(resp.data.messages || []);
      }
    } catch (err) {
      showToast('error', 'Failed to fetch messages');
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Filter messages by search
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(messages);
    } else {
      const q = search.toLowerCase();
      setFiltered(
        messages.filter(
          (m) =>
            m.title?.toLowerCase().includes(q) ||
            m.content?.toLowerCase().includes(q) ||
            m.id?.toLowerCase().includes(q)
        )
      );
    }
  }, [search, messages]);

  const handleOpenForm = (message = null) => {
    if (message) {
      setEditingMessage(message);
      setFormData({
        title: message.title,
        content: message.content,
        expiresAt: message.expiresAt
      });
    } else {
      setEditingMessage(null);
      setFormData({
        title: '',
        content: '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
      });
    }
    setShowForm(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim() || !formData.expiresAt) {
      showToast('error', 'Please fill in all fields');
      return;
    }

    setFormLoading(true);
    try {
      if (editingMessage) {
        // Update existing message
        await axios.put(
          `${API_BASE_URL}/api/admin/community/message/${editingMessage.id}`,
          formData
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editingMessage.id
              ? { ...m, ...formData }
              : m
          )
        );
        showToast('success', 'Message updated successfully');
      } else {
        // Create new message
        const resp = await axios.post(
          `${API_BASE_URL}/api/admin/community/message`,
          formData
        );
        if (resp.data.status === 'success') {
          setMessages((prev) => [
            { id: resp.data.messageId, ...formData },
            ...prev
          ]);
          showToast('success', 'Message published successfully');
        }
      }
      setShowForm(false);
    } catch (err) {
      showToast('error', editingMessage ? 'Failed to update message' : 'Failed to publish message');
      console.error('Form error:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/community/message/${confirmDelete.id}`);
      setMessages((prev) => prev.filter((m) => m.id !== confirmDelete.id));
      showToast('success', 'Message deleted successfully');
      setConfirmDelete(null);
    } catch (err) {
      showToast('error', 'Failed to delete message');
    } finally {
      setDeleting(false);
    }
  };

  const getExpiryStatus = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const hoursLeft = (expiry - now) / (1000 * 60 * 60);
    
    if (hoursLeft < 0) return { status: 'expired', color: '#ef4444' };
    if (hoursLeft < 24) return { status: `${Math.floor(hoursLeft)}h left`, color: '#f59e0b' };
    const daysLeft = Math.floor(hoursLeft / 24);
    return { status: `${daysLeft}d left`, color: 'var(--accent)' };
  };

  return (
    <div className="admin-page">
      {/* ── Header ──────────────────────────── */}
      <div className="admin-header">
        <div className="admin-header-left">
          <div className="admin-header-icon">📢</div>
          <div>
            <div className="admin-header-title">Community Messages</div>
            <div className="admin-header-meta">
              Manage announcements and broadcasts
            </div>
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
            onClick={fetchMessages}
            title="Refresh messages"
            style={{ gap: '6px' }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <button
            className="admin-logout-btn"
            onClick={() => handleOpenForm()}
            title="Create new message"
            style={{ gap: '6px', borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            <Plus size={13} />
            New Message
          </button>
        </div>
      </div>

      {/* ── Messages Grid ──────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0' }}>Active Messages</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {filtered.length} of {messages.length} messages
            </p>
          </div>
          <div className="admin-search-wrap">
            <span className="admin-search-icon">
              <Search size={14} />
            </span>
            <input
              className="admin-search-input"
              type="text"
              placeholder="Search messages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="admin-spinner" />
            <p style={{ color: 'var(--text-muted)' }}>Loading messages…</p>
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
              {search ? 'No messages match your search.' : 'No messages yet. Create one to get started!'}
            </p>
            {!search && (
              <button
                onClick={() => handleOpenForm()}
                style={{
                  padding: '10px 20px',
                  background: 'var(--accent)',
                  color: '#080d0f',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}
              >
                <Plus size={14} style={{ display: 'inline', marginRight: '6px' }} />
                Create First Message
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '16px'
          }}>
            {filtered.map((message) => {
              const createdAt = new Date(message.createdAt);
              const expiresAt = new Date(message.expiresAt);
              const expiry = getExpiryStatus(message.expiresAt);

              return (
                <div
                  key={message.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', flex: 1, wordBreak: 'break-word' }}>
                      {message.title}
                    </h3>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '4px 8px',
                      background: expiry.color + '22',
                      color: expiry.color,
                      borderRadius: '6px',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {expiry.status}
                    </span>
                  </div>

                  <p style={{
                    margin: 0,
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    lineHeight: '1.5',
                    maxHeight: '100px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {message.content}
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
                      {createdAt.toLocaleDateString()} {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '8px'
                  }}>
                    <button
                      onClick={() => handleOpenForm(message)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: 'transparent',
                        border: '1px solid rgba(59,130,246,0.25)',
                        color: '#3b82f6',
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
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(59,130,246,0.08)';
                        e.target.style.borderColor = 'rgba(59,130,246,0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'transparent';
                        e.target.style.borderColor = 'rgba(59,130,246,0.25)';
                      }}
                    >
                      <Edit2 size={10} />
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(message)}
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
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(239,68,68,0.08)';
                        e.target.style.borderColor = 'rgba(239,68,68,0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'transparent';
                        e.target.style.borderColor = 'rgba(239,68,68,0.25)';
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

      {/* ── Form Modal ────────────────────── */}
      {showForm && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target.classList.contains('modal-overlay')) setShowForm(false);
          }}
        >
          <div className="confirm-modal" style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {editingMessage ? 'Edit Message' : 'Create New Message'}
            </h3>

            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--text-secondary)'
                }}>
                  Message Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., System Maintenance Alert"
                  maxLength="100"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '4px'
                }}>
                  {formData.title.length}/100 characters
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--text-secondary)'
                }}>
                  Message Content *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Write your announcement message here..."
                  maxLength="1000"
                  rows="6"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '4px'
                }}>
                  {formData.content.length}/1000 characters
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--text-secondary)'
                }}>
                  Expires At *
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={formLoading}
                  className="confirm-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="confirm-delete-btn"
                  style={{ background: 'var(--accent)', color: '#080d0f' }}
                >
                  {formLoading ? (
                    <>
                      <Loader size={14} className="animate-spin" />
                      {editingMessage ? 'Updating…' : 'Publishing…'}
                    </>
                  ) : (
                    <>
                      <Bell size={14} />
                      {editingMessage ? 'Update Message' : 'Publish Message'}
                    </>
                  )}
                </button>
              </div>
            </form>
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
            <h3>Delete Message?</h3>
            <p>
              This will remove the message from all users' community feeds.
              This action cannot be undone.
            </p>
            <div className="confirm-modal-user">
              <strong>{confirmDelete.title}</strong>
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
                onClick={handleDelete}
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

export default CommunityMessageAdmin;
