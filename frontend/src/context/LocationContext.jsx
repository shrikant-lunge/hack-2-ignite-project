import React, { createContext, useContext, useState, useEffect } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const LocationContext = createContext();

export const LocationProvider = ({ children }) => {

  const [showPrompt, setShowPrompt] = useState(false);

  const [location, setLocation] = useState({
    city: localStorage.getItem('userCity') || '',
    state: localStorage.getItem('userState') || '',
    lat: parseFloat(localStorage.getItem('userLat')) || null,
    lon: parseFloat(localStorage.getItem('userLon')) || null,
    loading: true
  });

  const getGPS = () => {

    setShowPrompt(false);

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    };

    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported or blocked by this browser.");
      setLocation(prev => ({ ...prev, loading: false }));
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {

      const { latitude, longitude } = pos.coords;

      try {

        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );

        const geo = await res.json();

        console.log("Full Address:", geo.address);

        const addr = geo.address || {};

        // Detect the most specific location available
        const city =
          addr.village ||
          addr.hamlet ||
          addr.locality ||
          addr.suburb ||
          addr.neighbourhood ||
          addr.town ||
          addr.city ||
          addr.county ||
          geo.display_name?.split(',')[0] ||
          "Current Location";

        const state = addr.state || '';

        const newLocation = {
          city,
          state,
          lat: latitude,
          lon: longitude,
          loading: false
        };

        setLocation(newLocation);

        localStorage.setItem('userCity', city);
        localStorage.setItem('userState', state);
        localStorage.setItem('userLat', latitude);
        localStorage.setItem('userLon', longitude);

      } catch (e) {

        console.error("Reverse geocoding failed:", e);

        setLocation({
          city: "Current Location",
          state: "",
          lat: latitude,
          lon: longitude,
          loading: false
        });

      }

    }, (err) => {

      console.warn("Geolocation Error:", err.message);

      setLocation(prev => ({ ...prev, loading: false }));

      setShowPrompt(true);

    }, geoOptions);

  };

  useEffect(() => {

    // Always try to get GPS when app loads
    getGPS();

  }, []);

  const setManualLocation = (city, state, lat, lon) => {

    const newLocation = { city, state, lat, lon, loading: false };

    setLocation(newLocation);

    localStorage.setItem('userCity', city);
    localStorage.setItem('userState', state);
    localStorage.setItem('userLat', lat);
    localStorage.setItem('userLon', lon);

  };

  return (
    <LocationContext.Provider value={{ location, setManualLocation, getGPS }}>
      {children}

      {showPrompt && (
        <div style={{
          position:'fixed',
          top:0,left:0,right:0,bottom:0,
          background:'rgba(0,0,0,0.8)',
          zIndex:9999,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          backdropFilter:'blur(8px)'
        }}>
          <div style={{
            maxWidth:'400px',
            textAlign:'center',
            padding:'32px',
            background:'#fff',
            borderRadius:'12px',
            color: '#111'
          }}>
            <div style={{fontSize:'3rem', marginBottom:'16px'}}>📍</div>
            <h2 style={{marginBottom:'12px'}}>Enable GPS Access</h2>
            <p style={{marginBottom:'24px', color: '#666'}}>
              EcoStride needs your location to provide real-time AQI data and safe environmental routing.
            </p>

            <div style={{display:'flex', gap:'12px'}}>
              <button 
                onClick={getGPS} 
                style={{
                  flex:1, 
                  padding:'12px', 
                  background:'linear-gradient(135deg, #00d4ff, #0066ff)', 
                  color:'#fff', 
                  border:'none', 
                  borderRadius:'8px', 
                  fontWeight:'600',
                  cursor:'pointer'
                }}
              >
                Allow Access
              </button>
              <button 
                onClick={() => setShowPrompt(false)} 
                style={{
                  flex:1, 
                  padding:'12px', 
                  background:'#f1f5f9', 
                  color:'#475569', 
                  border:'none', 
                  borderRadius:'8px', 
                  fontWeight:'600',
                  cursor:'pointer'
                }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

    </LocationContext.Provider>
  );
};
