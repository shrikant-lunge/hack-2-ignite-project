import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useLocation } from "../hooks/useLocation";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  CloudRain,
  Route,
  ShieldAlert,
  Heart,
  DivideSquare,
  Users,
  Search,
  MapPin,
  LogOut,
  User,
} from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "../apiConfig";
import ThemeToggle from "./ThemeToggle";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", sub: "Live AQI" },
  { to: "/dashboard/forecast", icon: CloudRain, label: "Forecast", sub: "72-Hour" },
  { to: "/dashboard/routing", icon: Route, label: "Routing", sub: "Eco Routes" },
  { to: "/dashboard/policy", icon: ShieldAlert, label: "Policy", sub: "Simulation" },
  { to: "/dashboard/safe-zones", icon: Heart, label: "Safe Zones", sub: "Clean Areas" },
  { to: "/dashboard/compare", icon: DivideSquare, label: "Compare", sub: "Cities" },
  { to: "/dashboard/community", icon: Users, label: "Community", sub: "Reports" },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const { location, setManualLocation, getGPS } = useLocation();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [alertForm, setAlertForm] = useState({ contact: "", threshold: 100 });
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length > 2) {
      try {
        const res = await axios.get(
          `https://nominatim.openstreetmap.org/search?q=${query}, India&format=json&limit=5`,
        );
        setSearchResults(res.data);
      } catch (err) {
        console.error(err);
      }
    } else {
      setSearchResults([]);
    }
  };

  const selectCity = (city) => {
    const lat = parseFloat(city.lat);
    const lon = parseFloat(city.lon);
    const name = city.display_name.split(",")[0];
    setManualLocation(name, "India", lat, lon);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!alertForm.contact) return;
    setAlertLoading(true);
    setAlertMessage("");
    try {
      const res = await axios.post(`${API_BASE_URL}/api/alerts/subscribe`, {
        contact: alertForm.contact,
        threshold: alertForm.threshold,
        city: location.city,
        lat: location.lat,
        lon: location.lon,
      });
      setAlertMessage(res.data.message || "Subscribed!");
      setAlertForm({ contact: "", threshold: 100 });
    } catch {
      setAlertMessage("Error subscribing.");
    } finally {
      setAlertLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleProfileSetup = () => {
    navigate("/profile-setup");
  };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">🌿</div>
          Eco<span>Stride</span>
        </div>

        {/* User Profile Section */}
        {user && (
          <div className="sidebar-user-section">
            <button
              className="user-profile-btn"
              onClick={() => setShowUserMenu(!showUserMenu)}
              title={user.name}
            >
              <div className="user-avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</div>
              <div className="user-info">
                <div className="user-name">{user.name}</div>
                <div className="user-email">{user.email}</div>
              </div>
            </button>

            {showUserMenu && (
              <div className="user-dropdown-menu">
                <button
                  className="user-dropdown-item"
                  onClick={() => {
                    handleProfileSetup();
                    setShowUserMenu(false);
                  }}
                >
                  <User size={16} />
                  <span>Edit Profile</span>
                </button>
                <div className="user-dropdown-divider"></div>
                <button
                  className="user-dropdown-item logout"
                  onClick={() => {
                    handleLogout();
                    setShowUserMenu(false);
                  }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
                <div className="user-dropdown-divider"></div>
                <div style={{ padding: "8px 12px", display: "flex", justifyContent: "center" }}>
                  <ThemeToggle style={{ width: "100%", padding: "6px" }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live strip */}
        <div className="sidebar-live-strip">
          <span className="live-dot" />
          <span className="live-label">LIVE</span>
          <span className="live-city">{location.city || "Locating…"}</span>
        </div>

        {/* City search */}
        <div className="sidebar-search-wrap" style={{ position: "relative" }}>
          <Search
            size={13}
            className="sidebar-search-icon"
            style={{ top: "18px", transform: "none" }}
          />
          <input
            type="text"
            placeholder="Search city…"
            value={searchQuery}
            onChange={handleSearch}
            className="input"
            style={{
              paddingLeft: "32px",
              paddingRight: "32px",
              height: "36px",
              fontSize: "0.82rem",
            }}
          />
          <button
            type="button"
            className="sidebar-gps-btn"
            onClick={getGPS}
            title="My Location"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#34A853">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5z" />
            </svg>
          </button>
          {searchResults.length > 0 && (
            <div className="sidebar-dropdown">
              {searchResults.map((res) => (
                <div
                  key={res.place_id}
                  className="sidebar-dropdown-item"
                  onClick={() => selectCity(res)}
                >
                  {res.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, icon: Icon, label, sub }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <Icon size={17} className="nav-item-icon" />
              <span className="nav-item-text">
                <span className="nav-item-label">{label}</span>
                <span className="nav-item-sub">{sub}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Alert widget (desktop only) */}
        {!window.matchMedia("(max-width: 768px)").matches && (
          <form
            onSubmit={handleSubscribe}
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(245,197,66,0.15)",
              borderRadius: "8px",
              padding: "0.75rem",
              margin: "12px",
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                color: "var(--aqi-moderate)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              🔔 AQI Alerts
            </div>
            <input
              type="text"
              placeholder="Email or phone"
              value={alertForm.contact}
              onChange={(e) =>
                setAlertForm({ ...alertForm, contact: e.target.value })
              }
              className="input"
              style={{
                padding: "6px 10px",
                fontSize: "0.75rem",
                height: "auto",
              }}
              required
            />
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.7rem",
                  fontFamily: "var(--font-mono)",
                }}
              >
                AQI &gt;
              </span>
              <select
                value={alertForm.threshold}
                onChange={(e) =>
                  setAlertForm({
                    ...alertForm,
                    threshold: parseInt(e.target.value),
                  })
                }
                className="input"
                style={{
                  padding: "4px 6px",
                  fontSize: "0.75rem",
                  height: "auto",
                  flex: 1,
                }}
              >
                <option value="50">50 — Mod</option>
                <option value="100">100 — Unhealthy</option>
                <option value="150">150 — Poor</option>
              </select>
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: "6px", fontSize: "0.7rem", width: "100%" }}
              disabled={alertLoading}
            >
              {alertLoading ? "Wait…" : "Subscribe"}
            </button>
            {alertMessage && (
              <div
                style={{
                  color: "var(--accent)",
                  fontSize: "0.65rem",
                  textAlign: "center",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {alertMessage}
              </div>
            )}
          </form>
        )}
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="mobile-bottom-nav">
        {NAV_ITEMS.slice(0, 5).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `mobile-nav-item${isActive ? " active" : ""}`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
};

export default Sidebar;
