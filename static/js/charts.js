// charts.js - Dynamic 72-hour AQI forecast rendering with color-coded bars

class TeamXForecast {
    constructor() {
        this.chart = null;
        this.gradientPlugin = null;
        this.init();
    }

    init() {
        if (document.getElementById('forecastChart')) {
            this.loadForecast();
        }
    }

    async loadForecast() {
        const input = document.getElementById('location-input');
        const location = input ? input.value.trim() : 'amravati';
        const badge = document.getElementById('forecast-location-badge');
        if (badge) badge.textContent = '⏳ Fetching live data...';

        try {
            const res = await fetch('/api/forecast/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location })
            });
            const data = await res.json();

            if (data.status === 'success') {
                const d = data.data;
                if (badge) badge.textContent = `Live base AQI: ${d.base_aqi} | Source: ${d.model_used}`;
                this.renderChart(d.predictions);
            }
        } catch (error) {
            console.error("Forecast fetch error:", error);
            if (badge) badge.textContent = '⚠️ Could not load live data.';
        }
    }

    aqiToColor(aqi) {
        if (aqi <= 50) return 'rgba(0,228,0,0.8)';
        if (aqi <= 100) return 'rgba(255,255,0,0.8)';
        if (aqi <= 150) return 'rgba(255,126,0,0.8)';
        if (aqi <= 200) return 'rgba(255,0,0,0.8)';
        if (aqi <= 300) return 'rgba(143,63,151,0.8)';
        return 'rgba(126,0,35,0.8)';
    }

    renderChart(predictions) {
        const ctx = document.getElementById('forecastChart');
        if (!ctx) return;

        const labels = predictions.map(p => p.timestamp);
        const values = predictions.map(p => p.aqi);
        const colors = values.map(v => this.aqiToColor(v));

        if (this.chart) { this.chart.destroy(); }

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Predicted AQI',
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderRadius: 4,
                    borderWidth: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `AQI: ${ctx.raw} — ${predictions[ctx.dataIndex]?.category || ''}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 300,
                        grid: { color: 'rgba(255,255,255,0.07)' },
                        ticks: { color: 'rgba(255,255,255,0.7)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: 'rgba(255,255,255,0.5)',
                            maxTicksLimit: 24,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.teamxForecast = new TeamXForecast();
});
