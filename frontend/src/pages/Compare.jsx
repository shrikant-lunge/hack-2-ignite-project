import React, { useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import { API_BASE_URL } from "../apiConfig";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const Compare = () => {
  const [city1, setCity1] = useState("");
  const [city2, setCity2] = useState("");
  const [data1, setData1] = useState(null);
  const [data2, setData2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleCompare = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        axios.get(
          `${API_BASE_URL}/api/forecast/current?city=${encodeURIComponent(city1)}`,
        ),
        axios.get(
          `${API_BASE_URL}/api/forecast/current?city=${encodeURIComponent(city2)}`,
        ),
      ]);

      const d1 = res1.data.data;
      const d2 = res2.data.data;

      const [hist1, hist2] = await Promise.all([
        axios.post(`${API_BASE_URL}/api/forecast/predict`, {
          city: city1,
          lat: d1.lat,
          lon: d1.lon,
        }),
        axios.post(`${API_BASE_URL}/api/forecast/predict`, {
          city: city2,
          lat: d2.lat,
          lon: d2.lon,
        }),
      ]);

      d1.history = hist1.data.data.predictions.slice(0, 7).map((p) => p.aqi);
      d2.history = hist2.data.data.predictions.slice(0, 7).map((p) => p.aqi);

      setData1(d1);
      setData2(d2);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch city data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Client-side PDF (same pattern as Dashboard.jsx) ──
  const downloadComparePDF = () => {
    try {
      setPdfLoading(true);
      const doc = new jsPDF();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(0, 229, 160);
      doc.text(`EcoStride - City Comparison Report`, 20, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);

      doc.setDrawColor(0, 229, 160);
      doc.line(20, 35, 190, 35);

      // City 1 section
      doc.setFontSize(16);
      doc.setTextColor(0, 212, 255);
      doc.text(`${city1}`, 20, 50);

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`AQI: ${data1.aqi}`, 20, 60);
      doc.text(`Category: ${data1.category}`, 20, 70);
      doc.text(`Station: ${data1.source || "Local Sensor"}`, 20, 80);

      // City 1 pollutants table
      doc.setFontSize(12);
      doc.text(`Pollutant Breakdown — ${city1}:`, 20, 92);
      autoTable(doc, {
        head: [["Pollutant", "Value", "Unit"]],
        body: [
          ["PM2.5", data1.pm2_5 ?? "N/A", "µg/m³"],
          ["PM10", data1.pm10 ?? "N/A", "µg/m³"],
          ["NO2", data1.no2 ?? "N/A", "µg/m³"],
          ["O3", data1.o3 ?? "N/A", "µg/m³"],
          ["SO2", data1.so2 ?? "N/A", "µg/m³"],
          ["CO", data1.co ?? "N/A", "mg/m³"],
        ],
        startY: 97,
        theme: "grid",
        headStyles: { fillColor: [0, 212, 255], textColor: [8, 13, 15] },
      });

      // City 2 section — placed below city 1 table
      const afterTable1 = doc.lastAutoTable.finalY + 12;

      doc.setFontSize(16);
      doc.setTextColor(139, 92, 246);
      doc.text(`${city2}`, 20, afterTable1);

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`AQI: ${data2.aqi}`, 20, afterTable1 + 10);
      doc.text(`Category: ${data2.category}`, 20, afterTable1 + 20);
      doc.text(
        `Station: ${data2.source || "Local Sensor"}`,
        20,
        afterTable1 + 30,
      );

      // City 2 pollutants table
      doc.setFontSize(12);
      doc.text(`Pollutant Breakdown — ${city2}:`, 20, afterTable1 + 42);
      autoTable(doc, {
        head: [["Pollutant", "Value", "Unit"]],
        body: [
          ["PM2.5", data2.pm2_5 ?? "N/A", "µg/m³"],
          ["PM10", data2.pm10 ?? "N/A", "µg/m³"],
          ["NO2", data2.no2 ?? "N/A", "µg/m³"],
          ["O3", data2.o3 ?? "N/A", "µg/m³"],
          ["SO2", data2.so2 ?? "N/A", "µg/m³"],
          ["CO", data2.co ?? "N/A", "mg/m³"],
        ],
        startY: afterTable1 + 47,
        theme: "grid",
        headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255] },
      });

      // Summary winner line
      const afterTable2 = doc.lastAutoTable.finalY + 10;
      const aqi1 = data1?.aqi ?? 999;
      const aqi2 = data2?.aqi ?? 999;
      const winner =
        aqi1 < aqi2
          ? `${city1} has better air quality (AQI ${aqi1} vs ${aqi2})`
          : aqi2 < aqi1
            ? `${city2} has better air quality (AQI ${aqi2} vs ${aqi1})`
            : "Both cities have equal air quality";

      doc.setFontSize(12);
      doc.setTextColor(0, 229, 160);
      doc.text(`Summary: ${winner}`, 20, afterTable2);

      // Footer
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "ECOSTRIDE: Environmental Health & Safe Routing Platform",
        20,
        doc.internal.pageSize.height - 10,
      );

      doc.save(`EcoStride_Compare_${city1}_vs_${city2}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      alert("PDF generation failed. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  const chartData = {
    labels: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Today"],
    datasets: [
      {
        label: city1,
        data: data1 ? [...data1.history].reverse() : [],
        borderColor: "rgba(0, 212, 255, 1)",
        backgroundColor: "transparent",
        tension: 0.4,
      },
      {
        label: city2,
        data: data2 ? [...data2.history].reverse() : [],
        borderColor: "rgba(139, 92, 246, 1)",
        backgroundColor: "transparent",
        tension: 0.4,
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* ── Header ── */}
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
          <h1>Compare Cities</h1>
          <p className="text-muted">
            Compare real-time air quality metrics between any two cities.
          </p>
        </div>
        {data1 && data2 && (
          <button
            onClick={downloadComparePDF}
            className="btn-primary"
            style={{ height: "fit-content" }}
            disabled={pdfLoading}
          >
            {pdfLoading ? "⏳ Generating..." : "📥 Download PDF Report"}
          </button>
        )}
      </div>

      {/* ── Input Form ── */}
      <div className="card">
        <form
          onSubmit={handleCompare}
          style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}
        >
          <div style={{ flex: 1 }}>
            <label className="text-muted">City 1</label>
            <input
              value={city1}
              onChange={(e) => setCity1(e.target.value)}
              placeholder="Enter City 1"
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="text-muted">City 2</label>
            <input
              value={city2}
              onChange={(e) => setCity2(e.target.value)}
              placeholder="Enter City 2"
              required
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ height: "46px", width: "120px" }}
          >
            {loading ? "Loading..." : "Compare"}
          </button>
        </form>
      </div>

      {/* ── Results Grid ── */}
      {data1 && data2 && (
        <div className="grid grid-cols-12">
          {/* City 1 */}
          <div
            className="card col-span-4"
            style={{ borderTop: "4px solid rgba(0, 212, 255, 1)" }}
          >
            <h2 style={{ color: "var(--accent-cyan)" }}>{city1}</h2>
            <div
              style={{
                fontSize: "3rem",
                fontWeight: "bold",
                color: aqiColor(data1.aqi),
              }}
            >
              {data1.aqi}
            </div>
            <div style={{ marginBottom: "16px" }}>{data1.category}</div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>PM2.5</span>
                <span>{data1.pm2_5}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>PM10</span>
                <span>{data1.pm10}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>NO2</span>
                <span>{data1.no2}</span>
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="card col-span-4">
            <h3 style={{ marginBottom: "16px", textAlign: "center" }}>
              7-Day Trend
            </h3>
            <div style={{ height: 200 }}>
              <Line
                data={chartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "bottom" } },
                }}
              />
            </div>
          </div>

          {/* City 2 */}
          <div
            className="card col-span-4"
            style={{ borderTop: "4px solid rgba(139, 92, 246, 1)" }}
          >
            <h2 style={{ color: "var(--accent-purple)" }}>{city2}</h2>
            <div
              style={{
                fontSize: "3rem",
                fontWeight: "bold",
                color: aqiColor(data2.aqi),
              }}
            >
              {data2.aqi}
            </div>
            <div style={{ marginBottom: "16px" }}>{data2.category}</div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>PM2.5</span>
                <span>{data2.pm2_5}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>PM10</span>
                <span>{data2.pm10}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>NO2</span>
                <span>{data2.no2}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Compare;
