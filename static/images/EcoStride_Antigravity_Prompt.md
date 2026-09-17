# EcoStride — Full Enterprise Upgrade Prompt
### Paste this directly into Antigravity / Cursor / Windsurf

---

## PROJECT OVERVIEW

I have an existing project called **EcoStride** — an AQI (Air Quality Index) monitoring web app built with Python Flask backend and Jinja2/vanilla JS frontend. The full codebase is attached. I need you to fully upgrade it with the following requirements. Read the entire codebase first before making any changes.

---

## STACK MIGRATION

**Convert the entire frontend from Jinja2 templates + vanilla JS to React (using Vite).** Flask will become a pure REST API that returns only JSON — no more HTML rendering from Flask. React will handle all pages, routing, and UI. Keep Flask as the backend, do not switch to FastAPI or any other framework.

The new structure should be:
- `backend/` — Flask REST API (Python)
- `frontend/` — React app (Vite + React Router)

**Everything must be 100% free — no paid APIs, no paid services, no paid libraries, no paid hosting tools.**

---

## FEATURE 1 — GPS-BASED CURRENT LOCATION

Detect the user's real GPS location automatically when they open the app using the browser's Geolocation API. Use Nominatim (free, OpenStreetMap) for reverse geocoding to get the city name and state from coordinates. Show a pulsing "You Are Here" blue marker on the map at the user's exact GPS position. Display the detected city and state dynamically in the sidebar — remove all hardcoded "Amravati, MH" text. If the user denies GPS, fall back to IP-based geolocation using ipapi.co (free). Every API call to the backend must pass the user's current latitude, longitude, and city name as parameters.

---

## FEATURE 2 — PAN-INDIA SUPPORT (ALL CITIES AND STATES)

The app currently works only for Amravati. Make it work for every city and state across India. Add a city search box in the sidebar with autocomplete for all Indian cities — use the free dr5hn countries-states-cities JSON dataset from GitHub for the cities list. When the user selects a different city, everything on the page must refresh: the map re-centers, AQI pins reload, forecast updates, routing updates, and policies update. Remove every single hardcoded reference to Amravati from the entire codebase — run a search for "amravati" (case-insensitive) and replace all occurrences with dynamic values.

---

## FEATURE 3 — LIVE DYNAMIC AQI PINS FOR ALL PLACES

Currently the map shows only static, hardcoded pins for Amravati colonies. Replace this completely with a dynamic system that works for any city anywhere in India.

Use the **OpenStreetMap Overpass API** (free, no API key needed) to automatically discover all neighborhoods, colonies, parks, gardens, schools, colleges, hospitals, markets, and major road junctions within a 12km radius of the user's location. Do not hardcode any location names or coordinates. After discovering locations, fetch live AQI for each location using the **WAQI API** geo endpoint (free token required). Display all discovered locations as color-coded circle markers on the map — green for good AQI, yellow for moderate, orange for unhealthy-sensitive, red for unhealthy, purple for very unhealthy. Each pin popup should show the location name, AQI value, PM2.5, PM10, NO2, and a health category label. Cache Overpass results in SQLite for 24 hours and AQI results for 30 minutes to avoid rate limit issues. Use Leaflet.markercluster (free) to cluster dense pins. Add an AQI heatmap toggle using Leaflet.heat (free). Auto-refresh pins every 30 minutes.

---

## FEATURE 4 — AQI ALERT SERVICE (EMAIL + SMS, FULLY FREE)

Build a complete alert/notification system. Users can enter their email address or Indian phone number and set an AQI threshold (default 100). When AQI in their city exceeds their threshold, they automatically receive an alert.

For email: use Python's built-in smtplib with Gmail SMTP (free with a Gmail App Password). Send a rich HTML email showing the current AQI, health category, a list of recommended actions (stay indoors, close windows, wear N95, avoid outdoor exercise), and an unsubscribe link. For SMS: use Fast2SMS API (free tier available for Indian numbers). Store all subscribers in a new SQLite table. Run a background task every 30 minutes that checks AQI for each subscriber's city and sends alerts when the threshold is exceeded. Limit alerts to a maximum of 3 per subscriber per day to avoid spam. In the React frontend, add a subscription widget that appears on every page — a text input for email or phone, a dropdown to select AQI threshold, and Subscribe/Unsubscribe buttons.

---

## FEATURE 5 — DYNAMIC POLICY SIMULATION (LOCATION-AWARE)

The current policy page has only 4 hardcoded generic policies. Replace this with a fully dynamic policy engine. When the policy page loads, use the Overpass API to scan the user's current city for what actually exists there — industrial zones, farmland, highways, bus stations, construction sites, brick kilns, and residential areas. Based on what is detected, automatically generate and display only the policies that are relevant to that city. For example: if industrial zones are detected near the city, show an "Industrial Emission Standards" policy. If farmland is detected within 30km, show a "Crop Residue Burning Ban" policy. If heavy traffic junctions are detected, show an "Odd-Even Vehicle Scheme" policy. Show at minimum 6 relevant policies for any city. Each policy should display its name, description, estimated implementation difficulty, estimated cost, implementation timeline, and projected impact on PM2.5, PM10, NO2, and AQI. The simulation result should show before vs after charts using Recharts (free) and display the estimated AQI reduction percentage and estimated health benefit percentage.

---

## FEATURE 6 — NEW PAGES TO ADD IN REACT

Add these three new pages alongside the existing ones:

**Safe Zones Page** — Show the top 5 lowest-AQI locations in the user's current city right now, labeled "Best places to be today." Also show the top 5 worst-AQI locations labeled "Avoid these areas." Include a "Best time to go outside today" hourly chart using OpenMeteo's free forecast API combined with AQI data.

**Compare Cities Page** — Let users search and compare any two Indian cities side by side. Show current AQI, pollutant breakdown, and a 7-day trend chart for both cities simultaneously.

**Community Reports Page** — Let users submit real-time pollution reports from their GPS location. Report types: fire/burning, heavy dust, industrial smoke, unusual smell. Show submitted reports as emoji markers on the map. Auto-expire reports after 4 hours. Store in SQLite.

---

## FEATURE 7 — COMPLETE UI/UX REDESIGN (ENTERPRISE LEVEL)

Redesign the entire frontend in React to look like a premium enterprise SaaS dashboard — think Vercel, Linear, or Datadog in terms of quality. It must be dark-themed, modern, and visually impressive.

**Design requirements:**
- Deep space navy dark theme as the base background
- Cyan/blue gradient as the primary brand accent color
- Purple as a secondary accent
- Use Space Grotesk or Outfit for display/heading fonts, Inter for body text, JetBrains Mono for numbers and AQI values
- All cards should have subtle glass morphism effect with soft borders and a hover glow
- The AQI number on the dashboard should be huge (hero size), displayed inside an animated SVG arc ring that fills based on AQI level
- All stat numbers should animate/count up when the page loads
- Cards should slide up with a fade-in animation on page load
- Show skeleton loading states while data is being fetched — never show blank cards
- All pollutant bars (PM2.5, PM10, NO2, O3) should be animated horizontal bars that fill on load
- The map should have rounded corners and a subtle glow border
- The sidebar should be fixed on desktop with the logo, GPS location badge, live mini AQI widget, navigation links, and the alert subscription form at the bottom
- On mobile, the sidebar should collapse into a bottom navigation bar
- Every page must be fully responsive and work well on phones

**Dashboard homepage layout:**
- Top left: Large AQI hero card with the number inside an arc ring, category label, and 24-hour sparkline trend
- Top right: Pollutant breakdown card with animated bars for PM2.5, PM10, NO2, O3
- Middle: Full-width map with dynamic AQI pins and heatmap toggle
- Bottom row: Health advisory card, current weather card (wind speed, humidity from OpenMeteo — free), and a "Best time to go outside" hourly mini chart

---

## TECHNICAL REQUIREMENTS

**All external services used must be 100% free:**
- WAQI API — live AQI data (free token, ~1000 req/day)
- OpenStreetMap Overpass API — location discovery (free, no key needed)
- Nominatim — reverse geocoding (free, 1 req/sec limit)
- OpenMeteo — weather and wind data (free, unlimited)
- OSRM — road routing (free, unlimited)
- ipapi.co — IP geolocation fallback (free tier)
- Fast2SMS — Indian SMS alerts (free tier)
- Gmail SMTP via smtplib — email alerts (free with App Password)
- dr5hn cities database on GitHub — India cities list (free JSON)
- Leaflet.js + react-leaflet — maps (free)
- Leaflet.markercluster — pin clustering (free)
- Leaflet.heat — heatmap layer (free)
- Recharts — charts and graphs (free)
- Lucide React — icons (free)
- React Router v6 — frontend routing (free)
- Vite — build tool (free)

**Caching:** All Overpass API results must be cached in SQLite for 24 hours. All WAQI AQI results must be cached in SQLite for 30 minutes. This is mandatory to stay within free tier rate limits.

**CORS:** Configure Flask-CORS to allow requests from the React dev server (localhost:5173) and whatever production domain is used.

**Background tasks:** Use the `schedule` Python library (free) to run a background thread that checks subscriber AQI thresholds every 30 minutes and sends alerts.

**Hosting (all free options):** The React frontend can be deployed to Vercel (free). The Flask backend can be deployed to Render.com free tier, Railway.app free tier, or PythonAnywhere free tier.

---

## IMPLEMENTATION ORDER

Do this in the following order. Do not skip steps or do them out of order:

1. Set up the new folder structure: `backend/` and `frontend/` directories
2. Convert Flask to a pure JSON REST API — remove all `render_template` calls
3. Set up React with Vite and React Router, create the basic page shell
4. Implement GPS detection and city search in React, wire it to a LocationContext
5. Replace hardcoded Amravati colonies with Overpass API dynamic location discovery in the backend
6. Implement dynamic WAQI pin fetching for any lat/lon with SQLite caching
7. Build the React map component with react-leaflet, dynamic pins, clustering, heatmap toggle, and user location marker
8. Build the alert service backend (SQLite + Gmail SMTP + Fast2SMS) and connect the React subscription widget
9. Rewrite the policy simulation engine to use Overpass-based industry detection
10. Build the complete React UI — design system, all components, all pages
11. Add the three new pages: Safe Zones, Compare Cities, Community Reports
12. Final check: search the entire codebase for "amravati" (case-insensitive) and confirm zero hardcoded references remain

---

## VALIDATION

Before finishing, confirm all of the following work:
- Opening the app automatically detects the user's city via GPS and shows it in the sidebar
- AQI pins appear dynamically for neighborhoods, parks, and roads in the detected city — not just Amravati
- Typing any Indian city in the search box refreshes all data for that city
- The alert subscription form accepts an email, saves it, and sends an HTML email when AQI exceeds the threshold
- The policy page scans the current city and shows only relevant policies for that city
- The Safe Zones, Compare Cities, and Community pages all load correctly
- The app looks enterprise-grade on both desktop and mobile
- No paid APIs or services are used anywhere in the project

---

*EcoStride v2.0 — Full upgrade prompt for Antigravity agent*
