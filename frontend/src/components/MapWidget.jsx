import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  CircleMarker,
  Polyline,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import "leaflet.heat";
import { API_BASE_URL } from "../apiConfig";

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pulseIcon = L.divIcon({
  className: "user-location-marker",
  html: `<div style="background:#3b82f6; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px rgba(59,130,246,0.8); position:relative;">
          <div style="position:absolute; top:-4px; left:-4px; right:-4px; bottom:-4px; border:1px solid #3b82f6; border-radius:50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
         </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const aqiColor = (aqi) => {
  if (aqi <= 50) return "#00e5a0"; // Good — green
  if (aqi <= 100) return "#f5c542"; // Moderate — yellow
  if (aqi <= 150) return "#ff8c42"; // Unhealthy for Sensitive — orange
  if (aqi <= 200) return "#ff4f6b"; // Unhealthy — red
  if (aqi <= 300) return "#9b59b6"; // Very Unhealthy — purple
  return "#7b241c"; // Hazardous — dark red
};

const ROUTE_COLORS = {
  cleanest: "#00E400",
  safest: "#56CCF2",
  balanced: "#FFFF00",
  fastest: "#FF7E00",
  industrial: "#FF3333",
};

const startIcon = L.divIcon({
  className: "custom-pin",
  html: `<div style="background:#10b981; width:24px; height:24px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
          <div style="width:8px; height:8px; background:#fff; border-radius:50%; transform:rotate(45deg);"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

const endIcon = L.divIcon({
  className: "custom-pin",
  html: `<div style="background:#ef4444; width:24px; height:24px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
          <div style="width:8px; height:8px; background:#fff; border-radius:50%; transform:rotate(45deg);"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

// ── FIXED: colored fill + white border + white AQI text ──
const createAqiIcon = (aqi) => {
  const size = aqi > 200 ? 38 : aqi > 150 ? 32 : aqi > 100 ? 26 : 22;
  const bg = aqiColor(aqi);
  return L.divIcon({
    className: "", // empty — prevents .aqi-pin CSS from overriding colors
    html: `<div style="
      background: ${bg};
      color: #ffffff;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'DM Mono', monospace;
      font-size: ${size > 30 ? 11 : 9}px;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(0,0,0,0.45);
      box-sizing: border-box;
      cursor: pointer;
      transition: transform 0.2s;
    ">${aqi}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Component to center on a point — only fires ONCE on initial mount.
// After that the user can pan freely without being snapped back.
const MapController = ({ center }) => {
  const map = useMap();
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current) {
      map.setView(center, 13, { animate: true });
      didInit.current = true;
    }
  }, [center, map]);
  return null;
};

// Component to fit bounds to routes — fires once when routes first
// arrive, then never again so the user can pan/zoom freely.
const FitRoute = ({ route, allRoutes }) => {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    // Reset flag whenever a brand-new route calculation comes in
    // (detected by allRoutes changing from empty to populated)
    if (!allRoutes || allRoutes.length === 0) {
      didFit.current = false;
      return;
    }
    if (didFit.current) return; // user is panning — don't snap back

    if (route && route.geometry) {
      const coords = route.geometry.coordinates.map((c) => [c[1], c[0]]);
      if (coords.length > 0) {
        map.fitBounds(L.polyline(coords).getBounds(), {
          padding: [50, 50],
          animate: true,
        });
        didFit.current = true;
      }
    } else if (allRoutes && allRoutes.length > 0) {
      const allCoords = allRoutes
        .filter((r) => r.geometry)
        .flatMap((r) => r.geometry.coordinates.map((c) => [c[1], c[0]]));
      if (allCoords.length > 0) {
        map.fitBounds(L.polyline(allCoords).getBounds(), {
          padding: [50, 50],
          animate: true,
        });
        didFit.current = true;
      }
    }
  }, [route, allRoutes, map]);
  return null;
};

// Heatmap Layer component
const HeatmapLayer = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    const heatPoints = points.map((p) => [p.lat, p.lon, p.aqi / 200]);
    const layer = L.heatLayer(heatPoints, {
      radius: 35,
      blur: 20,
      maxZoom: 14,
    }).addTo(map);
    return () => map.removeLayer(layer);
  }, [points, map]);
  return null;
};

// Force Leaflet to recalculate its viewport size to fix blank space renders
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
};

const MapWidget = ({
  lat,
  lon,
  city,
  showHeatmap = false,
  route,
  startPin,
  endPin,
  allRoutes = [],
  userPos = null,
  onRouteSelect,
  isNavigating = false,
}) => {
  const centerLat = isNavigating && userPos ? userPos.lat : lat;
  const centerLon = isNavigating && userPos ? userPos.lon : lon;

  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPins = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `${API_BASE_URL}/api/map/pins?lat=${lat}&lon=${lon}&city=${city}`,
        );
        setPins(res.data.pins || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (lat && lon && city) fetchPins();

    const interval = setInterval(fetchPins, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [lat, lon, city]);

  if (!centerLat || !centerLon) {
    return (
      <div
        className="map-container card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="text-muted">Waiting for GPS coordinates...</div>
      </div>
    );
  }

  return (
    <div
      className="map-container"
      style={{ width: "100%", height: "100%", flex: 1, position: "relative" }}
    >
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "var(--bg-tertiary)",
            padding: "4px 12px",
            zIndex: 1000,
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          Loading Pins...
        </div>
      )}
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
      >
        <MapResizer />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO"
        />
        <MapController center={[centerLat, centerLon]} />
        <FitRoute
          route={route}
          allRoutes={allRoutes.length > 0 && !route ? allRoutes : null}
        />

        {/* User GPS point */}
        {lat && lon && (
          <Marker position={[lat, lon]} icon={pulseIcon}>
            <Popup>
              <div style={{ color: "#111", fontWeight: "bold" }}>📍 {city}</div>
            </Popup>
          </Marker>
        )}

        {/* Real-time user position */}
        {userPos && (
          <CircleMarker
            center={[userPos.lat, userPos.lon]}
            radius={10}
            pathOptions={{
              fillColor: "#3b82f6",
              color: "white",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>
              <div style={{ color: "#111" }}>
                <strong>📍 You Are Here</strong>
                <br />
                {userPos.lat.toFixed(5)}, {userPos.lon.toFixed(5)}
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* All routes */}
        {allRoutes.length > 0 &&
          allRoutes.map((r, idx) => {
            const isSelected =
              route && (route.type === r.type || route.geometry === r.geometry);
            const color = r.color || ROUTE_COLORS[r.type] || "#56CCF2";
            const coords =
              r.geometry?.coordinates?.map((c) => [c[1], c[0]]) || [];
            if (coords.length === 0) return null;

            return (
              <React.Fragment key={idx}>
                {isSelected && (
                  <Polyline
                    positions={coords}
                    color={color}
                    weight={14}
                    opacity={0.25}
                  />
                )}
                <Polyline
                  positions={coords}
                  color={color}
                  weight={isSelected ? 7 : 4}
                  opacity={isSelected ? 1 : 0.45}
                  eventHandlers={{
                    click: () => onRouteSelect && onRouteSelect(r),
                    mouseover: (e) => {
                      e.target.setStyle({
                        weight: isSelected ? 8 : 6,
                        opacity: 0.85,
                      });
                    },
                    mouseout: (e) => {
                      e.target.setStyle({
                        weight: isSelected ? 7 : 4,
                        opacity: isSelected ? 1 : 0.45,
                      });
                    },
                  }}
                />
              </React.Fragment>
            );
          })}

        {/* Start/End Pins */}
        {startPin && (
          <Marker
            position={[startPin.coords[1], startPin.coords[0]]}
            icon={startIcon}
          >
            <Popup>
              <div style={{ color: "#111" }}>
                <strong>START: {startPin.name}</strong>
                <br />
                AQI: {startPin.aqi}
              </div>
            </Popup>
          </Marker>
        )}
        {endPin && (
          <Marker
            position={[endPin.coords[1], endPin.coords[0]]}
            icon={endIcon}
          >
            <Popup>
              <div style={{ color: "#111" }}>
                <strong>FINISH: {endPin.name}</strong>
                <br />
                AQI: {endPin.aqi}
              </div>
            </Popup>
          </Marker>
        )}

        {!showHeatmap ? (
          <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
            {pins.map((pin) => (
              <Marker
                key={pin.id || pin.name}
                position={[pin.lat, pin.lon]}
                icon={createAqiIcon(pin.aqi)}
              >
                <Popup>
                  <div style={{ color: "#111" }}>
                    <h4 style={{ margin: 0 }}>{pin.name}</h4>
                    <div
                      style={{
                        background: aqiColor(pin.aqi),
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontWeight: "bold",
                        display: "inline-block",
                        marginBottom: "8px",
                        color: "#fff",
                      }}
                    >
                      AQI {pin.aqi}
                    </div>
                    <div>
                      PM2.5: {pin.pm2_5} | PM10: {pin.pm10}
                    </div>
                    <div>
                      NO₂: {pin.no2} | O₃: {pin.o3}
                    </div>
                    <div
                      style={{
                        color: "#666",
                        fontSize: "0.8rem",
                        marginTop: "4px",
                      }}
                    >
                      📍 {pin.source_type || pin.category}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        ) : (
          <HeatmapLayer points={pins} />
        )}
      </MapContainer>
    </div>
  );
};

export default MapWidget;
