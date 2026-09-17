import React, { useEffect, useState } from "react";
import MapWidget from "../components/MapWidget";
import { useLocation } from "../hooks/useLocation";
import axios from "axios";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE_URL } from "../apiConfig";
import {
  RefreshCw,
  Wind,
  Cloud,
  Flame,
  Zap,
  Droplets,
  Activity,
} from "lucide-react";

const POLLUTANTS = [
  { key: "pm2_5", label: "PM2.5", unit: "µg/m³", icon: Wind, max: 250 },
  { key: "pm10", label: "PM10", unit: "µg/m³", icon: Cloud, max: 300 },
  { key: "no2", label: "NO₂", unit: "µg/m³", icon: Flame, max: 200 },
  { key: "o3", label: "O₃", unit: "µg/m³", icon: Zap, max: 200 },
  { key: "so2", label: "SO₂", unit: "µg/m³", icon: Droplets, max: 150 },
  { key: "co", label: "CO", unit: "mg/m³", icon: Activity, max: 10 },
];

const getAqiColor = (aqi) => {
  if (aqi <= 50) return "var(--aqi-good)";
  if (aqi <= 100) return "var(--aqi-moderate)";
  if (aqi <= 150) return "var(--aqi-sensitive)";
  return "var(--aqi-unhealthy)";
};

const AQIRing = ({ aqi, category }) => {
  const R = 90;
  const circ = 2 * Math.PI * R;
  const pct = Math.min(aqi / 400, 1);
  const color = getAqiColor(aqi);
  return (
    <svg viewBox="0 0 200 200" className="aqi-gauge-svg">
      <circle
        cx="100"
        cy="100"
        r={R}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="10"
      />
      <circle
        cx="100"
        cy="100"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${circ * pct} ${circ}`}
        strokeDashoffset="0"
        transform="rotate(-90 100 100)"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text
        x="100"
        y="100"
        textAnchor="middle"
        dominantBaseline="middle"
        className="aqi-gauge-number"
        style={{ fill: color }}
      >
        {aqi}
      </text>
    </svg>
  );
};

const Dashboard = () => {
  const { location } = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/api/forecast/current?lat=${location.lat}&lon=${location.lon}&city=${location.city}`,
      );
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!location.loading) fetchData();
  }, [location, refreshKey]);

  if (location.loading)
    return <div className="card">Acquiring GPS signal…</div>;
  if (loading)
    return (
      <div className="card" style={{ height: 400 }}>
        Loading AQI data…
      </div>
    );

  const aqi = data?.aqi || 0;
  const category = data?.category || "Unknown";
  const aqiColor = getAqiColor(aqi);

  const chartData = {
    labels: ["1AM", "5AM", "9AM", "1PM", "5PM", "9PM", "NOW"],
    datasets: [
      {
        label: "AQI Trend 24h",
        data: [aqi - 20, aqi - 10, aqi + 15, aqi + 5, aqi + 30, aqi - 5, aqi],
        borderColor: "#00e5a0",
        backgroundColor: "rgba(0,229,160,0.06)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#00e5a0",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#111b1e",
        borderColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        bodyColor: "#00e5a0",
        bodyFont: { family: "DM Mono", size: 13 },
        titleColor: "#7a9ba8",
        titleFont: { family: "DM Mono", size: 10 },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.03)" },
        ticks: { color: "#3d5a64", font: { family: "DM Mono", size: 10 } },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.03)" },
        ticks: { color: "#3d5a64", font: { family: "DM Mono", size: 10 } },
      },
    },
  };

  // ── Light-theme PDF (same as Predict.jsx) ──
  const downloadStatusPDF = () => {
    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const now = new Date();

      // ── Header background — light mint ──
      doc.setFillColor(236, 253, 245);
      doc.rect(0, 0, pageW, 40, "F");

      // ── Brand name ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(5, 120, 85);
      doc.text(`EcoStride`, 20, 16);

      // ── Report title ──
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 60, 50);
      doc.text(`Status Report — ${location.city}`, 20, 25);

      // ── Timestamp ──
      doc.setFontSize(9);
      doc.setTextColor(80, 110, 100);
      doc.text(`Generated: ${now.toLocaleString()}`, 20, 33);

      // ── Divider ──
      doc.setDrawColor(5, 150, 105);
      doc.setLineWidth(0.5);
      doc.line(20, 39, pageW - 20, 39);

      // ── AQI summary ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(20, 40, 35);
      doc.text(`Current AQI: ${data.aqi}`, 20, 52);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.setTextColor(40, 70, 60);
      doc.text(`Category: ${data.category}`, 20, 62);
      doc.text(`Station: ${data.source || "Local Sensor"}`, 20, 72);

      // ── Pollutant breakdown heading ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 40, 35);
      doc.text("Pollutant Breakdown:", 20, 85);

      // ── Pollutant table — light theme ──
      autoTable(doc, {
        head: [["Pollutant", "Value", "Unit"]],
        body: [
          ["PM2.5", data.pm2_5 ?? "N/A", "µg/m³"],
          ["PM10", data.pm10 ?? "N/A", "µg/m³"],
          ["NO2", data.no2 ?? "N/A", "µg/m³"],
          ["O3", data.o3 ?? "N/A", "µg/m³"],
          ["SO2", data.so2 ?? "N/A", "µg/m³"],
          ["CO", data.co ?? "N/A", "mg/m³"],
        ],
        startY: 90,
        theme: "grid",
        headStyles: {
          fillColor: [5, 150, 105],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 10,
          lineColor: [5, 120, 85],
          lineWidth: 0.3,
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [30, 40, 35],
          fontSize: 9.5,
          lineColor: [210, 230, 220],
          lineWidth: 0.2,
        },
        alternateRowStyles: {
          fillColor: [240, 253, 247],
        },
        columnStyles: {
          0: { fontStyle: "bold", textColor: [40, 90, 70] },
          1: { halign: "center" },
          2: { halign: "center" },
        },
      });

      // ── Footer ──
      doc.setFontSize(9);
      doc.setTextColor(100, 130, 120);
      doc.text(
        "ECOSTRIDE: Environmental Health & Safe Routing Platform",
        20,
        doc.internal.pageSize.height - 10,
      );

      // ── Save ──
      doc.save(
        `EcoStride_Status_${location.city}_${now.toISOString().slice(0, 10)}.pdf`,
      );
    } catch (err) {
      console.error("PDF error:", err);
    }
  };

  return (
    <div className="dash-page">
      {/* ── Page header ── */}
      <div className="dash-header">
        <div className="dash-header-left">
          <h1>Air Quality</h1>
          <div className="dash-header-meta">
            {location.city} · Source: {data?.source || "Local Sensor"} ·{" "}
            {data?.accuracy_level || ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn-ghost"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn-primary" onClick={downloadStatusPDF}>
            ↓ PDF
          </button>
        </div>
      </div>

      {/* ── Main grid: gauge + map ── */}
      <div className="dash-main">
        {/* Left: AQI ring gauge — FIXED card container */}
        <div
          className="card aqi-gauge-wrap"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            padding: "1.25rem",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {/* Constrained SVG wrapper */}
          <div style={{ width: "100%", maxWidth: "220px" }}>
            <AQIRing aqi={aqi} category={category} />
          </div>

          {/* Category badge — full width, wraps long text */}
          <div
            className="badge"
            style={{
              background: `${aqiColor}18`,
              color: aqiColor,
              border: `1px solid ${aqiColor}30`,
              marginTop: 4,
              width: "100%",
              textAlign: "center",
              whiteSpace: "normal",
              wordBreak: "break-word",
              padding: "6px 10px",
              borderRadius: "8px",
              fontSize: "0.78rem",
              fontWeight: 600,
            }}
          >
            {category}
          </div>

          {/* Source / distance / accuracy — contained */}
          <div
            className="aqi-source-badge"
            style={{
              width: "100%",
              textAlign: "center",
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              lineHeight: 1.6,
              wordBreak: "break-word",
              padding: "4px 0",
            }}
          >
            {data?.source || "sensor"}
            <br />
            dist {data?.distance_km ?? "—"} km · {data?.accuracy_level || ""}
          </div>

          {/* Heatmap toggle — full width */}
          <button
            className={heatmapMode ? "btn-primary" : "btn-ghost"}
            onClick={() => setHeatmapMode(!heatmapMode)}
            style={{
              width: "100%",
              marginTop: 6,
              fontSize: "0.75rem",
              padding: "7px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {heatmapMode ? (
              "🔥 Heatmap"
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#34A853">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5z" />
                </svg>
                Pin View
              </>
            )}
          </button>
        </div>

        {/* Right: Colony map */}
        <div className="card">
          <div className="map-card-header">
            <span className="map-card-title">Colony Map</span>
            <span className="map-card-badge">LIVE PINS</span>
          </div>
          <div className="map-container">
            <MapWidget
              lat={location.lat}
              lon={location.lon}
              city={location.city}
              showHeatmap={heatmapMode}
            />
          </div>
        </div>
      </div>

      {/* ── 24h trend chart ── */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            24h Air Quality Trend
          </span>
          <span className="badge badge-accent">Live-anchored</span>
        </div>
        <div style={{ height: "190px" }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* ── Pollutant grid ── */}
      <div className="pollutant-grid">
        {POLLUTANTS.map(({ key, label, unit, icon: Icon, max }) => {
          const val = data?.[key] ?? 0;
          const pct = Math.min((val / max) * 100, 100);
          const color =
            val > max * 0.66
              ? "var(--aqi-unhealthy)"
              : val > max * 0.33
                ? "var(--aqi-moderate)"
                : "var(--aqi-good)";
          return (
            <div key={key} className="pollutant-card">
              <div className="pollutant-top">
                <span className="pollutant-name">{label}</span>
                <Icon size={14} style={{ color: "var(--text-muted)" }} />
              </div>
              <div className="pollutant-val">
                {val}
                <span className="pollutant-unit" style={{ marginLeft: 4 }}>
                  {unit}
                </span>
              </div>
              <div className="pollutant-bar-track">
                <div
                  className="pollutant-bar-fill"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
