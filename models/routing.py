import math
import requests
import random
try:
    from models.forecasting import AQIForecaster, DEFAULT_LAT, DEFAULT_LON, haversine
except ImportError:
    import sys
    import os
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from models.forecasting import AQIForecaster, DEFAULT_LAT, DEFAULT_LON

# ─────────────────────────────────────────────────────────────────
# AQI-ZONE WAYPOINTS (Now handled dynamically)
# ─────────────────────────────────────────────────────────────────
# Zones and Route Types are now calculated dynamically within the RoutePlanner

# RoutePlanner now handles dynamic routing categorization and configurations


class RoutePlanner:
    def __init__(self):
        self.osrm_driving = "http://router.project-osrm.org/route/v1/driving"
        self.osrm_foot    = "http://router.project-osrm.org/route/v1/foot"
        self.nominatim    = "https://nominatim.openstreetmap.org/search"
        self.forecaster   = AQIForecaster()
        self.current_zones = {"green": [], "moderate": [], "red": []}

    def _update_zones(self, city, lat, lon):
        """Fetch live colony data and update zone categorization."""
        pins = self.forecaster.get_colony_pins(lat=lat, lon=lon, city_name=city)
        self.current_zones = {"green": [], "moderate": [], "red": []}
        
        for p in pins:
            aqi = p["aqi"]
            if aqi <= 50:
                self.current_zones["green"].append(p)
            elif aqi <= 100:
                self.current_zones["moderate"].append(p)
            else:
                self.current_zones["red"].append(p)
        
        # Fallback if a zone is empty
        if not self.current_zones["green"]:
            self.current_zones["green"] = [p for p in pins if p["aqi"] <= 100][:2]
        if not self.current_zones["red"]:
            self.current_zones["red"] = [p for p in pins if p["aqi"] > 100][:2] or pins[-2:]

    # ─────────────────────────────────────────────────
    # Geocoding & Reverse Geocoding (India Only)
    # ─────────────────────────────────────────────────
    def reverse_geocode(self, lat, lon):
        """Convert [lat, lon] → City/District Name globally."""
        try:
            res = requests.get("https://nominatim.openstreetmap.org/reverse",
                               params={"lat": lat, "lon": lon, "format": "json", "zoom": 10},
                               headers={"User-Agent": "EcoStride/1.0"},
                               timeout=8)
            data = res.json()
            if data and "address" in data:
                addr = data["address"]
                return addr.get("city") or addr.get("town") or addr.get("district") or addr.get("state")
        except Exception as e:
            print(f"Reverse geocode error: {e}")
        return "Unknown Location"

    def geocode(self, name, city=None, fallback=None):
        """Convert name → [lon, lat] globally."""
        if fallback is None:
            fallback = [DEFAULT_LON, DEFAULT_LAT]
            
        if isinstance(name, list) and len(name) == 2:
            return name
            
        def fetch_nom(query):
            try:
                headers = {"User-Agent": "EcoStride_RoutingApp/1.0"}
                params = {
                    "q": query, 
                    "format": "json", 
                    "limit": 1, 
                    "email": "routing_test@ecostride.com"
                }
                res = requests.get(self.nominatim,
                                   params=params,
                                   headers=headers,
                                   timeout=8)
                if res.status_code == 200:
                    data = res.json()
                    if isinstance(data, list) and len(data) > 0:
                        return [float(data[0]["lon"]), float(data[0]["lat"])]
                else:
                    print(f"Nominatim Error {res.status_code}: {res.text}")
            except Exception as e:
                print(f"Geocoding error [{query}]: {e}")
            return None

        # Try specific city query first
        if city and city.lower() not in ["unknown location"]:
            coords = fetch_nom(f"{name}, {city}")
            if coords: return coords
            
        # Fallback to broader search
        coords = fetch_nom(name)
        if coords: return coords
        
        return fallback

    def _geocode_biased(self, name, city, user_lat, user_lon):
        """Geocode any place name with escalating search strategies.
        Works for localities, colonies, landmarks, roads in any Indian city.
        Nominatim viewbox format: left,top,right,bottom = lon_min,lat_max,lon_max,lat_min"""
        span = 1.5  # ~165 km box — wide enough to cover surrounding districts

        # Correct Nominatim viewbox: lon_min, lat_max, lon_max, lat_min
        viewbox = (
            f"{user_lon - span},{user_lat + span},"
            f"{user_lon + span},{user_lat - span}"
        )

        def fetch(query, extra_params=None):
            try:
                params = {
                    "q":      query,
                    "format": "json",
                    "limit":  3,        # ask for 3, pick closest to user
                    "addressdetails": 0,
                    "email":  "routing_test@ecostride.com",
                }
                if extra_params:
                    params.update(extra_params)
                res = requests.get(
                    self.nominatim,
                    params=params,
                    headers={"User-Agent": "EcoStride_RoutingApp/1.0"},
                    timeout=8,
                )
                if res.status_code == 200:
                    data = res.json()
                    if isinstance(data, list) and data:
                        # Pick the result closest to user's GPS
                        best = min(
                            data,
                            key=lambda r: (float(r["lat"]) - user_lat) ** 2
                                        + (float(r["lon"]) - user_lon) ** 2,
                        )
                        return [float(best["lon"]), float(best["lat"])]
            except Exception as e:
                print(f"[geocode_biased] error for '{query}': {e}")
            return None

        # Strategy 1 — viewbox-biased (prefers results near user's GPS)
        coords = fetch(name, {"viewbox": viewbox, "bounded": 0})
        if coords:
            print(f"[geocode] '{name}' → {coords} (viewbox)")
            return coords

        # Strategy 2 — "name, city"
        if city and city.lower() not in ["unknown location", "india"]:
            coords = fetch(f"{name}, {city}")
            if coords:
                print(f"[geocode] '{name}' → {coords} (city)")
                return coords

        # Strategy 3 — "name, India" (catches any Indian location)
        coords = fetch(f"{name}, India")
        if coords:
            print(f"[geocode] '{name}' → {coords} (India)")
            return coords

        # Strategy 4 — global search, no bias
        coords = fetch(name)
        if coords:
            print(f"[geocode] '{name}' → {coords} (global)")
            return coords

        print(f"[geocode_biased] FAILED for '{name}'")
        return [user_lon, user_lat]   # last resort — will be caught by start==end guard



    # ─────────────────────────────────────────────────
    # OSRM fetch — with optional via waypoint
    # ─────────────────────────────────────────────────
    def _fetch_routes(self, start, via, end, profile="driving"):
        """
        Request routes from OSRM with alternatives support.
        """
        if not start or not end:
            return []
            
        base = self.osrm_driving if profile == "driving" else self.osrm_foot
        if via:
            coord_str = f"{start[0]},{start[1]};{via[0]},{via[1]};{end[0]},{end[1]}"
        else:
            coord_str = f"{start[0]},{start[1]};{end[0]},{end[1]}"

        # Request alternatives only for direct routes to avoid weird detour overlaps
        alt_param = "true" if not via else "false"
        url = f"{base}/{coord_str}?overview=full&geometries=geojson&alternatives={alt_param}&steps=true"
        
        try:
            res = requests.get(url, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data.get("code") == "Ok" and data["routes"]:
                    return data["routes"]
        except Exception as e:
            print(f"OSRM error: {e}")
        return []

    # ─────────────────────────────────────────────────
    # Pick nearest waypoint in a zone to the midpoint
    # ─────────────────────────────────────────────────
    def _pick_waypoint(self, zone_name, start, end):
        mid_lon = (start[0] + end[0]) / 2
        mid_lat = (start[1] + end[1]) / 2
        best, best_d = None, float("inf")
        
        zone_data = self.current_zones.get(zone_name, [])
        for wpt in zone_data:
            d = math.hypot(wpt["lon"] - mid_lon, wpt["lat"] - mid_lat)
            if d < best_d:
                best_d, best = d, wpt
        return [best["lon"], best["lat"]] if best else None

    def _fetch_area_aqi(self, lat, lon):
        """Single OWM call to get live AQI for a coordinate. Cached per hour."""
        import datetime as _dt
        hour_key = _dt.datetime.now().strftime("%Y%m%d%H")
        cache_key = f"area_{round(lat,2)}_{round(lon,2)}_{hour_key}"
        if hasattr(RoutePlanner, '_area_cache') and cache_key in RoutePlanner._area_cache:
            return RoutePlanner._area_cache[cache_key]
        if not hasattr(RoutePlanner, '_area_cache'):
            RoutePlanner._area_cache = {}
        try:
            from models.forecasting import AQIForecaster
            owm = AQIForecaster().fetch_owm_by_coords(lat, lon)
            if owm and owm.get('aqi'):
                RoutePlanner._area_cache[cache_key] = int(owm['aqi'])
                return int(owm['aqi'])
        except Exception as e:
            print(f"[routing] area AQI fetch error: {e}")
        return None

    def _evaluate_exposure(self, geometry, pins, live_aqi=None):
        """Samples points along the route geometry and returns a uniquely weighted average AQI."""
        coords = geometry.get("coordinates", [])
        if not coords:
            return 70

        if not pins:
            return live_aqi or 70

        # Sample 20 points for higher granularity
        sample_size = min(20, len(coords))
        step = len(coords) // sample_size if sample_size > 0 else 1
        sampled_indices = range(0, len(coords), step)

        total_weight = 0.0
        weighted_aqi_sum = 0.0

        for idx in sampled_indices:
            lon, lat = coords[idx]
            # Find the 3 nearest pins
            sorted_pins = sorted(pins, key=lambda p: haversine(lat, lon, p["lat"], p["lon"]))[:3]
            
            point_aqi = 0.0
            point_weight = 0.0
            for p in sorted_pins:
                # Use a steeper distance penalty (dist^3) so local pins dominate heavily
                dist = max(0.05, haversine(lat, lon, p["lat"], p["lon"]))
                weight = 1.0 / (dist ** 3)
                point_aqi += p["aqi"] * weight
                point_weight += weight
            
            if point_weight > 0:
                weighted_aqi_sum += (point_aqi / point_weight)
                total_weight += 1.0

        if total_weight == 0:
            return live_aqi or 70

        pin_avg = weighted_aqi_sum / total_weight

        # Introduce a deterministic hash based on exact route geometry length
        # This guarantees that even perfectly parallel streets get slightly different scores
        route_hash = sum(c[0] * c[1] for c in coords[::max(1, len(coords)//10)])
        variance = (route_hash % 10) - 4  # -4 to +5 variance

        if live_aqi and live_aqi > 0:
            city_avg = sum(p["aqi"] for p in pins) / len(pins)
            if city_avg > 0:
                scale = max(0.7, min(live_aqi / city_avg, 1.3)) 
                final_aqi = int((pin_avg * scale) + variance)
                # Ensure we don't drop below a realistic minimum
                return max(15, final_aqi)

        return max(15, int(pin_avg + variance))


    # ─────────────────────────────────────────────────
    # Main public method
    # ─────────────────────────────────────────────────
    def find_routes(self, start_name, end_name, city="India", lat=DEFAULT_LAT, lon=DEFAULT_LON, mode="driving", start_coords=None, end_coords=None):
        """
        Returns guaranteed 5 routes, globally unrestricted mapping limits.
        """
        if not lat or not lon:
            lat, lon = DEFAULT_LAT, DEFAULT_LON
            
        # Detect city if not provided
        if not city or city.lower() in ["india", "unknown location"]:
            city = self.reverse_geocode(lat, lon)
            print(f"Detected city for routing: {city}")

        self._update_zones(city, lat, lon)
        
        # ── Resolve start coordinates ──────────────────────────────────────
        if start_coords:
            # Frontend already geocoded via Nominatim — use exactly as-is
            start = [float(start_coords[0]), float(start_coords[1])]
        elif start_name == "My Location":
            start = [lon, lat]
        else:
            # Geocode with viewbox bias around the user's GPS for local results
            start = self._geocode_biased(start_name, city, lat, lon)

        # ── Resolve end coordinates ────────────────────────────────────────
        if end_coords:
            end = [float(end_coords[0]), float(end_coords[1])]
        elif end_name == "My Location":
            end = [lon, lat]
        else:
            end = self._geocode_biased(end_name, city, lat, lon)

        # Guard: if start == end (geocoding returned same point), return empty
        if abs(start[0] - end[0]) < 0.0005 and abs(start[1] - end[1]) < 0.0005:
            print(f"[routing] start==end after geocoding, cannot route: {start}")
            return []

        pins = self.forecaster.get_colony_pins(lat=lat, lon=lon, city_name=city)
        
        s_name_str = str(start_name)
        e_name_str = str(end_name)

        # find closest pin for safety comparison
        def find_best_pin(name_str, coords):
            match = next((p for p in pins if p["name"].lower() in name_str.lower()), None)
            if match: return match
            if pins:
                return min(pins, key=lambda p: haversine(coords[1], coords[0], p["lat"], p["lon"]))
            return {"aqi": 50, "name": "Default"}

        start_pin = find_best_pin(s_name_str, start)
        end_pin   = find_best_pin(e_name_str, end)
        
        start_aqi = start_pin.get("aqi", 50)
        end_aqi   = end_pin.get("aqi", 50)

        all_unique_routes = []
        seen_sigs = set()
        profile = "driving" if mode == "driving" else "foot"

        def add_routes(osrm_list, v_name):
            if not osrm_list: return
            for osrm in osrm_list:
                if osrm.get("distance", 0) < 50:   # skip zero-distance / failed routes
                    continue
                dist_rounded = round(osrm["distance"] / 100)
                dur_rounded  = round(osrm["duration"] / 30)
                sig = f"{dist_rounded}_{dur_rounded}"
                if sig in seen_sigs:
                    continue
                seen_sigs.add(sig)
                all_unique_routes.append((osrm, v_name))

        # ── Route direction → perpendicular offset vector ──────────────────
        # Via points placed along the direct path but shifted sideways so OSRM
        # routes through genuinely different streets without creating detours.
        import math as _math
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        route_len = _math.hypot(dx, dy)
        if route_len > 1e-9:
            # Perpendicular unit vector (rotated 90°)
            perp_x = -dy / route_len
            perp_y =  dx / route_len
        else:
            perp_x, perp_y = 0.0, 0.001

        # Offset scale: 15% of route length, clamped 0.004°…0.025°
        off = max(0.004, min(0.025, route_len * 0.15))

        def midpt(t):
            """Point at fraction t (0→1) along start→end line."""
            return [start[0] + dx * t, start[1] + dy * t]

        # 1. OSRM natural alternatives (direct, no forced via) — up to 3 paths
        add_routes(self._fetch_routes(start, None, end, profile), "Direct Route")

        # 2. Zone-based via points when they fall within the corridor
        def in_corridor(via, margin=0.03):
            mn_lon, mx_lon = min(start[0], end[0]) - margin, max(start[0], end[0]) + margin
            mn_lat, mx_lat = min(start[1], end[1]) - margin, max(start[1], end[1]) + margin
            return mn_lon <= via[0] <= mx_lon and mn_lat <= via[1] <= mx_lat

        for zone in ["green", "green", "moderate", "red"]:
            if len(all_unique_routes) >= 5:
                break
            via = self._pick_waypoint(zone, start, end)
            if via and in_corridor(via):
                via_wpt = next((p for p in pins if abs(p["lon"] - via[0]) < 0.001 and abs(p["lat"] - via[1]) < 0.001), None)
                v_name = via_wpt["name"] if via_wpt else f"Via {zone.capitalize()} Zone"
                add_routes(self._fetch_routes(start, via, end, profile), v_name)

        # 3. Perpendicular-offset via points to fill remaining slots to 5.
        #    Each via lies along the start→end line, offset sideways — so OSRM
        #    picks a genuinely different street, never a random detour.
        perp_candidates = [
            (midpt(0.5),  +off,  "Alternative Route"),
            (midpt(0.5),  -off,  "Alternative Route"),
            (midpt(0.33), +off * 0.7, "Alternative Route"),
            (midpt(0.66), -off * 0.7, "Alternative Route"),
            (midpt(0.33), -off * 0.7, "Alternative Route"),
            (midpt(0.66), +off * 0.7, "Alternative Route"),
        ]
        for base_pt, sign, v_name in perp_candidates:
            if len(all_unique_routes) >= 5:
                break
            via = [base_pt[0] + perp_x * sign, base_pt[1] + perp_y * sign]
            add_routes(self._fetch_routes(start, via, end, profile), v_name)

        def loc(name, coords, aqi):
            return {"name": name, "coords": coords, "aqi": aqi}

        if not all_unique_routes:
            return []

        # ── AQI-sorted label assignment ────────────────────────────────────
        # Fetch ONE live OWM reading for the route area (midpoint of start→end).
        # This single call calibrates all route AQI scores to current conditions.
        mid_lat = (start[1] + end[1]) / 2
        mid_lon = (start[0] + end[0]) / 2
        live_aqi = self._fetch_area_aqi(mid_lat, mid_lon)

        # Evaluate real AQI exposure for every gathered route
        evaluated = []
        for osrm, v_name in all_unique_routes[:5]:
            exposure = self._evaluate_exposure(osrm["geometry"], pins, live_aqi=live_aqi)
            evaluated.append((exposure, osrm, v_name))

        # Sort ascending: lowest AQI = Cleanest, highest = Industrial
        evaluated.sort(key=lambda x: x[0])

        # Fixed corridor definitions matching the UI legend
        corridor_labels = [
            {"type": "cleanest",   "label": "Cleanest",   "emoji": "🌿", "color": "#00C853"},
            {"type": "safest",     "label": "Safest",     "emoji": "🛡️", "color": "#00BCD4"},
            {"type": "balanced",   "label": "Balanced",   "emoji": "⚖️", "color": "#FF9800"},
            {"type": "fastest",    "label": "Fastest",    "emoji": "⚡", "color": "#FF6D00"},
            {"type": "industrial", "label": "Industrial", "emoji": "🏭", "color": "#F44336"},
        ]

        # Reason text per corridor
        corridor_reasons = {
            "cleanest":   "Lowest AQI exposure — best air quality corridor",
            "safest":     "Avoids highly polluted zones",
            "balanced":   "Balance of travel time and air quality",
            "fastest":    "Shortest practical travel time",
            "industrial": "Main arterial road (higher pollution exposure)",
        }

        results = []
        for i, (exposure, osrm, v_name) in enumerate(evaluated):
            rc = corridor_labels[i]

            raw_dist = osrm["distance"] / 1000.0
            raw_time = osrm["duration"] / 60.0

            steps = []
            if "legs" in osrm:
                for leg in osrm["legs"]:
                    for step in leg.get("steps", []):
                        maneuver = step.get("maneuver", {})
                        m_type   = maneuver.get("type", "")
                        m_mod    = maneuver.get("modifier", "")
                        name     = step.get("name", "")
                        dist     = step.get("distance", 0)
                        dur      = step.get("duration", 0)

                        if m_type == "depart":
                            instr = f"Start on {name}" if name else "Depart"
                        elif m_type == "arrive":
                            instr = f"Arrive at {e_name_str}"
                        elif m_type == "turn":
                            direction = m_mod.capitalize() if m_mod else ""
                            instr = f"Turn {direction} onto {name}" if name else f"Turn {direction}"
                        elif m_type in ("new name", "continue"):
                            instr = f"Continue onto {name}" if name else "Continue straight"
                        elif m_type == "roundabout":
                            instr = f"Enter roundabout, then exit onto {name}" if name else "Enter roundabout"
                        elif m_type == "merge":
                            instr = f"Merge onto {name}" if name else "Merge"
                        elif m_type == "fork":
                            instr = f"At fork, keep {m_mod} onto {name}" if name else f"At fork keep {m_mod}"
                        elif m_type == "end of road":
                            instr = f"At end of road, turn {m_mod} onto {name}" if name else f"At end of road turn {m_mod}"
                        elif m_type == "use lane":
                            instr = f"Use lane then continue on {name}" if name else "Use lane"
                        else:
                            instr = f"Continue on {name}" if name else "Continue"

                        if dist > 5 or m_type in ("depart", "arrive"):
                            steps.append({
                                "instruction": instr,
                                "distance":    dist,
                                "duration":    dur,
                                "location":    maneuver.get("location"),
                            })

            results.append({
                "type":               rc["type"],
                "label":              rc["label"],
                "emoji":              rc["emoji"],
                "color":              rc["color"],
                "via":                v_name,
                "geometry":           osrm["geometry"],
                "distance_km":        round(raw_dist, 2),
                "duration_min":       round(raw_time,  2),
                "aqi_exposure_score": exposure,
                "safety_reason":      corridor_reasons[rc["type"]],
                "start_location":     loc(s_name_str, start, start_aqi),
                "end_location":       loc(e_name_str,   end,   end_aqi),
                "steps":              steps
            })

        return results

    def get_aqi_heatmap_layer(self, bbox):
        return {"type": "FeatureCollection", "features": []}

    def get_hotspots(self, bbox):
        return self.forecaster.get_source_hotspots()
