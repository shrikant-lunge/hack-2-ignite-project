import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from '../hooks/useLocation';
import MapWidget from '../components/MapWidget';

import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { API_BASE_URL } from '../apiConfig';
import { Leaf, AlertTriangle } from 'lucide-react';

const getAvoidBadgeStyle = (aqi) => {
  if (aqi <= 100) return {
    bg: 'rgba(245,197,66,0.12)', color: '#f5c542', border: 'rgba(245,197,66,0.2)'
  };
  if (aqi <= 150) return {
    bg: 'rgba(255,140,66,0.12)', color: '#ff8c42', border: 'rgba(255,140,66,0.2)'
  };
  return {
    bg: 'rgba(255,79,107,0.12)', color: '#ff4f6b', border: 'rgba(255,79,107,0.2)'
  };
};

const SafeZones = () => {
  const { location } = useLocation();
  const [pins, setPins] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSafeData = async () => {
      setLoading(true);
      try {
        const [pinsRes, forecastRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/map/pins?lat=${location.lat}&lon=${location.lon}&city=${location.city}`),
          axios.post(`${API_BASE_URL}/api/forecast/predict`, {
            lat: location.lat, lon: location.lon, city: location.city
          })
        ]);

        let fetchedPins = pinsRes.data.pins || [];
        fetchedPins.sort((a, b) => a.aqi - b.aqi);
        setPins(fetchedPins);

        setForecast(forecastRes.data.data.predictions.slice(0, 24) || []);
      } catch (e) {
        console.error("Safe zones fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    if (!location.loading) fetchSafeData();
  }, [location]);

  if (location.loading || loading) return <div className="card skeleton" style={{ height: 400 }}>Loading Safe Zones...</div>;

  const bestZones = pins.slice(0, 5);
  const worstZones = [...pins].sort((a, b) => b.aqi - a.aqi).slice(0, 5);

  const chartData = {
    labels: forecast.map(f => f.timestamp.split(' ')[2]), // just time
    datasets: [{
      label: 'Predicted AQI (Next 24h)',
      data: forecast.map(f => f.aqi),
      borderColor: '#00e5a0',
      backgroundColor: 'rgba(0,229,160,0.06)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
      fill: 'origin'
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111b1e',
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        bodyColor: '#00e5a0',
        bodyFont: { family: 'DM Mono', size: 12 }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.03)' },
        ticks: { color: '#3d5a64', font: { family: 'DM Mono', size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.03)' },
        ticks: { color: '#3d5a64', font: { family: 'DM Mono', size: 10 } }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Safe Zones in {location.city}
          <span style={{ background: 'rgba(0,229,160,0.12)', color: '#00e5a0', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', borderRadius: '999px', padding: '0.2rem 0.6rem', letterSpacing: '0.05em' }}>LIVE</span>
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.06em', margin: 0, marginTop: '4px' }}>
          FIND THE BEST PLACES FOR OUTDOOR ACTIVITIES TODAY.
        </p>
      </div>

      {/* ── 50/50 Dual Pane Layout ── */}
      <div className="safezones-layout">

        {/* Left: Sticky Map */}
        <div className="map-panel">
          <MapWidget lat={location.lat} lon={location.lon} city={location.city} showHeatmap={false} />
        </div>

        {/* Right: Scrollable Content */}
        <div className="content-panel">

          {/* Best Places */}
          <div className="card best-places-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Leaf size={16} color="var(--accent)" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Best Places to be Today</span>
            </div>

            {bestZones.length > 0 ? bestZones.map((z, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0', borderBottom: i === bestZones.length - 1 ? 'none' : '1px solid var(--border)', transition: '0.15s' }}
                className="safezone-row-hover"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.borderRadius = '6px'; e.currentTarget.style.paddingLeft = '0.5rem'; e.currentTarget.style.paddingRight = '0.5rem'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '0'; e.currentTarget.style.paddingRight = '0'; }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: window.innerWidth <= 768 ? '0.82rem' : '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{z.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{z.category}</span>
                </div>
                <div style={{ background: 'rgba(0,229,160,0.12)', color: '#00e5a0', border: '1px solid rgba(0,229,160,0.2)', padding: '0.25rem 0.65rem', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: window.innerWidth <= 768 ? '0.68rem' : '0.75rem', fontWeight: 500 }}>
                  AQI {z.aqi}
                </div>
              </div>
            )) : <div className="text-muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>No data available.</div>}
          </div>

          {/* Avoid These Areas */}
          <div className="card avoid-areas-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <AlertTriangle size={16} color="var(--aqi-moderate)" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--aqi-moderate)' }}>Avoid These Areas</span>
            </div>

            {worstZones.length > 0 ? worstZones.map((z, i) => {
              const bgStyle = getAvoidBadgeStyle(z.aqi);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0', borderBottom: i === worstZones.length - 1 ? 'none' : '1px solid var(--border)', transition: '0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.borderRadius = '6px'; e.currentTarget.style.paddingLeft = '0.5rem'; e.currentTarget.style.paddingRight = '0.5rem'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '0'; e.currentTarget.style.paddingRight = '0'; }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: window.innerWidth <= 768 ? '0.82rem' : '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{z.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{z.category}</span>
                  </div>
                  <div style={{ background: bgStyle.bg, color: bgStyle.color, border: `1px solid ${bgStyle.border}`, padding: '0.25rem 0.65rem', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: window.innerWidth <= 768 ? '0.68rem' : '0.75rem', fontWeight: 500 }}>
                    AQI {z.aqi}
                  </div>
                </div>
              )
            }) : <div className="text-muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>No data available.</div>}
          </div>

          {/* Chart */}
          <div className="card chart-card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Best Time Outside (Next 24h)</h3>
            <div>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
export default SafeZones;
