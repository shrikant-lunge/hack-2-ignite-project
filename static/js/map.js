// map.js — Auralis safe routing, Amravati
// All routes are drawn simultaneously with distinct colors.
// Each route goes through genuinely different roads via AQI-zone waypoints.

const AMRAVATI_LAT = 20.9320;
const AMRAVATI_LON = 77.7523;

// Visual config per route type
const ROUTE_STYLE = {
    cleanest: { color: "#00E400", weight: 6, dashArray: null, opacity: 0.90, zIndex: 500 },
    safest: { color: "#56CCF2", weight: 5, dashArray: "10,4", opacity: 0.88, zIndex: 450 },
    balanced: { color: "#FFFF00", weight: 4, dashArray: "8,6", opacity: 0.85, zIndex: 400 },
    fastest: { color: "#FF7E00", weight: 4, dashArray: "6,8", opacity: 0.82, zIndex: 350 },
    industrial: { color: "#FF3333", weight: 5, dashArray: "3,6", opacity: 0.80, zIndex: 300 },
};

// Google Maps style markers
const PIN_ICONS = {
    start: L.divIcon({
        className: 'custom-pin',
        html: `<div style="background:#10b981; width:24px; height:24px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                <div style="width:8px; height:8px; background:#fff; border-radius:50%; transform:rotate(45deg);"></div>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24]
    }),
    end: L.divIcon({
        className: 'custom-pin',
        html: `<div style="background:#ef4444; width:24px; height:24px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; border:2px solid #fff; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                <div style="width:8px; height:8px; background:#fff; border-radius:50%; transform:rotate(45deg);"></div>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24]
    }),
    user: L.divIcon({
        className: 'user-pin',
        html: `<div style="background:#3b82f6; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px rgba(59,130,246,0.8); position:relative;">
                <div style="position:absolute; top:-4px; left:-4px; right:-4px; bottom:-4px; border:1px solid #3b82f6; border-radius:50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
               </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    })
};


class TeamXMap {
    constructor() {
        this.map = null;
        this.routeLayers = [];   // [{index, layer}]
        this.markerLayers = [];
        this.userMarker = null;
        this.watchId = null;
        this.userCoords = null;
        this.selectedRouteIndex = -1;
        this.init();
    }



    init() {
        if (!document.getElementById('map')) return;
        this.map = L.map('map').setView([AMRAVATI_LAT, AMRAVATI_LON], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        }).addTo(this.map);

        // Load colony AQI pins as background layer
        this.loadColonyPins();

        // Start GPS tracking
        this.initGeolocation();
    }

    initGeolocation() {
        if (!navigator.geolocation) {
            console.error("Geolocation is not supported by this browser.");
            return;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => this.onLocationUpdate(pos),
            (err) => this.onLocationError(err),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
    }

    onLocationUpdate(position) {
        const { latitude, longitude, accuracy } = position.coords;
        this.userCoords = [latitude, longitude];

        if (!this.userMarker) {
            this.userMarker = L.marker(this.userCoords, { icon: PIN_ICONS.user }).addTo(this.map);
            this.userMarker.bindPopup("<b>You are here</b>").openPopup();
            // Initially center map to user
            this.map.panTo(this.userCoords);
        } else {
            this.userMarker.setLatLng(this.userCoords);
        }

        // Keep marker on top
        this.userMarker.setZIndexOffset(1000);
    }

    onLocationError(error) {
        console.error("Geolocation error:", error);
        let msg = "Please enable GPS for accurate navigation.";
        if (error.code === 1) msg = "Location access denied. Please allow location permissions in your browser settings.";
        else if (error.code === 3) msg = "Location request timed out. Retrying...";

        this.showToast(msg, error.code === 1 ? 'error' : 'warning');
    }

    showToast(message, type = 'info') {
        const toastId = 'map-toast';
        let toast = document.getElementById(toastId);
        if (!toast) {
            toast = document.createElement('div');
            toast.id = toastId;
            toast.style.cssText = `
                position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
                background: rgba(0,0,0,0.85); color: #fff; padding: 12px 24px;
                border-radius: 12px; z-index: 9999; font-size: 14px; 
                border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(8px);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; 
                text-align: center; opacity: 0;
            `;
            document.body.appendChild(toast);
        }
        
        // Handle popup style for "Turn on GPS"
        if (message.includes("enable GPS") || message.includes("denied")) {
            toast.style.background = "rgba(239, 68, 68, 0.95)";
            toast.style.borderColor = "#fff";
            toast.innerHTML = `<div style="display:flex; align-items:center; gap:10px;">
                <i data-lucide="map-pin-off"></i>
                <span>${message}</span>
            </div>`;
        } else {
            toast.style.background = "rgba(0,0,0,0.85)";
            toast.style.borderColor = "rgba(255,255,255,0.1)";
            toast.textContent = message;
        }

        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
        
        if (!message.includes("denied") && !message.includes("enable GPS")) {
            setTimeout(() => { 
                toast.style.opacity = '0'; 
                toast.style.transform = 'translateX(-50%) translateY(0)';
            }, 4000);
        }
    }

    useCurrentLocation() {
        if (this.userCoords) {
            const startInput = document.getElementById('start-node');
            if (startInput) {
                startInput.value = "My Location";
                startInput.dataset.lat = this.userCoords[0];
                startInput.dataset.lon = this.userCoords[1];
                this.showToast("Using current location as departure point.");
                this.updateDirectionsButtonVisibility();
            }
        } else {
            this.showToast("GPS location not available yet. Please wait.", 'warning');
        }
    }

    updateDirectionsButtonVisibility() {
        const start = document.getElementById('start-node').value.trim();
        const container = document.getElementById('directions-btn-container');
        if (container) {
            container.style.display = (start === "My Location") ? 'block' : 'none';
        }
    }

    selectRoute(index) {
        this.selectedRouteIndex = index;
        
        // Update map layers
        this.routeLayers.forEach(rl => {
            const isSelected = rl.index === index;
            rl.layer.setStyle({
                opacity: isSelected ? 1 : 0.15,
                weight: isSelected ? 8 : 4
            });
            if (isSelected) rl.layer.bringToFront();
        });

        // Update cards
        const cards = document.querySelectorAll('.route-card');
        cards.forEach((card, idx) => {
            if (idx === index) {
                card.style.background = 'rgba(255, 255, 255, 0.12)';
                card.style.borderColor = 'var(--primary)';
            } else {
                card.style.background = 'rgba(255, 255, 255, 0.03)';
                card.style.borderColor = 'var(--card-border)';
            }
        });
    }

    startNavigation() {
        if (this.selectedRouteIndex === -1) {
            this.showToast("Please select a route first.", 'warning');
            return;
        }
        this.showToast("Navigation started! Tracking your movement...", 'info');
        // Future: could implement turn-by-turn or active path following
    }



    // ─────────────────────────────────────
    // Colony AQI pins (shared helper)
    // ─────────────────────────────────────
    aqiColor(aqi) {
        if (aqi <= 50) return "#00E400";
        if (aqi <= 100) return "#FFFF00";
        if (aqi <= 150) return "#FF7E00";
        if (aqi <= 200) return "#FF0000";
        return "#8F3F97";
    }

    async loadColonyPins() {
        try {
            const res = await fetch('/api/map/pins');
            const data = await res.json();
            if (data.status === 'success') {
                data.pins.forEach(pin => {
                    const color = this.aqiColor(pin.aqi);
                    const sz = pin.aqi > 150 ? 30 : pin.aqi > 100 ? 26 : 22;
                    const icon = L.divIcon({
                        className: '',
                        html: `<div style="
                            background:${color};
                            color:${pin.aqi > 100 ? '#fff' : '#111'};
                            border:2px solid rgba(255,255,255,0.8);
                            border-radius:50%;
                            width:${sz}px; height:${sz}px;
                            display:flex; align-items:center; justify-content:center;
                            font-size:9px; font-weight:bold;
                            box-shadow:0 2px 8px rgba(0,0,0,0.5);">${pin.aqi}</div>`,
                        iconSize: [sz, sz],
                        iconAnchor: [sz / 2, sz / 2],
                    });
                    L.marker([pin.lat, pin.lon], { icon })
                        .bindPopup(`<b>${pin.name}</b><br>
                            <span style="background:${color};color:${pin.aqi > 100 ? '#fff' : '#111'};
                                padding:2px 8px;border-radius:999px;font-weight:bold;">
                                AQI ${pin.aqi}</span>
                            &nbsp;<small>${pin.category}</small><br>
                            <small>PM2.5: ${pin.pm2_5 ?? '—'} | PM10: ${pin.pm10 ?? '—'}</small>`)
                        .addTo(this.map);
                });
            }
        } catch (e) { console.error("Colony pins error:", e); }
    }

    clearAll() {
        [...this.routeLayers.map(r => r.layer), ...this.markerLayers]
            .forEach(l => { try { this.map.removeLayer(l); } catch (_) { } });
        this.routeLayers = [];
        this.markerLayers = [];
        const el = document.getElementById('route-list');
        if (el) el.innerHTML = '';
    }

    async calculateRoute() {
        const startNode = document.getElementById('start-node');
        const start = startNode.value.trim();
        const end = document.getElementById('end-node').value.trim();
        const btn = document.getElementById('find-btn');
        const spinner = document.getElementById('route-spinner');
        
        if (btn) { btn.disabled = true; }
        if (spinner) { spinner.style.display = 'inline'; }

        this.clearAll();

        try {
            const payload = { end_name: end };
            if (start === "My Location" && startNode.dataset.lat) {
                payload.start_lat = parseFloat(startNode.dataset.lat);
                payload.start_lon = parseFloat(startNode.dataset.lon);
            } else {
                payload.start_name = start;
            }

            const res = await fetch('/api/route/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.status === 'success' && data.routes.length > 0) {
                this.renderRoutes(data.routes);
                document.getElementById('route-results').style.display = 'block';
            } else {
                document.getElementById('route-list').innerHTML =
                    '<p class="text-muted">⚠️ Could not find routes. Check colony names and try again.</p>';
                document.getElementById('route-results').style.display = 'block';
            }
        } catch (err) {
            console.error("Routing error:", err);
        } finally {
            if (btn) { btn.disabled = false; }
            if (spinner) { spinner.style.display = 'none'; }
        }
    }

    aqiColor(aqi) {
        if (aqi <= 50) return "#00E400";
        if (aqi <= 100) return "#FFFF00";
        if (aqi <= 150) return "#FF7E00";
        if (aqi <= 200) return "#FF0000";
        return "#8F3F97";
    }

    aqiLabel(aqi) {
        if (aqi <= 50) return "Good";
        if (aqi <= 100) return "Moderate";
        if (aqi <= 150) return "Unhealthy (Sensitive)";
        if (aqi <= 200) return "Unhealthy";
        return "Very Unhealthy";
    }

    renderRoutes(routes) {
        const bounds = new L.LatLngBounds();
        let markerDone = false;

        routes.forEach((route, idx) => {
            const sty = ROUTE_STYLE[route.type] || { color: '#fff', weight: 4, dashArray: null, opacity: 0.8 };

            // ── Draw route line ─────────────────────────────
            if (route.geometry) {
                const layer = L.geoJSON(route.geometry, {
                    style: {
                        color: sty.color,
                        weight: sty.weight,
                        opacity: sty.opacity,
                        dashArray: sty.dashArray,
                        lineJoin: 'round',
                        lineCap: 'round',
                    }
                }).bindTooltip(
                    `<b>${route.label}</b><br>Via: ${route.via || 'Direct'}<br>AQI exposure: <b>${route.aqi_exposure_score}</b> (${this.aqiLabel(route.aqi_exposure_score)})`,
                    { sticky: true, direction: 'auto', className: 'route-tooltip' }
                ).on('click', () => {
                    this.selectRoute(idx);
                }).addTo(this.map);


                this.routeLayers.push({ index: idx, layer });
                if (layer.getBounds && layer.getBounds().isValid()) {
                    bounds.extend(layer.getBounds());
                }
            }

            // ── Start / End markers (once only) ────────────
            if (!markerDone && route.start_location && route.end_location) {
                markerDone = true;

                const popupOpts = { maxWidth: 180 };

                const mkS = L.marker(
                    [route.start_location.coords[1], route.start_location.coords[0]],
                    { icon: PIN_ICONS.start }
                ).bindPopup(
                    `<b>🏁 START</b><br>${route.start_location.name}<br>Local AQI: <b style="color:${this.aqiColor(route.start_location.aqi)}">${route.start_location.aqi}</b>`,
                    popupOpts
                ).addTo(this.map);

                const mkE = L.marker(
                    [route.end_location.coords[1], route.end_location.coords[0]],
                    { icon: PIN_ICONS.end }
                ).bindPopup(
                    `<b>🏁 END</b><br>${route.end_location.name}<br>Local AQI: <b style="color:${this.aqiColor(route.end_location.aqi)}">${route.end_location.aqi}</b>`,
                    popupOpts
                ).addTo(this.map);

                this.markerLayers.push(mkS, mkE);

                bounds.extend([route.start_location.coords[1], route.start_location.coords[0]]);
                bounds.extend([route.end_location.coords[1], route.end_location.coords[0]]);
            }

            // ── Route card ─────────────────────────────────
            const aqiClr = this.aqiColor(route.aqi_exposure_score);
            const card = document.createElement('div');
            card.className = 'route-card';
            card.style.borderLeft = `5px solid ${sty.color}`;
            card.style.cursor = 'pointer';
            card.innerHTML = `
                <div style="flex:1;">
                    <strong style="color:${sty.color}; font-size:1rem;">${route.label}</strong>
                    <div class="text-muted" style="font-size:0.78em; margin-top:0.2rem;">
                        Via: <em>${route.via || 'Direct route'}</em>
                    </div>
                    <div style="font-size:0.82em; margin-top:0.3rem;">
                        📏 ${route.distance_km} km &nbsp;⏱ ${route.duration_min} min
                    </div>
                </div>
                <div style="text-align:right; margin-left:0.8rem;">
                    <div style="font-size:0.72em;" class="text-muted">AQI exposure</div>
                    <div style="font-size:1.3rem; font-weight:bold; color:${aqiClr};">${route.aqi_exposure_score}</div>
                    <div style="font-size:0.7em; color:${aqiClr};">${this.aqiLabel(route.aqi_exposure_score)}</div>
                </div>`;

            // Click → select this route
            card.addEventListener('click', () => {
                this.selectRoute(idx);
                if (capturedLayer && capturedLayer.getBounds) {
                    const b = capturedLayer.getBounds();
                    if (b.isValid()) this.map.fitBounds(b, { padding: [50, 50] });
                }
            });


            document.getElementById('route-list').appendChild(card);
        });

        // Fit map to show all routes
        if (bounds.isValid()) {
            this.map.fitBounds(bounds, { padding: [55, 55] });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.teamxMap = new TeamXMap();
});
