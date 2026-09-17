// main.js — Amravati Dashboard with live colony AQI pins

class TeamXDashboard {
    constructor() {
        this.map = null;
        this.pins = [];
        this.init();
    }

    async init() {
        if (document.getElementById('map')) {
            this.initMap();
        }
        if (document.getElementById('current-aqi')) {
            await this.loadCurrentAQI('amravati');
        }
    }

    initMap() {
        this.map = L.map('map').setView([20.9320, 77.7523], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        }).addTo(this.map);

        // Load colony pins after map is ready
        this.loadColonyPins();
    }

    // ─────────────────────────────────────
    // AQI helpers
    // ─────────────────────────────────────
    aqiColor(aqi) {
        if (aqi <= 50) return "#00E400";
        if (aqi <= 100) return "#FFFF00";
        if (aqi <= 150) return "#FF7E00";
        if (aqi <= 200) return "#FF0000";
        if (aqi <= 300) return "#8F3F97";
        return "#7E0023";
    }

    aqiLabel(aqi) {
        if (aqi <= 50) return "Good";
        if (aqi <= 100) return "Moderate";
        if (aqi <= 150) return "Unhealthy (Sensitive)";
        if (aqi <= 200) return "Unhealthy";
        if (aqi <= 300) return "Very Unhealthy";
        return "Hazardous";
    }

    // ─────────────────────────────────────
    // Colony Pins
    // ─────────────────────────────────────
    async loadColonyPins() {
        try {
            const res = await fetch('/api/map/pins');
            const data = await res.json();
            if (data.status === 'success') {
                this.renderColonyPins(data.pins);
            }
        } catch (e) {
            console.error("Pin load error:", e);
        }
    }

    renderColonyPins(pins) {
        pins.forEach(pin => {
            const color = this.aqiColor(pin.aqi);
            const radius = pin.aqi > 150 ? 13 : pin.aqi > 100 ? 11 : 9;

            // Create a DivIcon with the AQI number centred in it
            const icon = L.divIcon({
                className: '',
                html: `<div style="
                    background:${color};
                    color:${pin.aqi > 100 ? '#fff' : '#111'};
                    border:2px solid rgba(255,255,255,0.8);
                    border-radius:50%;
                    width:${radius * 2}px; height:${radius * 2}px;
                    display:flex; align-items:center; justify-content:center;
                    font-size:${radius > 10 ? '10' : '9'}px;
                    font-weight:bold;
                    box-shadow:0 2px 8px rgba(0,0,0,0.5);
                    ">${pin.aqi}</div>`,
                iconSize: [radius * 2, radius * 2],
                iconAnchor: [radius, radius],
            });

            L.marker([pin.lat, pin.lon], { icon })
                .bindPopup(`
                    <div style="min-width:160px;">
                        <b style="font-size:1em;">${pin.name}</b>
                        <div style="margin:4px 0;">
                            <span style="
                                background:${color};
                                color:${pin.aqi > 100 ? '#fff' : '#111'};
                                padding:2px 8px; border-radius:999px;
                                font-weight:bold; font-size:0.9em;">
                                AQI ${pin.aqi}
                            </span>
                            <span style="color:#aaa; font-size:0.8em; margin-left:4px;">${pin.category}</span>
                        </div>
                        <div style="font-size:0.8em; color:#ccc; line-height:1.5;">
                            PM2.5: ${pin.pm2_5 ?? '—'} &nbsp;|&nbsp; PM10: ${pin.pm10 ?? '—'}<br>
                            NO₂: ${pin.no2 ?? '—'} &nbsp;|&nbsp; Source: ${pin.source === 'owm_live' ? '🟢 Live' : '🟡 Est.'}
                        </div>
                    </div>
                `, { maxWidth: 200 })
                .addTo(this.map);
        });
    }

    // ─────────────────────────────────────
    // Dashboard AQI
    // ─────────────────────────────────────
    async loadCurrentAQI(location) {
        try {
            const res = await fetch(`/api/forecast/current?location=${location}`);
            const data = await res.json();
            if (data.status === 'success') {
                this.updateAQIDisplay(data.data);
            }
        } catch (e) {
            console.error("AQI fetch error:", e);
        }
    }

    updateAQIDisplay(data) {
        document.getElementById('dashboard-location').textContent = 'Amravati, Maharashtra';
        document.getElementById('current-aqi').textContent = data.aqi;
        document.getElementById('aqi-label').textContent = data.category;

        const circle = document.getElementById('aqi-circle-ui');
        const color = this.aqiColor(data.aqi);
        circle.style.borderColor = color;
        circle.style.boxShadow = `0 0 40px ${color}33, inset 0 0 20px ${color}11`;

        const grid = document.getElementById('pollutant-grid');
        if (grid) {
            grid.innerHTML = [
                ['PM2.5', data.pm2_5],
                ['PM10', data.pm10],
                ['NO₂', data.no2],
                ['O₃', data.o3],
            ].map(([l, v]) => `
                <div class="pollutant-card">
                    <div class="pollutant-label">${l}</div>
                    <div class="pollutant-value">${typeof v === 'number' ? v.toFixed(1) : '—'}</div>
                </div>
            `).join('');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.teamxDashboard = new TeamXDashboard();
});
