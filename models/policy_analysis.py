import requests
import datetime
import math

class PolicySimulator:
    def __init__(self):
        self.POLICY_TEMPLATES = {
            "industrial_emission_caps": {
                "name": "Industrial Emission Standards",
                "applicable_when": ["industrial", "factory", "plant", "manufacturing"],
                "impacts": {"pm25": -0.25, "pm10": -0.20, "so2": -0.45, "no2": -0.20},
                "description": "Enforce real-time stack emission monitoring on all industrial units within 15km. Mandate scrubbers and filters.",
                "difficulty_score": 9
            },
            "stubble_burning_ban": {
                "name": "Crop Residue Burning Ban",
                "applicable_when": ["farmland", "agricultural", "farm"],
                "impacts": {"pm2_5": -0.30, "pm10": -0.25, "co": -0.20},
                "description": "Prohibit open-field burning of crop residues. Provide subsidized bio-decomposers and Happy Seeder machines.",
                "difficulty_score": 7
            },
            "odd_even_vehicles": {
                "name": "Odd-Even Vehicle Scheme",
                "applicable_when": ["highway", "road", "traffic"],
                "impacts": {"pm25": -0.15, "no2": -0.30, "co": -0.25},
                "description": "Restricts vehicles based on odd/even license plates.",
                "difficulty_score": 6
            },
            "cng_mandate": {
                "name": "CNG/EV Mandate for Commercial Vehicles",
                "applicable_when": ["highway", "transport_hub", "traffic"],
                "impacts": {"pm25": -0.20, "no2": -0.35, "co": -0.40},
                "description": "Phase out diesel-powered buses, auto-rickshaws, and taxis. Mandate CNG or electric alternatives.",
                "difficulty_score": 8
            },
            "construction_dust_control": {
                "name": "Construction Dust Control",
                "applicable_when": ["construction", "development"],
                "impacts": {"pm10": -0.40, "pm25": -0.15},
                "description": "Halts all major construction activities or enforces strong anti-dust protections.",
                "difficulty_score": 8
            },
            "green_buffer_zones": {
                "name": "Urban Green Buffer Expansion",
                "applicable_when": ["urban", "residential", "neighbourhood", "suburb"],
                "impacts": {"pm25": -0.08, "pm10": -0.10, "o3": -0.05},
                "description": "Plant 10,000+ trees in strategic locations based on wind patterns. Create green corridors.",
                "difficulty_score": 3
            }
        }

    def detect_city_industries(self, lat, lon, city_name, radius_km=15):
        """
        Use Overpass API to detect what exists near the user.
        """
        overpass_url = "https://overpass-api.de/api/interpreter"
        query = f"""
        [out:json][timeout:25];
        (
          node["landuse"="industrial"](around:{radius_km*1000},{lat},{lon});
          way["landuse"="industrial"](around:{radius_km*1000},{lat},{lon});
          node["industrial"~"factory|plant|kiln"](around:{radius_km*1000},{lat},{lon});
          way["highway"="primary"](around:{radius_km*1000},{lat},{lon});
          node["landuse"="farmland"](around:{radius_km*1000},{lat},{lon});
        );
        out body;
        """
        industries = []
        try:
            res = requests.post(overpass_url, data={'data': query}, timeout=10)
            if res.status_code == 200:
                data = res.json()
                for el in data.get('elements', []):
                    tags = el.get('tags', {})
                    if 'landuse' in tags and tags['landuse'] == 'industrial':
                        industries.append({"type": "industrial", "name": tags.get("name", "Industrial Zone")})
                    elif 'industrial' in tags:
                        industries.append({"type": "manufacturing", "name": tags.get("name", "Manufacturing Plant")})
                    elif 'landuse' in tags and tags['landuse'] == 'farmland':
                        industries.append({"type": "farmland", "name": tags.get("name", "Agricultural Area")})
                    elif 'highway' in tags and tags['highway'] == 'primary':
                        industries.append({"type": "traffic", "name": tags.get("name", "Primary Highway")})
                        
                # Dedup
                seen = set()
                unique_industries = []
                for ind in industries:
                    if ind['name'] not in seen:
                        seen.add(ind['name'])
                        unique_industries.append(ind)
                
                # Assign default if empty
                if not unique_industries:
                    return [{"type": "urban", "name": "Urban Traffic Zone"}, {"type": "residential", "name": "Residential Area"}]
                return unique_industries
        except Exception as e:
            print(f"Overpass industry error: {e}")
        return [{"type": "urban", "name": "Urban Traffic Zone"}, {"type": "residential", "name": "Residential Area"}]

    def generate_policies_for_city(self, lat, lon, city_name):
        industries = self.detect_city_industries(lat, lon, city_name)
        types = set([ind['type'] for ind in industries])
        types.add('urban') # always active
        
        applicable = {}
        for key, pol in self.POLICY_TEMPLATES.items():
            if any(t in pol['applicable_when'] for t in types):
                applicable[key] = pol
                
        # If very few match, add fallback defaults
        if len(applicable) < 3:
            applicable["green_buffer_zones"] = self.POLICY_TEMPLATES["green_buffer_zones"]
            applicable["public_transport"] = {
                "name": "Public Transport Incentives",
                "applicable_when": ["urban"],
                "impacts": {"pm25": -0.05, "no2": -0.10, "co": -0.10},
                "description": "Subsidizes bus/train fares to reduce private vehicle usage.",
                "difficulty_score": 4
            }
            
        return applicable

    def simulate_policy(self, current_data, selected_policies, city_name):
        baseline = {
            "pm25": current_data.get("pm2_5", 55.0),
            "pm10": current_data.get("pm10", 110.0),
            "no2": current_data.get("no2", 45.0),
            "so2": current_data.get("so2", 15.0),
            "co": current_data.get("co", 1.2),
            "o3": current_data.get("o3", 35.0),
            "aqi": current_data.get("aqi", 150)
        }
        
        simulated = baseline.copy()
        for p in selected_policies:
            if p in self.POLICY_TEMPLATES:
                impacts = self.POLICY_TEMPLATES[p]["impacts"]
                for pollutant, reduction in impacts.items():
                    # Handle naming inconsistency between model and template
                    p_key = pollutant.replace('pm2_5', 'pm25')
                    if p_key in simulated:
                        simulated[p_key] = max(simulated[p_key] * (1 + reduction), baseline[p_key] * 0.05)
                        
        pm_ratio = (simulated['pm25'] / baseline['pm25']) * 0.7 + (simulated['pm10'] / baseline['pm10']) * 0.3
        simulated['aqi'] = max(int(baseline['aqi'] * pm_ratio), 10)
        
        # Calculate reductions and benefits dynamically based on city scale heuristics
        return {
            "baseline": baseline,
            "simulated": simulated,
            "aqi_reduction": baseline['aqi'] - simulated['aqi'],
            "percent_improved": round((1 - pm_ratio) * 100, 1),
            "health_benefits_percent": round((1 - pm_ratio) * 100 * 0.15, 1)
        }
