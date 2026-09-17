import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation } from "../hooks/useLocation";
import { API_BASE_URL } from "../apiConfig";
import jsPDF from "jspdf";

const Community = () => {
  const { location } = useLocation();
  const [reports, setReports] = useState([]);
  const [communityMessages, setCommunityMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [form, setForm] = useState({ type: "fire", description: "" });

  // States for Community Message Form
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [msgForm, setMsgForm] = useState({ title: "", content: "" });
  const [msgLoading, setMsgLoading] = useState(false);

  // Fetch community messages on mount
  useEffect(() => {
    fetchCommunityMessages();
  }, []);

  const fetchCommunityMessages = async () => {
    setMessagesLoading(true);
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/community/messages`);
      if (resp.data.status === "success") {
        setCommunityMessages(resp.data.messages || []);
      }
    } catch (err) {
      console.warn("Failed to fetch community messages:", err.message);
      setCommunityMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/community/reports`);
      if (resp.data.status === "success") {
        const allReports = resp.data.reports || [];
        const cityReports = allReports.filter(
          (r) => r.city === location.city && r.status !== "resolved",
        );

        const valid = cityReports.filter((r) => {
          const rTime = new Date(r.timestamp).getTime();
          return Date.now() - rTime < 4 * 60 * 60 * 1000;
        });
        setReports(valid);
      }
    } catch (err) {
      console.warn("Failed to fetch community reports:", err.message);
      // Fallback to local storage
      const saved = JSON.parse(
        localStorage.getItem(`reports_${location.city}`) || "[]",
      );
      const valid = saved.filter((r) => {
        const rTime =
          typeof r.timestamp === "number"
            ? r.timestamp
            : new Date(r.timestamp).getTime();
        return Date.now() - rTime < 4 * 60 * 60 * 1000;
      });
      setReports(valid);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [location.city]);

  const handleMsgSubmit = async (e) => {
    e.preventDefault();
    if (!msgForm.title.trim() || !msgForm.content.trim()) return;
    setMsgLoading(true);
    try {
      // Auto-expire user messages in 48 hours
      const expiresAt = new Date(
        Date.now() + 48 * 60 * 60 * 1000,
      ).toISOString();
      const resp = await axios.post(`${API_BASE_URL}/api/community/message`, {
        title: msgForm.title,
        content: msgForm.content,
        expiresAt: expiresAt,
      });
      setMsgForm({ title: "", content: "" });
      setShowMessageForm(false);
      fetchCommunityMessages(); // Refresh messages immediately
      alert(resp.data.message || "Message posted successfully!");
    } catch (err) {
      console.error("Failed to post message", err);
      alert("Failed to post message. Please try again.");
    } finally {
      setMsgLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await axios.post(`${API_BASE_URL}/api/community/report`, {
        type: form.type,
        description: form.description,
        city: location.city,
        lat: location.lat,
        lon: location.lon,
      });

      setForm({ type: "fire", description: "" });
      alert(resp.data.message || "Report submitted successfully.");
      fetchReports();
    } catch (err) {
      console.error("Reporting error", err);
      // Fallback local save
      const newReport = {
        id: Date.now().toString(),
        type: form.type,
        description: form.description,
        timestamp: new Date().toISOString(),
        lat: location.lat,
        lon: location.lon,
        notified: false,
        city: location.city,
      };
      const saved = JSON.parse(
        localStorage.getItem(`reports_${location.city}`) || "[]",
      );
      const updated = [newReport, ...saved];
      localStorage.setItem(`reports_${location.city}`, JSON.stringify(updated));

      const valid = updated.filter((r) => {
        const rTime =
          typeof r.timestamp === "number"
            ? r.timestamp
            : new Date(r.timestamp).getTime();
        return Date.now() - rTime < 4 * 60 * 60 * 1000;
      });
      setReports(valid);
      setForm({ type: "fire", description: "" });
      alert(
        "Report saved locally. Backend unavailable — authorities will be notified when connection is restored.",
      );
    } finally {
      setLoading(false);
    }
  };

  const getEmoji = (type) => {
    switch (type) {
      case "fire":
        return "🔥";
      case "dust":
        return "💨";
      case "smoke":
        return "🏭";
      case "smell":
        return "🤢";
      default:
        return "⚠️";
    }
  };

  const downloadReportPDF = (report) => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(0, 180, 216);
    doc.text("EcoStride - Community Report", 20, 20);

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);

    doc.setDrawColor(0, 180, 216);
    doc.line(20, 35, 190, 35);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Report Type: ${report.type.toUpperCase()}`, 20, 50);
    doc.text(`City: ${location.city}`, 20, 60);
    doc.text(
      `Location: ${report.lat.toFixed(4)}, ${report.lon.toFixed(4)}`,
      20,
      70,
    );
    doc.text(`Time: ${new Date(report.timestamp).toLocaleString()}`, 20, 80);

    doc.setFontSize(12);
    doc.text("Description:", 20, 95);
    const splitDescription = doc.splitTextToSize(
      report.description || "No description provided.",
      150,
    );
    doc.text(splitDescription, 20, 105);

    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "ECOSTRIDE: Environmental Health & Safe Routing Platform",
      20,
      280,
    );

    doc.save(`EcoStride_Report_${report.id}.pdf`);
  };

  return (
    <div className="grid grid-cols-12">
      {/* ── Community Messages ── */}
      <div className="col-span-12 card" style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start", // Align button to the top
            gap: "16px", // Add spacing between heading and button
            marginBottom: "16px",
          }}
        >
          <div style={{ flex: 1 }}>
            <h2 style={{ marginBottom: "4px" }}>
              📢 Community Announcements & Messages
            </h2>
            <p className="text-muted" style={{ margin: 0 }}>
              Important updates and community discussions.
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowMessageForm(!showMessageForm)}
            style={{
              padding: "8px 16px",
              fontSize: "0.9rem",
              whiteSpace: "nowrap",
              flexShrink: 0,
              lineHeight: 1.2,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {showMessageForm ? "Cancel" : "+ Post Message"}
          </button>
        </div>

        {showMessageForm && (
          <form
            onSubmit={handleMsgSubmit}
            style={{
              marginBottom: "24px",
              padding: "20px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "0.9rem",
                  color: "var(--text-secondary)",
                }}
              >
                Title
              </label>
              <input
                type="text"
                placeholder="E.g., Road Blockage on Main St"
                value={msgForm.title}
                onChange={(e) =>
                  setMsgForm({ ...msgForm, title: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                }}
                required
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "0.9rem",
                  color: "var(--text-secondary)",
                }}
              >
                Message
              </label>
              <textarea
                rows="3"
                placeholder="Share more details with the community..."
                value={msgForm.content}
                onChange={(e) =>
                  setMsgForm({ ...msgForm, content: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                }}
                required
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={msgLoading}
              >
                {msgLoading ? "Posting..." : "Post Message"}
              </button>
            </div>
          </form>
        )}

        {messagesLoading ? (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                border: "3px solid var(--border)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
                margin: "0 auto",
              }}
            />
          </div>
        ) : communityMessages.length === 0 ? (
          <p className="text-muted" style={{ padding: "16px" }}>
            No active announcements at this time.
          </p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {communityMessages.map((msg) => {
              const createdAt = new Date(msg.createdAt);
              const expiresAt = new Date(msg.expiresAt);

              return (
                <div
                  key={msg.id}
                  style={{
                    padding: "16px",
                    background:
                      "linear-gradient(135deg, rgba(0,229,160,0.08) 0%, rgba(102,126,234,0.08) 100%)",
                    border: "1px solid rgba(0,229,160,0.2)",
                    borderRadius: "10px",
                    borderLeft: "4px solid var(--accent)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "8px",
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 4px 0",
                        color: "var(--text-primary)",
                      }}
                    >
                      {msg.title}
                    </h3>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        marginLeft: "12px",
                      }}
                    >
                      Posted: {createdAt.toLocaleDateString()}{" "}
                      {createdAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      color: "var(--text-secondary)",
                      lineHeight: "1.6",
                    }}
                  >
                    {msg.content}
                  </p>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      paddingTop: "8px",
                      borderTop: "1px solid rgba(0,229,160,0.1)",
                    }}
                  >
                    Expires: {expiresAt.toLocaleDateString()}{" "}
                    {expiresAt.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Reports List ── */}
      <div className="col-span-8 card">
        <h2>Community Reports in {location.city}</h2>
        <p className="text-muted" style={{ marginBottom: "24px" }}>
          Live pollution reports from the community. Auto-expires after 4 hours.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {reports.length === 0 && (
            <span className="text-muted">
              No recent reports in your area. You're breathing clean!
            </span>
          )}

          {reports.map((r) => (
            <div
              key={r.id}
              style={{
                padding: "16px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "1.5rem" }}>{getEmoji(r.type)}</span>
                <strong style={{ textTransform: "capitalize" }}>
                  {r.type} Detected
                </strong>
                {r.notified && (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontFamily: "var(--font-mono)",
                      background: "rgba(0,229,160,0.12)",
                      color: "#00e5a0",
                      border: "1px solid rgba(0,229,160,0.2)",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    NOTIFIED
                  </span>
                )}
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    marginLeft: "auto",
                  }}
                >
                  {new Date(r.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                {r.description || "No description provided."}
              </p>
              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => downloadReportPDF(r)}
                  className="btn-secondary"
                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                >
                  📥 Download PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Report Form (commented out) ── */}
      {/* <div className="col-span-4 card">
        <h3 style={{ marginBottom: "16px" }}>Report an Issue</h3>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              Issue Type
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="fire">Fire / Burning (🔥)</option>
              <option value="dust">Heavy Dust (💨)</option>
              <option value="smoke">Industrial Smoke (🏭)</option>
              <option value="smell">Unusual Smell (🤢)</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
              }}
            >
              Description (optional)
            </label>
            <textarea
              rows="3"
              placeholder="E.g., Huge tire fire near the highway..."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Submitting..." : "Submit Report"}
          </button>
        </form>
      </div> */}
    </div>
  );
};

export default Community;
