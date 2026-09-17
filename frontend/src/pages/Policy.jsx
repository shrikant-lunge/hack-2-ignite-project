import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from '../hooks/useLocation';

import { API_BASE_URL } from '../apiConfig';


const Policy = () => {
  const { location } = useLocation();
  const [scenarios, setScenarios] = useState({});
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/policy/scenarios?lat=${location.lat}&lon=${location.lon}&city=${location.city}`);

        setScenarios(res.data.scenarios);
      } catch(err) {
        console.error(err);
      }
    };
    if (!location.loading) fetchScenarios();
  }, [location]);

  const togglePolicy = (key) => {
    if (selected.includes(key)) setSelected(selected.filter(k => k !== key));
    else setSelected([...selected, key]);
  };

  const simulate = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/policy/simulate`, {

        policies: selected,
        lat: location.lat, lon: location.lon, city: location.city
      });
      setResult(res.data.impact);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (location.loading) return <div className="card">Loading...</div>;

  return (
    <div className="grid grid-cols-12">
      <div className="col-span-8 card">
        <h2>Detected Local Scenarios for {location.city}</h2>
        <p className="text-muted" style={{marginBottom:'16px', color: 'var(--text-secondary)'}}>
          These policies are dynamically generated based on industries detected in {location.city}'s OS map.
        </p>
        
        <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
          {Object.keys(scenarios).length === 0 && <span className="text-muted">No specific industries detected. Fallback policies active.</span>}
          {Object.entries(scenarios).map(([k,v]) => (
            <div key={k} 
                 onClick={() => togglePolicy(k)}
                 style={{
                   padding:'16px', background: selected.includes(k) ? 'rgba(0,212,255,0.1)' : 'var(--bg-tertiary)',
                   border: selected.includes(k) ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                   borderRadius:'12px', cursor:'pointer', transition:'all 0.2s'
                 }}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                 <strong style={{color: selected.includes(k) ? 'var(--accent-cyan)' : 'var(--text-primary)'}}>{v.name}</strong>
                 <span style={{fontSize:'0.8rem', background:'var(--bg-glass)', padding:'4px 8px', borderRadius:'12px'}}>Difficulty: {v.difficulty_score}/10</span>
               </div>
               <div style={{fontSize:'0.85rem', color:'var(--text-secondary)', marginTop:'8px'}}>{v.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-4 card">
        <h2>Simulation Details</h2>
        <button className="btn-primary" style={{width:'100%', marginTop:'16px', marginBottom:'24px'}} onClick={simulate} disabled={loading || selected.length===0}>
          {loading ? 'Simulating...' : 'Run Simulation'}
        </button>

        {result && (
          <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
            <div className="stat-card">
              <div className="stat-label">Projected AQI Drop</div>
              <div className="stat-value" style={{color:'var(--aqi-good)'}}>{result.aqi_reduction} pts</div>
              <div style={{fontSize:'0.8rem', color: 'var(--text-secondary)'}}>New AQI: {result.simulated.aqi} (was {result.baseline.aqi})</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pollutant Improvement</div>
              <div className="stat-value" style={{color:'var(--accent-cyan)'}}>{result.percent_improved}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Health Benefit Factor</div>
              <div className="stat-value" style={{color:'var(--accent-purple)'}}>+{result.health_benefits_percent}%</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Policy;
