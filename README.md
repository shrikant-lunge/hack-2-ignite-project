# 🌿 EcoStride — Environmental Health & Safe Routing Platform

> **EcoStride** is a real-time Air Quality Index (AQI) monitoring, forecasting, and eco-friendly routing platform. It helps citizens, health professionals, and policy makers understand air pollution, plan safe routes, and simulate the impact of environmental policies — across any city in India and globally.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Project Structure](#2-project-structure)
3. [Data Flow & Inputs](#3-data-flow--inputs)
4. [Configuration & Environment](#4-configuration--environment)
5. [Key Modules & Components](#5-key-modules--components)
6. [Setup & Installation](#6-setup--installation)
7. [Scripts & Commands](#7-scripts--commands)
8. [Testing Strategy](#8-testing-strategy)
9. [Deployment & CI/CD](#9-deployment--cicd)
10. [Known Limitations & TODOs](#10-known-limitations--todos)

---

## 1. Project Overview

### What It Does

EcoStride provides six core capabilities through a unified web dashboard:

| Feature | Description |
|---|---|
| **Live AQI Dashboard** | Real-time Air Quality Index with colony-level granularity on an interactive map |
| **72-Hour Forecast** | Heuristic AQI prediction using live data + traffic/nighttime patterns |
| **Eco-Friendly Routing** | Up to 5 alternative routes scored and sorted by AQI exposure (Cleanest → Industrial) |
| **Health Advisory** | Personalized health risk scoring powered by Groq LLM or local Ollama |
| **Policy Simulation** | Simulate the AQI impact of government interventions (odd-even, CNG mandates, green zones) |
| **Alert & Community System** | Subscribe to AQI threshold alerts via email/SMS; file community pollution reports |

### Tech Stack

#### Backend

| Technology | Version | Purpose |
|---|---|---|
| **Python** | 3.10+ | Runtime |
| **Flask** | Latest | REST API server and HTML template server |
| **Flask-CORS** | Latest | Cross-origin resource sharing |
| **requests** | Latest | HTTP calls to external APIs |
| **reportlab** | Latest | Server-side PDF generation |
| **python-dotenv** | Latest | `.env` loading |
| **schedule** | Latest | Background alert poller |
| **SQLite3** | Built-in | Subscriber and report persistence |

#### Frontend (React App — `frontend/`)

| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.x | UI framework |
| **Vite** | 8.x | Build tool and dev server |
| **react-router-dom** | 7.x | Client-side routing |
| **Leaflet + react-leaflet** | 1.9 / 5.x | Interactive AQI map |
| **Chart.js + react-chartjs-2** | 4.x / 5.x | AQI trend charts |
| **Axios** | 1.x | HTTP client |
| **jsPDF + jspdf-autotable** | 4.x / 5.x | Client-side PDF export |
| **lucide-react** | 0.577 | Icon library |

#### Frontend (Jinja2 Templates — `templates/`)

Standalone HTML pages served directly by Flask using vanilla JS + Leaflet. These coexist with the React app and serve the same features without a build step.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│   React SPA (Vite, port 5173)   │  Jinja2 HTML Templates    │
└───────────────────┬─────────────────────────────────────────┘
                    │  REST API (JSON)
┌───────────────────▼─────────────────────────────────────────┐
│                   Flask Backend (port 5000)                   │
│  app.py — 14 API endpoints + 6 page routes                   │
├──────────────┬────────────┬──────────────┬───────────────────┤
│ AQIForecaster│RoutePlanner│HealthAdvisor │ PolicySimulator   │
├──────────────┴────────────┴──────────────┴───────────────────┤
│                   AQIAlertService (services/)                  │
│                   SQLite DB (database/teamx.db)               │
└────────────────────────────────────────────────────────────┬─┘
                                                             │
          ┌──────────────────────────────────────────────────┘
          │ External APIs
          ├── data.gov.in (PRIMARY — official India AQI)
          ├── OpenWeatherMap Air Pollution API (SECONDARY)
          ├── AQICN / WAQI (physical station fallback)
          ├── Nominatim / Overpass (geocoding + map features)
          ├── OSRM (open-source routing engine)
          └── Groq API / Ollama (LLM health advisory)
```

---

## 2. Project Structure

```
EcoStride/
│
├── app.py                    # Flask application — all routes and API endpoints
├── config_example.py         # Config template — copy to config.py and fill keys
├── background_tasks.py       # Daemon thread: polls AQI and fires subscriber alerts every 30 min
├── run_setup.py              # One-time DB initialization script
├── requirements.txt          # Python package dependencies
├── .env.example              # Environment variable template
├── .gitignore                # Git ignore rules
├── LICENSE                   # Project license
├── EcoStride_Prompt.md       # Original design/spec prompt (dev reference)
│
├── models/                   # Core analytical engine (pure Python, no frameworks)
│   ├── __init__.py
│   ├── forecasting.py        # AQIForecaster — live AQI fetch, caching, 72h prediction, colony pins
│   ├── routing.py            # RoutePlanner — OSRM multi-route with AQI exposure scoring
│   ├── health_advisory.py    # HealthAdvisor — risk scoring + Groq/Ollama LLM advisory
│   ├── policy_analysis.py    # PolicySimulator — Overpass-driven policy detection + AQI simulation
│   └── source_detection.py   # Pollution source detection helpers (consumed by PolicySimulator)
│
├── services/
│   └── alert_service.py      # AQIAlertService — email/SMS alerts, community reports, DB operations
│
├── templates/                # Jinja2 HTML pages (served by Flask directly)
│   ├── index.html            # Main AQI dashboard with live map (vanilla JS)
│   ├── forecast.html         # 72-hour AQI forecast chart page
│   ├── routing.html          # Eco-friendly route planner page
│   ├── sources.html          # Pollution source detection and hotspot map
│   ├── health.html           # Personalized health advisory form and response
│   └── policy.html           # Policy simulation interface
│
├── static/                   # Static assets served by Flask
│   ├── css/
│   │   └── style.css         # Global styles for Jinja2 template pages
│   ├── js/
│   │   ├── main.js           # Shared JS for template pages (AQI display, map init)
│   │   ├── map.js            # Leaflet map integration — colony pins, heatmap, layers
│   │   └── charts.js         # Chart.js chart builders (bar, line, forecast)
│   └── images/               # Static image assets (logos, icons, map overlays)
│
├── frontend/                 # React + Vite SPA (separate dev server)
│   ├── index.html            # Vite HTML entry point
│   ├── vite.config.js        # Vite config — proxies /api/* to Flask backend
│   ├── package.json          # npm dependencies and scripts
│   ├── eslint.config.js      # ESLint rules
│   └── src/
│       ├── main.jsx          # React app entry point (renders <App />)
│       ├── App.jsx           # Root component with React Router <Routes>
│       ├── App.css           # Root-level styles
│       ├── index.css         # Global CSS design tokens and resets
│       ├── apiConfig.js      # Axios base URL configuration
│       ├── components/
│       │   ├── Layout.jsx    # Shared page wrapper (sidebar + main area)
│       │   ├── Sidebar.jsx   # Navigation sidebar with city search & GPS
│       │   └── MapWidget.jsx # Reusable Leaflet map with AQI colony pins
│       ├── pages/
│       │   ├── Dashboard.jsx # Home page — current AQI ring, pollutant cards
│       │   ├── Predict.jsx   # 72h forecast chart + PDF download
│       │   ├── Routing.jsx   # Route planner — map + 5 ranked routes + steps
│       │   ├── Compare.jsx   # Side-by-side city AQI comparison + PDF
│       │   ├── SafeZones.jsx # Map view of colony AQI zones (green/amber/red)
│       │   ├── Policy.jsx    # Policy scenario selector + simulation results
│       │   └── Community.jsx # Alert subscription + community report form
│       ├── context/          # React Context providers (city, location state)
│       └── hooks/            # Custom React hooks (e.g., useAQI, useLocation)
│
├── database/                 # Created at runtime by run_setup.py
│   └── teamx.db              # SQLite database file (auto-created)
│
├── test_api.py               # API smoke tests (Python requests)
├── test_apis.ps1             # PowerShell API test script
├── test_community.py         # Community report endpoint tests
├── test_routing.py           # Routing endpoint tests
├── verify_api_accuracy.py    # Validates live AQI data accuracy
├── verify_dynamic_routing.py # End-to-end routing verification
├── verify_fix.py             # Quick regression test script
├── tmp_verify_backend.py     # Temporary backend health check
└── tmp_verify_backend_sleep.py # Delayed backend health check variant
```

---

## 3. Data Flow & Inputs

### Data Sources

| Source | API / Protocol | What It Provides | Priority |
|---|---|---|---|
| **data.gov.in** | REST (JSON) | Official India CPCB station AQI by city | PRIMARY |
| **OpenWeatherMap** | REST (JSON) | Air pollution data by GPS coordinates | SECONDARY |
| **AQICN / WAQI** | REST (JSON) | Physical station AQI by station ID | FALLBACK |
| **Nominatim** | REST (JSON) | Forward + reverse geocoding (city names → coords) | Routing |
| **Overpass API** | POST (JSON) | OSM data: industries, farmland, roads, parks | Policy/Map |
| **OSRM** | REST (GeoJSON) | Road routing with turn-by-turn steps | Routing |
| **Groq API** | REST (JSON) | LLM health advisory generation (llama-3.3-70b) | Health |
| **Ollama** | REST (localhost) | Local LLM fallback for health advisory | Health (opt.) |
| **Fast2SMS** | REST | SMS delivery for AQI alerts | Alerts (opt.) |
| **Gmail SMTP** | SMTP TLS/SSL | Email alert delivery & authority reports | Alerts |

### How Data Flows

```
1. User opens dashboard
   └──► Frontend sends GET /api/forecast/current?city=Amravati&lat=...&lon=...

2. AQIForecaster.get_current() runs three-tier data resolution:
   ├── Tier 1: data.gov.in → station records grouped by city
   ├── Tier 2: AQICN → 4 known physical stations (parallel ThreadPoolExecutor)
   ├── Tier 3: OpenWeatherMap → coordinate-based satellite model
   └── Decision: nearest station < 10 km → use it; else OWM; else static anchor

3. Response JSON:
   { aqi, pm2_5, pm10, no2, o3, so2, co, category, source, accuracy_level, lat, lon }

4. Map pins (GET /api/map/pins)
   └──► fetch_owm_by_coords() → base AQI anchor
   └──► Overpass: query suburbs/schools/parks/roads within 12 km radius
   └──► Apply COLONY_FACTORS (land-use multipliers) → per-colony AQI values
   └──► Return sorted pin list with aqi, pm2_5, pm10, no2 per location

5. Route calculation (POST /api/route/calculate)
   └──► Geocode start/end via Nominatim (viewbox-biased for local accuracy)
   └──► Fetch live colony pins → zone categorization (green/moderate/red)
   └──► OSRM: request direct route + alternatives + perpendicular-offset via-routes
   └──► _evaluate_exposure(): sample 20 points per route, weighted AQI from 3 nearest pins
   └──► Sort ascending AQI → label Cleanest / Safest / Balanced / Fastest / Industrial

6. Health advisory (POST /api/health/advisory)
   └──► get_current() → live AQI
   └──► calculate_risk_score(aqi, profile) → score 0–100 with age/condition multipliers
   └──► generate_advisory() → Groq API / Ollama / static fallback text

7. Background alerts (every 30 min via schedule)
   └──► Load subscribers from SQLite
   └──► get_current() per subscriber's city
   └──► If AQI > threshold AND > 4 hours since last alert → send email/SMS
```

### Data Transformations

- **OWM AQI (1–5 index) → US-AQI (0–500):** Piecewise linear breakpoint table applied to PM₂.₅.
- **Colony AQI from base:** `aqi_colony = base_aqi × factor + micro_noise` where `factor` is derived from land-use type (industrial: 1.55, park: 0.40–0.65).
- **Route AQI score:** Inverse-distance-cubed weighted average of 3 nearest colony pins at 20 sampled route coordinates, then scaled by live OWM reading at route midpoint.
- **Policy simulation:** Per-pollutant multiplicative reduction applied to baseline, re-aggregated into a PM-weighted AQI.

### Output Formats

| Output | Format | Destination |
|---|---|---|
| Live AQI | JSON | REST API response |
| 72h forecast | JSON array (72 hourly objects) | REST API → Chart.js graph |
| Route alternatives | GeoJSON geometry + metadata | REST API → Leaflet polylines |
| AQI colony pins | JSON array | REST API → Leaflet circle markers |
| Forecast PDF | Binary PDF (via reportlab) | `send_file()` download |
| Comparison PDF | Binary PDF (via reportlab) | `send_file()` download |
| Email alerts | HTML email | Gmail SMTP |
| SMS alerts | Plain text | Fast2SMS API |
| Authority reports | HTML email | Gmail SMTP |

---

## 4. Configuration & Environment

### Environment Variables (`.env`)

Copy `.env.example` to `.env` and populate all values before running.

| Variable | Type | Required | Purpose | Example |
|---|---|---|---|---|
| `OPENWEATHER_API_KEY` | `string` | Yes | OWM Air Pollution API key | `abc123...` |
| `AQICN_API_TOKEN` | `string` | Yes | AQICN / WAQI station token | `xyz789...` |
| `GROQ_API_KEY` | `string` | Optional | Groq LLM for health advisories | `gsk_...` |
| `GOV_INDIA_API_KEY` | `string` | Yes | data.gov.in API key | `579b...` |
| `GOV_INDIA_RESOURCE_ID` | `string` | Yes | Dataset resource ID | `3b01bcb8-...` |
| `SMTP_EMAIL` | `string` | Optional | Gmail address for sending alerts | `you@gmail.com` |
| `SMTP_APP_PASSWORD` | `string` | Optional | Gmail App Password (not login pw) | `abcd efgh ...` |
| `AUTHORITY_EMAIL` | `string` | Optional | Recipient of community reports | `authority@gov.in` |
| `FAST2SMS_API_KEY` | `string` | Optional | Fast2SMS key for SMS alerts | `abc...` |
| `USE_LOCAL_LLM` | `bool` | Optional | Use Ollama instead of Groq | `False` |
| `DEBUG` | `bool` | Optional | Flask debug mode | `True` |
| `PORT` | `int` | Optional | Flask server port | `5000` |

### Config File (`config.py`)

Copy `config_example.py` to `config.py`. This Python module is imported directly by all backend modules.

```python
# Key settings in config.py
OPENWEATHER_API_KEY = "your_key"
AQICN_API_TOKEN     = "your_token"
GROQ_API_KEY        = "your_key"       # Set to "your_free_key_here" to use fallback
USE_LOCAL_LLM       = False             # True → use Ollama on localhost:11434
GOV_INDIA_API_KEY   = "your_key"
GOV_INDIA_RESOURCE_ID = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"  # Default CPCB dataset
DATABASE_PATH       = "database/teamx.db"
HOST                = "127.0.0.1"
PORT                = 5000
DEBUG               = True
CACHE_DURATION      = 900               # seconds (15 min)
DATA_UPDATE_INTERVAL = 15               # minutes
```

### Feature Flags / Runtime Toggles

| Flag | Location | Effect |
|---|---|---|
| `USE_LOCAL_LLM = True` | `config.py` | Routes health advisory to Ollama (`localhost:11434`) instead of Groq |
| `GROQ_API_KEY = "your_free_key_here"` | `config.py` | Skips Groq API; uses rule-based static advisory fallback |
| `DEBUG = True` | `config.py` / `.env` | Flask debug mode with auto-reload and detailed tracebacks |
| `CACHE_ENABLED = True` | `config.py` | Enables in-memory TTL caches in `AQIForecaster` (10 min for current AQI, 30 min for forecasts) |

---

## 5. Key Modules & Components

### Backend Modules

#### `app.py` — Flask Application

The single entry point. Initialises all four model instances at startup (not per-request) and registers the following route groups:

| Group | Endpoints |
|---|---|
| **Page routes** | `GET /`, `/forecast`, `/routing`, `/sources`, `/health`, `/policy` |
| **Forecast API** | `GET /api/forecast/current`, `POST /api/forecast/predict` |
| **Routing API** | `POST /api/route/calculate` |
| **Map API** | `GET /api/map/pins`, `GET /api/source/detect` |
| **Health API** | `POST /api/health/advisory` |
| **Policy API** | `GET /api/policy/scenarios`, `POST /api/policy/simulate` |
| **Alerts API** | `POST /api/alerts/subscribe`, `POST /api/alerts/unsubscribe`, `POST /api/alerts/test` |
| **Community API** | `POST /api/community/report` |
| **PDF API** | `POST /api/pdf/forecast`, `POST /api/pdf/compare` |

---

#### `models/forecasting.py` — `AQIForecaster`

**Responsibility:** All real-time AQI data acquisition, in-memory caching, and predictive modeling.

**Public interface:**

| Method | Signature | Returns |
|---|---|---|
| `get_current` | `(location, lat, lon)` | Dict with AQI, PM₂.₅, PM₁₀, NO₂, O₃, SO₂, CO, category, source |
| `predict_72h` | `(location)` | Dict with 72 hourly prediction objects |
| `get_colony_pins` | `(lat, lon, city_name)` | List of colony dicts with per-zone AQI |
| `get_source_hotspots` | `(city, lat, lon)` | List of pollution hotspot dicts |

**Key design decisions:**
- In-memory dict cache with per-key TTL avoids redundant API calls (600s for current, 1800s for forecast).
- `get_locations_for_city()` calls Overpass to dynamically discover suburbs/parks/roads; falls back to a hard-coded Amravati list (`DEFAULT_COLONIES`) on error.
- `COLONY_FACTORS` is a curated dict of ~50 Amravati landmark names → `{factor, pm_extra, no2_extra}` tuples based on CPCB/MPCB observations.

---

#### `models/routing.py` — `RoutePlanner`

**Responsibility:** Geocode arbitrary location names, fetch multiple road routes from OSRM, evaluate AQI exposure along each route, and return up to 5 ranked routes.

**Public interface:**

| Method | Signature | Returns |
|---|---|---|
| `find_routes` | `(start_name, end_name, city, lat, lon, mode, start_coords, end_coords)` | List of up to 5 route dicts with geometry, AQI score, steps, labels |
| `geocode` | `(name, city, fallback)` | `[lon, lat]` pair |
| `reverse_geocode` | `(lat, lon)` | City name string |

**Route generation strategy (in order):**
1. OSRM natural alternatives (direct route, no forced via)
2. Zone-based via-points from green/moderate/red AQI colonies if they fall within the route corridor
3. Perpendicular-offset midpoint via-points to force different street selection until 5 unique routes collected

**Deduplication:** Routes with the same `(distance/100, duration/30)` signature are dropped.

---

#### `models/health_advisory.py` — `HealthAdvisor`

**Responsibility:** Compute a personalised health risk score and generate textual advisory.

**Public interface:**

| Method | Signature | Returns |
|---|---|---|
| `calculate_risk_score` | `(aqi, profile)` | Dict: `{score, level, multiplier_applied}` |
| `generate_advisory` | `(profile, aqi)` | Plain-text advisory string |

**LLM routing:** `generate_advisory()` checks `USE_LOCAL_LLM` → Ollama; else `GROQ_API_KEY` set → Groq (`llama-3.3-70b-versatile`); else static rule-based fallback. The risk score is purely algorithmic with age, condition, and activity-level multipliers.

---

#### `models/policy_analysis.py` — `PolicySimulator`

**Responsibility:** Detect real-world pollution sources near a city using OSM Overpass, then match applicable policy interventions and simulate their combined AQI impact.

**Public interface:**

| Method | Signature | Returns |
|---|---|---|
| `detect_city_industries` | `(lat, lon, city_name, radius_km)` | List of `{type, name}` dicts from OSM |
| `generate_policies_for_city` | `(lat, lon, city_name)` | Dict of applicable policy templates |
| `simulate_policy` | `(current_data, selected_policies, city_name)` | Dict: baseline vs simulated pollutant levels + % improvement |

**Built-in policy templates:** Industrial Emission Standards, Crop Residue Burning Ban, Odd-Even Vehicle Scheme, CNG/EV Mandate, Construction Dust Control, Urban Green Buffer Expansion.

---

#### `services/alert_service.py` — `AQIAlertService`

**Responsibility:** Manage alert subscriptions in SQLite, send HTML email alerts via Gmail SMTP, send SMS via Fast2SMS, and forward community pollution reports to authority email.

**SQLite tables:**

| Table | Purpose |
|---|---|
| `subscribers` | Contact, city, GPS, threshold, active flag |
| `alert_logs` | Per-subscriber send history (rate-limited to once per 4 hours) |
| `community_reports` | Raw community reports with type, description, location |

---

#### `background_tasks.py`

Starts a daemon thread on app startup using `schedule`. Runs `AQIAlertService.check_and_send_alerts()` every **30 minutes**. Each run queries all active subscribers, fetches their city's live AQI, and fires an alert if `aqi > threshold` and the 4-hour cooldown has elapsed.

---

### Frontend Pages (React — `frontend/src/pages/`)

| Page | Route | Description |
|---|---|---|
| `Dashboard.jsx` | `/` | AQI ring gauge, pollutant breakdown cards, live map widget |
| `Predict.jsx` | `/predict` | 72h line chart, peak hour highlights, PDF export button |
| `Routing.jsx` | `/routing` | Location search, Leaflet map with 5 colour-coded route polylines, turn-by-turn steps drawer |
| `Compare.jsx` | `/compare` | Two-city AQI side-by-side comparison table + PDF export |
| `SafeZones.jsx` | `/safezones` | Map with colour-coded colony pins (green/amber/red) |
| `Policy.jsx` | `/policy` | Policy checkbox selector + before/after pollutant bar chart |
| `Community.jsx` | `/community` | Alert subscription form + community report submission form |

### Frontend Components

| Component | Description |
|---|---|
| `Layout.jsx` | Wraps every page with `<Sidebar>` + main content area |
| `Sidebar.jsx` | Navigation links, city text search, GPS "My Location" button, active city state |
| `MapWidget.jsx` | Reusable Leaflet map with colony AQI circle markers, popups, heatmap toggle |

---

## 6. Setup & Installation

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10 or higher |
| pip | Latest |
| Node.js | 18 or higher |
| npm | 9 or higher |
| Git | Any |

### Step-by-Step Local Setup

**1. Clone the repository**

```bash
git clone https://github.com/your-org/ecostride.git
cd ecostride
```

**2. Create and activate a Python virtual environment**

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python -m venv venv
source venv/bin/activate
```

**3. Install Python dependencies**

```bash
pip install -r requirements.txt
```

**4. Configure the application**

```bash
# Copy the example files
copy config_example.py config.py     # Windows
cp config_example.py config.py       # macOS / Linux

copy .env.example .env
```

Open `config.py` and `/.env` and fill in your API keys. Refer to the [Configuration section](#4-configuration--environment) for all required variables and where to obtain each key.

**5. Initialise the SQLite database**

```bash
python run_setup.py
```

This creates `database/teamx.db` with all required tables and indexes. Run this only once.

**6. Start the Flask backend**

```bash
python app.py
```

The server starts at `http://127.0.0.1:5000`. The Jinja2 template pages are immediately accessible.

**7. (Optional) Start the React frontend dev server**

```bash
cd frontend
npm install
npm run dev
```

The React SPA runs at `http://localhost:5173` and proxies all `/api/*` requests to Flask on port 5000.

### Common Setup Pitfalls

| Problem | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: config` | `config.py` not created | Copy `config_example.py` to `config.py` |
| `sqlite3.OperationalError: no such table` | `run_setup.py` not run | Run `python run_setup.py` |
| `CORS error` in browser | Flask-CORS not installed | `pip install flask-cors` |
| Routing returns empty list | OSRM unreachable or start==end | Check internet; ensure start and end are different locations |
| Health advisory returns fallback text | `GROQ_API_KEY` not set or invalid | Set key in `config.py` or set `USE_LOCAL_LLM=True` with Ollama running |
| `rasterio` install fails on Windows | C++ build tools required | Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) first |
| Email alerts not sending | SMTP credentials not set | Generate Gmail App Password; set `SMTP_EMAIL` + `SMTP_APP_PASSWORD` in `.env` |

---

## 7. Scripts & Commands

### Python Scripts

| Script | Command | When to Run |
|---|---|---|
| **Start backend** | `python app.py` | Every development session |
| **DB initialization** | `python run_setup.py` | Once, after first clone |
| **API smoke test** | `python test_api.py` | After backend changes to verify endpoints |
| **Routing test** | `python test_routing.py` | After changes to `models/routing.py` |
| **Community test** | `python test_community.py` | After changes to `services/alert_service.py` |
| **AQI accuracy check** | `python verify_api_accuracy.py` | To validate live data against known stations |
| **Dynamic routing verify** | `python verify_dynamic_routing.py` | End-to-end route quality check |
| **Quick regression** | `python verify_fix.py` | After any bug fix |

### PowerShell Scripts

| Script | Command | Purpose |
|---|---|---|
| **API suite (PS)** | `.\test_apis.ps1` | Runs all API endpoints with `Invoke-WebRequest`; useful on Windows without curl |

### Frontend npm Scripts

Run all commands from inside the `frontend/` directory.

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server at `localhost:5173` with HMR |
| `npm run build` | Compile production bundle to `frontend/dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint on `src/` |

---

## 8. Testing Strategy

### Test Types Present

| Type | Files | Coverage Area |
|---|---|---|
| **API smoke tests** | `test_api.py`, `test_apis.ps1` | All REST endpoints — status codes and JSON structure |
| **Feature tests** | `test_routing.py`, `test_community.py` | Routing logic, community report submission |
| **Accuracy validation** | `verify_api_accuracy.py` | Live AQI data against known AQICN station values |
| **Integration tests** | `verify_dynamic_routing.py` | Full routing pipeline from name input to GeoJSON output |
| **Regression tests** | `verify_fix.py` | Quick sanity check after bug fixes |

### Running Tests

```bash
# Start Flask first (tests hit the live server)
python app.py &

# Basic API smoke test
python test_api.py

# Full routing verification
python verify_dynamic_routing.py

# AQI data accuracy report
python verify_api_accuracy.py

# PowerShell API suite (Windows)
.\test_apis.ps1
```

### Notes

- All test scripts target `http://127.0.0.1:5000` (hardcoded). Ensure Flask is running before executing.
- There are no unittest/pytest unit tests for individual model methods; tests are integration-level.
- No frontend tests (Jest / Vitest) are currently configured.

---

## 9. Deployment & CI/CD

### Build Steps

**Backend (Python/Flask):**
No build step. Flask serves directly from source. For production, use a WSGI server:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

**Frontend (React/Vite):**

```bash
cd frontend
npm install
npm run build
# Output: frontend/dist/
```

The compiled `dist/` output can be served statically by Flask or an external web server (Nginx, Apache).

### Serving Built Frontend via Flask

To serve the Vite build from Flask, add the following to `app.py`:

```python
from flask import send_from_directory

@app.route('/app', defaults={'path': ''})
@app.route('/app/<path:path>')
def serve_react(path):
    dist = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')
    if path and os.path.exists(os.path.join(dist, path)):
        return send_from_directory(dist, path)
    return send_from_directory(dist, 'index.html')
```

### Environment-Specific Behaviour

| Environment | Backend | Frontend | Debug | DB |
|---|---|---|---|---|
| **Development** | `python app.py` (Flask dev server) | `npm run dev` (Vite HMR) | `DEBUG=True` | `database/teamx.db` local |
| **Production** | `gunicorn` behind Nginx | Pre-built `dist/` served by Nginx | `DEBUG=False` | SQLite (or replace with PostgreSQL) |

### CI/CD

No CI/CD pipeline is currently configured. Recommended pipeline stages for future implementation:

1. `pip install -r requirements.txt` → Python dependency install
2. `python test_api.py` → API smoke tests
3. `cd frontend && npm ci && npm run build` → Frontend production build
4. `npm run lint` → ESLint check
5. Deploy to server

---

## 10. Known Limitations & TODOs

### Known Limitations

| Area | Limitation |
|---|---|
| **AQI Data — Amravati** | No dedicated physical AQI sensor in Amravati city. Data relies on nearest CPCB stations (up to 50 km away) and OWM satellite model. Colony-level AQI is a calibrated estimate, not a direct measurement. |
| **72h Forecast Model** | The forecast is a heuristic model (traffic peak + nighttime inversion + noise), not a trained ML model. `tensorflow` and `scikit-learn` are listed in `requirements.txt` but not currently used. |
| **SQLite in Production** | The alert subscriber database uses SQLite, which is not suitable for concurrent multi-worker deployments. |
| **Background Thread** | `background_tasks.py` starts a scheduler thread inside Flask. This conflicts with Gunicorn multi-worker mode — only the master process thread runs the scheduler. |
| **Frontend Duplication** | The project has two parallel UIs: Jinja2 templates (`templates/`) and the React SPA (`frontend/`). Both implement the same features independently, creating maintenance debt. |
| **OSRM Rate Limits** | Uses the public `router.project-osrm.org` demo server, which has strict rate limits and is not suitable for production traffic. |
| **Nominatim Policy** | Uses the public Nominatim demo server (`nominatim.openstreetmap.org`), which prohibits heavy usage. A self-hosted instance is required for production. |
| **No Authentication** | All API endpoints are unauthenticated and accept any input. There is no rate limiting or API key enforcement. |
| **PDF Generation** | Forecast and comparison PDFs are generated server-side using `reportlab`. The React frontend also has `jsPDF` installed for client-side generation (currently both are available). |

### Technical Debt

- `source_detection.py` exists as a standalone module but its functionality is entirely absorbed into `policy_analysis.py`; the module is currently unused.
- `tmp_verify_backend.py` and `tmp_verify_backend_sleep.py` are temporary debug scripts that were never removed.
- `AUTHORITY_EMAIL` is missing from `config_example.py` (present only in `.env.example`).
- `run_setup.py` contains placeholder `download_initial_data()` and `train_initial_model()` functions that are commented out and not implemented.

### Planned Improvements

- [ ] Replace heuristic 72h forecast with a trained `scikit-learn` / `tensorflow` time-series model
- [ ] Switch SQLite to PostgreSQL for production alert subscriptions
- [ ] Add self-hosted OSRM and Nominatim instances or integrate a commercial routing API
- [ ] Consolidate the two frontends into a single React app (deprecate Jinja2 templates)
- [ ] Add pytest unit tests for all model methods with mocked external APIs
- [ ] Implement API authentication (API key or JWT) and per-IP rate limiting
- [ ] Add Celery + Redis to replace the in-process `schedule` background thread
- [ ] Add a user accounts system for saving health profiles and subscription preferences
- [ ] Integrate real satellite imagery via NASA MODIS / Sentinel-5P for pollution source mapping

---

*Generated: 2026-03-15 | EcoStride — Environmental Health & Safe Routing Platform*

```
EcoStride
├─ app.py
├─ auth.py
├─ AUTH_SYSTEM.md
├─ background_tasks.py
├─ eco-stride2026.json
├─ FIREBASE_SETUP.md
├─ frontend
│  ├─ eslint.config.js
│  ├─ eslint_output.txt
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ public
│  │  ├─ favicon.svg
│  │  └─ icons.svg
│  ├─ README.md
│  ├─ src
│  │  ├─ apiConfig.js
│  │  ├─ App.css
│  │  ├─ App.jsx
│  │  ├─ assets
│  │  │  ├─ hero.png
│  │  │  ├─ react.svg
│  │  │  └─ vite.svg
│  │  ├─ components
│  │  │  ├─ Layout.jsx
│  │  │  ├─ MapWidget.jsx
│  │  │  ├─ ProtectedRoute.jsx
│  │  │  └─ Sidebar.jsx
│  │  ├─ context
│  │  │  ├─ AuthContext.jsx
│  │  │  └─ LocationContext.jsx
│  │  ├─ hooks
│  │  │  └─ useLocation.js
│  │  ├─ index.css
│  │  ├─ main.jsx
│  │  ├─ pages
│  │  │  ├─ Community.jsx
│  │  │  ├─ Compare.jsx
│  │  │  ├─ Dashboard.jsx
│  │  │  ├─ Landing.jsx
│  │  │  ├─ Policy.jsx
│  │  │  ├─ Predict.jsx
│  │  │  ├─ ProfileSetup.jsx
│  │  │  ├─ Routing.jsx
│  │  │  └─ SafeZones.jsx
│  │  ├─ styles
│  │  │  ├─ Landing.css
│  │  │  └─ ProfileSetup.css
│  │  └─ utils
│  │     └─ firebase.js
│  └─ vite.config.js
├─ IMPLEMENTATION_SUMMARY.md
├─ LICENSE
├─ models
│  ├─ forecasting.py
│  ├─ health_advisory.py
│  ├─ policy_analysis.py
│  ├─ routing.py
│  ├─ source_detection.py
│  └─ __init__.py
├─ QUICKSTART.md
├─ README.md
├─ requirements.txt
├─ run_setup.py
├─ services
│  └─ alert_service.py
├─ static
│  ├─ css
│  │  └─ style.css
│  ├─ images
│  │  └─ EcoStride_Antigravity_Prompt.md
│  └─ js
│     ├─ charts.js
│     ├─ main.js
│     └─ map.js
├─ templates
│  ├─ forecast.html
│  ├─ health.html
│  ├─ index.html
│  ├─ policy.html
│  ├─ routing.html
│  └─ sources.html
├─ test_api.py
├─ test_apis.ps1
├─ test_community.py
├─ test_routing.py
├─ tmp_verify_backend.py
├─ tmp_verify_backend_sleep.py
├─ VERIFICATION_CHECKLIST.md
├─ verify_api_accuracy.py
├─ verify_dynamic_routing.py
└─ verify_fix.py

```