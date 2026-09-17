import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation } from "../hooks/useLocation";

import { Line } from "react-chartjs-2";
import "chart.js/auto";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE_URL } from "../apiConfig";

const Predict = () => {
  const { location } = useLocation();
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        setLoading(true);
        const res = await axios.post(`${API_BASE_URL}/api/forecast/predict`, {
          lat: location.lat,
          lon: location.lon,
          city: location.city,
        });
        setForecast(res.data.data.predictions || []);
      } catch (err) {
        console.error("Forecast fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    if (!location.loading) fetchForecast();
  }, [location]);

  if (location.loading || loading)
    return (
      <div className="card skeleton" style={{ height: 400 }}>
        Loading 72h Forecast...
      </div>
    );

  const chartData = {
    labels: forecast.map((f) => f.timestamp),
    datasets: [
      {
        label: "72-Hour AQI Forecast",
        data: forecast.map((f) => f.aqi),
        borderColor: "#00e5a0",
        backgroundColor: "rgba(0,229,160,0.06)",
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointBackgroundColor: "#00e5a0",
      },
    ],
  };

  const aqiColor = (aqi) => {
    if (aqi <= 50) return "var(--aqi-good)";
    if (aqi <= 100) return "var(--aqi-moderate)";
    if (aqi <= 150) return "var(--aqi-unhealthy-sg)";
    if (aqi <= 200) return "var(--aqi-unhealthy)";
    return "var(--aqi-very-unhealthy)";
  };

  // ── Light-theme PDF (logic unchanged, only colors changed) ──
  const downloadForecastPDF = () => {
    setPdfLoading(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const now = new Date();

      // ── Header background — light green strip ──
      doc.setFillColor(236, 253, 245); // light mint
      doc.rect(0, 0, pageW, 40, "F");

      // ── Brand name ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(5, 120, 85); // deep green
      doc.text("EcoStride", 14, 16);

      // ── Report title ──
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 60, 50); // dark green-grey
      doc.text("AQI Forecast Report — 72 Hours", 14, 24);

      // ── City and timestamp ──
      doc.setFontSize(9);
      doc.setTextColor(80, 110, 100); // muted green-grey
      doc.text(
        `City: ${location?.city || "Unknown"} · Generated: ${now.toLocaleString()}`,
        14,
        32,
      );

      // ── Divider line ──
      doc.setDrawColor(5, 150, 105); // green
      doc.setLineWidth(0.5);
      doc.line(14, 38, pageW - 14, 38);

      // ── Section heading ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 40, 35); // near-black
      doc.text("72-Hour AQI Predictions", 14, 52);

      // ── Build table rows (logic unchanged) ──
      const rows = forecast.map((f, i) => {
        const aqi = f.aqi ?? f.predicted_aqi ?? 0;
        let category = "Good";
        if (aqi > 50 && aqi <= 100) category = "Moderate";
        if (aqi > 100 && aqi <= 150) category = "Unhealthy for Sensitive";
        if (aqi > 150 && aqi <= 200) category = "Unhealthy";
        if (aqi > 200 && aqi <= 300) category = "Very Unhealthy";
        if (aqi > 300) category = "Hazardous";
        return [i + 1, f.timestamp || f.time || `Hour +${i}`, aqi, category];
      });

      // ── Table — light theme ──
      autoTable(doc, {
        startY: 58,
        head: [["#", "Timestamp", "AQI", "Category"]],
        body: rows,
        theme: "grid",
        headStyles: {
          fillColor: [5, 150, 105], // green header
          textColor: [255, 255, 255], // white text
          fontStyle: "bold",
          fontSize: 9,
          lineColor: [5, 120, 85],
          lineWidth: 0.3,
        },
        bodyStyles: {
          fillColor: [255, 255, 255], // white rows
          textColor: [30, 40, 35], // near-black text
          fontSize: 8.5,
          lineColor: [210, 230, 220], // light green border
          lineWidth: 0.2,
        },
        alternateRowStyles: {
          fillColor: [240, 253, 247], // very light mint alternate rows
        },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 60 },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 70 },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          // Color AQI cell by severity (logic unchanged)
          if (data.column.index === 2 && data.section === "body") {
            const val = Number(data.cell.raw);
            if (val <= 50)
              data.cell.styles.textColor = [4, 120, 87]; // green
            else if (val <= 100)
              data.cell.styles.textColor = [161, 98, 7]; // amber
            else if (val <= 150)
              data.cell.styles.textColor = [194, 65, 12]; // orange
            else if (val <= 200)
              data.cell.styles.textColor = [185, 28, 28]; // red
            else data.cell.styles.textColor = [109, 40, 217]; // purple
          }
        },
      });

      // ── Footer ──
      const finalY = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(8);
      doc.setTextColor(100, 130, 120);
      doc.text(
        "EcoStride · Environmental Health & Safe Routing Platform · Data sourced from CPCB / OpenWeatherMap",
        14,
        finalY,
      );

      // ── Save (logic unchanged) ──
      doc.save(
        `EcoStride_Forecast_${location?.city || "report"}_${now.toISOString().slice(0, 10)}.pdf`,
      );
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF generation failed. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  // Summary cards: every 6th prediction (12 cards for 72h)
  const summaryCards = forecast.filter((_, i) => i % 6 === 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        overflowY: "auto",
        maxHeight: "calc(100vh - 90px)",
        paddingBottom: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div>
          <h1>AQI Forecast Model (72h)</h1>
          <p className="text-muted">
            Predictive air quality trends for {location.city}.
          </p>
        </div>
        <button
          onClick={downloadForecastPDF}
          className="btn-primary"
          style={{ height: "fit-content" }}
          disabled={pdfLoading}
        >
          {pdfLoading ? "⏳ Generating..." : "📥 Download PDF Report"}
        </button>
      </div>

      <div className="card" style={{ height: "400px" }}>
        <Line
          data={chartData}
          options={{
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
                ticks: {
                  color: "#3d5a64",
                  font: { family: "DM Mono", size: 10 },
                },
              },
              y: {
                grid: { color: "rgba(255,255,255,0.03)" },
                ticks: {
                  color: "#3d5a64",
                  font: { family: "DM Mono", size: 10 },
                },
              },
            },
          }}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        {summaryCards.map((f, i) => (
          <div
            key={i}
            className="card"
            style={{
              textAlign: "center",
              flex: "1 1 140px",
              minWidth: "120px",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {f.timestamp}
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: aqiColor(f.aqi),
                margin: "8px 0",
              }}
            >
              {f.aqi}
            </div>
            <div style={{ fontSize: "0.7rem" }}>{f.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Predict;
