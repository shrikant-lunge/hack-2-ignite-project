from flask import Flask, jsonify, request, render_template, send_file
from flask_cors import CORS
import sys
import os

# Ensure the project root is in sys.path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

app = Flask(__name__)

# Configure CORS explicitly for both localhost and 127.0.0.1
CORS(app, 
     resources={
         r"/api/*": {
             "origins": [
                 "http://localhost:5173",
                 "http://localhost:3000",
                 "http://127.0.0.1:5173",
                 "http://127.0.0.1:3000",
                 "http://localhost:5000",
                 "http://127.0.0.1:5000",
             ],
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization"],
             "supports_credentials": True,
             "max_age": 3600
         }
     }
)

from models.forecasting import AQIForecaster
from models.routing import RoutePlanner
from models.health_advisory import HealthAdvisor
from models.policy_analysis import PolicySimulator
from auth import (
    initialize_firebase, verify_google_token, user_exists,
    get_user_data, create_user, update_user_profile, get_user_by_email
)

# Initialize Firebase
try:
    initialize_firebase()
except Exception as e:
    print(f"Warning: Firebase initialization failed: {e}")
    print("Authentication endpoints will not work without Firebase credentials")

# Initialize modules
forecaster = AQIForecaster()
router     = RoutePlanner()
advisor    = HealthAdvisor()
simulator  = PolicySimulator()

# --- Page Routes ---
@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

@app.route('/forecast', methods=['GET'])
def forecast_page():
    return render_template('forecast.html')

@app.route('/routing', methods=['GET'])
def routing_page():
    return render_template('routing.html')

@app.route('/sources', methods=['GET'])
def sources_page():
    return render_template('sources.html')

@app.route('/health', methods=['GET'])
def health_page():
    return render_template('health.html')

@app.route('/policy', methods=['GET'])
def policy_page():
    return render_template('policy.html')


# --- Forecast API Endpoints ---
@app.route('/api/forecast/current', methods=['GET'])
def get_current_aqi():
    city = request.args.get('city', 'Amravati')
    try:
        lat = float(request.args.get('lat')) if request.args.get('lat') else None
        lon = float(request.args.get('lon')) if request.args.get('lon') else None
    except:
        lat, lon = None, None

    # If no coordinates provided, geocode the city name so Compare works correctly
    if lat is None or lon is None:
        try:
            import requests as req
            geo = req.get(
                'https://nominatim.openstreetmap.org/search',
                params={'q': city, 'format': 'json', 'limit': 1},
                headers={'User-Agent': 'EcoStride/1.0'},
                timeout=6
            )
            geo_data = geo.json()
            if geo_data:
                lat = float(geo_data[0]['lat'])
                lon = float(geo_data[0]['lon'])
            else:
                lat, lon = 20.9343, 77.7489
        except:
            lat, lon = 20.9343, 77.7489

    current = forecaster.get_current(location=city, lat=lat, lon=lon)
    # Attach lat/lon so Compare.jsx can forward them to predict endpoint
    current['lat'] = lat
    current['lon'] = lon
    return jsonify({"status": "success", "data": current})

@app.route('/api/forecast/predict', methods=['POST'])
def predict_aqi():
    data = request.json or {}
    try:
        lat = float(data.get('lat')) if data.get('lat') is not None else 20.9343
        lon = float(data.get('lon')) if data.get('lon') is not None else 77.7489
    except:
        lat, lon = 20.9343, 77.7489
    city = data.get('city', 'Amravati')
    predictions = forecaster.predict_72h(location=city)
    return jsonify({"status": "success", "data": predictions})

# --- Routing API Endpoints ---
@app.route('/api/route/calculate', methods=['POST'])
def calculate_route():
    data = request.json or {}
    start_name = data.get('start_name')
    end_name   = data.get('end_name')
    
    start_coords = None
    if 'start_lat' in data and 'start_lon' in data:
        start_coords = [float(data['start_lon']), float(data['start_lat'])]
        
    end_coords = None
    if 'end_lat' in data and 'end_lon' in data:
        end_coords = [float(data['end_lon']), float(data['end_lat'])]
        
    mode  = data.get('mode', 'driving')
    try:
        lat = float(data.get('lat')) if data.get('lat') else 20.9343
        lon = float(data.get('lon')) if data.get('lon') else 77.7489
    except:
        lat, lon = 20.9343, 77.7489
    city = data.get('city')
    
    if not start_name or not end_name:
        return jsonify({"status": "error", "message": "Start and end locations are required"}), 400
        
    try:
        routes = router.find_routes(start_name, end_name, city, lat, lon, mode, start_coords, end_coords)
        return jsonify({"status": "success", "routes": routes})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Routing calculation failed: {str(e)}"}), 500


# --- Source Detection Endpoints (Now Dynamic) ---
@app.route('/api/source/detect', methods=['GET'])
def detect_sources():
    lat = float(request.args.get('lat', 20.9343))
    lon = float(request.args.get('lon', 77.7489))
    city = request.args.get('city', 'Amravati')
    sources = simulator.detect_city_industries(lat, lon, city)
    return jsonify({"status": "success", "detected_sources": sources})

# --- Colony AQI Pins ---
@app.route('/api/map/pins', methods=['GET'])
def get_map_pins():
    """Returns live AQI data for dynamic map pins."""
    lat = float(request.args.get('lat', 20.9343))
    lon = float(request.args.get('lon', 77.7489))
    city = request.args.get('city', 'Amravati')
    pins = forecaster.get_colony_pins(lat, lon, city)
    return jsonify({"status": "success", "pins": pins})

# --- Health Advisory Endpoints ---
@app.route('/api/health/advisory', methods=['POST'])
def get_advisory():
    data    = request.json or {}
    profile = data.get('profile', {})
    lat = float(profile.get('lat', 20.9343))
    lon = float(profile.get('lon', 77.7489))
    location = profile.get('location', 'Amravati')

    current   = forecaster.get_current(location=location, lat=lat, lon=lon)
    aqi_value = current.get('aqi', 100)

    risk   = advisor.calculate_risk_score(aqi_value, profile)
    advice = advisor.generate_advisory(profile, aqi_value)

    return jsonify({
        "status":          "success",
        "current_aqi":     aqi_value,
        "aqi_category":    current.get("category", ""),
        "pollutants":      {k: current.get(k) for k in ["pm2_5", "pm10", "no2", "o3", "so2", "co"]},
        "risk_assessment": risk,
        "advisory":        advice,
    })

# --- Policy Simulation Endpoints ---
@app.route('/api/policy/scenarios', methods=['GET'])
def get_scenarios():
    lat = float(request.args.get('lat', 20.9343))
    lon = float(request.args.get('lon', 77.7489))
    city = request.args.get('city', 'Amravati')
    # get_available_scenarios will now return dynamic policies
    scenarios = simulator.generate_policies_for_city(lat, lon, city)
    return jsonify({"status": "success", "scenarios": scenarios})

@app.route('/api/policy/simulate', methods=['POST'])
def simulate_policy():
    data             = request.json or {}
    selected_policies = data.get('policies', [])
    lat = float(data.get('lat', 20.9343))
    lon = float(data.get('lon', 77.7489))
    city = data.get('city', 'Amravati')

    # Live current data as the simulation baseline
    current_state        = forecaster.get_current(location=city, lat=lat, lon=lon)
    simulation_result    = simulator.simulate_policy(current_state, selected_policies, city)

    return jsonify({"status": "success", "impact": simulation_result, "baseline_aqi": current_state.get("aqi")})


# --- Alert System Endpoints ---
@app.route('/api/alerts/subscribe', methods=['POST'])
def subscribe_alerts():
    from services.alert_service import AQIAlertService
    svc = AQIAlertService()
    data = request.json or {}
    contact = data.get('contact')
    city = data.get('city', 'Amravati')
    lat = float(data.get('lat', 20.9343))
    lon = float(data.get('lon', 77.7489))
    threshold = int(data.get('threshold', 100))
    contact_type = 'email' if '@' in contact else 'sms'
    try:
        svc.subscribe(contact, contact_type, city, lat, lon, threshold)
        return jsonify({"status": "success", "message": f"You'll receive alerts when AQI exceeds {threshold}"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/api/alerts/unsubscribe', methods=['POST'])  
def unsubscribe_alerts():
    from services.alert_service import AQIAlertService
    svc = AQIAlertService()
    data = request.json or {}
    contact = data.get('contact')
    try:
        svc.unsubscribe(contact)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/api/alerts/test', methods=['POST'])
def test_alert():
    from services.alert_service import AQIAlertService
    svc = AQIAlertService()
    data = request.json or {}
    contact = data.get('contact')
    if not contact:
        return jsonify({"status": "error", "message": "contact is required"}), 400
    contact_type = 'email' if '@' in contact else 'sms'
    city = data.get('city', 'Amravati')
    try:
        if contact_type == 'email':
            svc.send_email_alert(contact, city, 150, "Test Alert")
        else:
            svc.send_sms_alert(contact, city, 150, "Test Alert")
        return jsonify({"status": "success", "message": "Test sent"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/community/report', methods=['POST'])
def community_report():
    from services.reports_management import ReportsManagementService
    from services.alert_service import AQIAlertService
    reports_service = ReportsManagementService()
    alert_service = AQIAlertService()
    data = request.json or {}
    report_type = data.get('type', 'other')
    description = data.get('description', '')
    city = data.get('city', 'Amravati')
    lat = float(data.get('lat', 20.9343))
    lon = float(data.get('lon', 77.7489))

    success, result = reports_service.create_report(report_type, description, city, lat, lon)
    if not success:
        return jsonify({"status": "error", **result}), 500

    notified = alert_service.send_authority_report(report_type, description, city, lat, lon)
    message = "Report submitted and authority notified" if notified else "Report submitted, but authority notification failed"

    return jsonify({
        "status": "success",
        **result,
        "message": message,
        "notified": notified
    }), 201


@app.route('/api/community/reports', methods=['GET'])
def get_community_reports():
    """Fetch community reports for the public community page"""
    try:
        from services.reports_management import ReportsManagementService

        service = ReportsManagementService()
        reports = service.get_all_reports(filter_status=request.args.get('status'))
        return jsonify({"status": "success", "reports": reports}), 200
    except Exception as e:
        print(f"Error fetching community reports: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ─── PDF Download Endpoints ───────────────────────────────────────────────────
@app.route('/api/pdf/forecast', methods=['POST'])
def download_forecast_pdf():
    """Generate a PDF for the 72h AQI forecast and return it as a file download."""
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    data = request.json or {}
    city = data.get('city', 'Unknown')
    predictions = data.get('predictions', [])

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    title = Paragraph(f"<font color='#8B5CF6' size=18><b>EcoStride – 72h AQI Forecast: {city}</b></font>", styles['Normal'])
    elements.append(title)
    elements.append(Spacer(1, 12))

    generated = Paragraph(f"<font size=9 color='grey'>Generated on: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}</font>", styles['Normal'])
    elements.append(generated)
    elements.append(Spacer(1, 18))

    # Table
    table_data = [["Time", "AQI", "Category"]]
    for p in predictions:
        table_data.append([p.get('timestamp', ''), str(p.get('aqi', '')), p.get('category', '')])

    t = Table(table_data, colWidths=[200, 80, 200])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8B5CF6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#F5F0FF'), colors.white]),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (1, 1), (1, -1), 'CENTER'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 16))

    footer = Paragraph("<font size=8 color='grey'>ECOSTRIDE: Environmental Health & Safe Routing Platform</font>", styles['Normal'])
    elements.append(footer)

    doc.build(elements)
    buffer.seek(0)
    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'EcoStride_Forecast_{city}.pdf'
    )


@app.route('/api/pdf/compare', methods=['POST'])
def download_compare_pdf():
    """Generate a comparison PDF for two cities."""
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    data = request.json or {}
    city1 = data.get('city1', 'City 1')
    city2 = data.get('city2', 'City 2')
    d1 = data.get('data1', {})
    d2 = data.get('data2', {})

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []

    title = Paragraph(f"<font color='#00D4FF' size=18><b>EcoStride – City AQI Comparison</b></font>", styles['Normal'])
    elements.append(title)
    elements.append(Spacer(1, 12))

    generated = Paragraph(f"<font size=9 color='grey'>Generated on: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}</font>", styles['Normal'])
    elements.append(generated)
    elements.append(Spacer(1, 18))

    metrics = ['AQI', 'Category', 'PM2.5', 'PM10', 'NO2']
    keys    = ['aqi', 'category', 'pm2_5', 'pm10', 'no2']
    table_data = [["Metric", city1, city2]]
    for metric, key in zip(metrics, keys):
        table_data.append([metric, str(d1.get(key, 'N/A')), str(d2.get(key, 'N/A'))])

    t = Table(table_data, colWidths=[160, 160, 160])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#00D4FF')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#F0FEFF'), colors.white]),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 16))

    footer = Paragraph("<font size=8 color='grey'>ECOSTRIDE: Environmental Health & Safe Routing Platform</font>", styles['Normal'])
    elements.append(footer)

    doc.build(elements)
    buffer.seek(0)
    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'EcoStride_Compare_{city1}_vs_{city2}.pdf'
    )


# --- Authentication & Onboarding Endpoints ---
@app.route('/api/auth/signin', methods=['POST'])
def signin_with_google():
    """
    Verify Google ID token and sign in user
    Expected JSON: { "idToken": "..." }
    """
    try:
        data = request.json or {}
        id_token = data.get('idToken')
        
        if not id_token:
            return jsonify({"status": "error", "message": "idToken is required"}), 400
        
        # Verify token with Firebase
        user_info = verify_google_token(id_token)
        if not user_info:
            return jsonify({"status": "error", "message": "Invalid or expired token"}), 401
        
        uid = user_info['uid']
        email = user_info['email']
        name = user_info['name']
        
        # Check if user exists
        if not user_exists(uid):
            # Create new user
            success, message = create_user(uid, email, name)
            if not success:
                return jsonify({"status": "error", "message": message}), 400
            
            return jsonify({
                "status": "success",
                "message": "User created",
                "user": {
                    "uid": uid,
                    "email": email,
                    "name": name,
                    "isNewUser": True
                }
            }), 201
        else:
            # User exists, return user data
            user_data = get_user_data(uid)
            return jsonify({
                "status": "success",
                "message": "User logged in",
                "user": {
                    "uid": uid,
                    "email": email,
                    "name": name,
                    **user_data
                },
                "isNewUser": False
            }), 200
    
    except Exception as e:
        print(f"Sign-in error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/auth/profile', methods=['GET'])
def get_profile():
    """
    Get user profile data
    Required header: Authorization: Bearer <idToken>
    """
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"status": "error", "message": "No valid authorization token"}), 401
        
        id_token = auth_header[7:]  # Remove 'Bearer '
        user_info = verify_google_token(id_token)
        
        if not user_info:
            return jsonify({"status": "error", "message": "Invalid token"}), 401
        
        uid = user_info['uid']
        user_data = get_user_data(uid)
        
        if not user_data:
            return jsonify({"status": "error", "message": "User not found"}), 404
        
        return jsonify({
            "status": "success",
            "user": {
                "uid": uid,
                **user_data
            }
        }), 200
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/auth/profile', methods=['POST'])
def update_profile():
    """
    Update user profile with onboarding data
    Required header: Authorization: Bearer <idToken>
    Expected JSON: {
        "name": "...",
        "dob": "YYYY-MM-DD",
        "age": 25,
        "medical_conditions": ["Asthma", "..."],
        "activity_level": "Moderate",
        "emergency_contact": "...",
        "allergies": "..."
    }
    """
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"status": "error", "message": "No valid authorization token"}), 401
        
        id_token = auth_header[7:]
        user_info = verify_google_token(id_token)
        
        if not user_info:
            return jsonify({"status": "error", "message": "Invalid token"}), 401
        
        uid = user_info['uid']
        data = request.json or {}
        
        # Prepare profile data
        profile_data = {
            'dob': data.get('dob'),
            'age': data.get('age'),
            'medical_conditions': data.get('medical_conditions', []),
            'activity_level': data.get('activity_level'),
            'profile_completed': True
        }
        
        # Optional fields
        if data.get('emergency_contact'):
            profile_data['emergency_contact'] = data.get('emergency_contact')
        
        if data.get('allergies'):
            profile_data['allergies'] = data.get('allergies')
        
        # Update name if provided
        if data.get('name'):
            profile_data['name'] = data.get('name')
        
        success, message = update_user_profile(uid, profile_data)
        
        if not success:
            return jsonify({"status": "error", "message": message}), 400
        
        return jsonify({
            "status": "success",
            "message": "Profile updated",
            "user": {
                "uid": uid,
                **profile_data
            }
        }), 200
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/auth/check-email', methods=['POST'])
def check_email():
    """
    Check if email is already registered
    Expected JSON: { "email": "..." }
    """
    try:
        data = request.json or {}
        email = data.get('email')
        
        if not email:
            return jsonify({"status": "error", "message": "email is required"}), 400
        
        uid = get_user_by_email(email)
        exists = uid is not None
        
        return jsonify({
            "status": "success",
            "exists": exists
        }), 200
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/auth/verify', methods=['POST'])
def verify_token():
    """
    Verify if a Firebase Google ID token is valid.
    Expected JSON: { "idToken": "..." }
    """
    try:
        data = request.json or {}
        id_token = data.get('idToken')

        if not id_token:
            return jsonify({
                "status": "error",
                "message": "idToken is required"
            }), 400

        # Verify token using Firebase Admin SDK
        user_info = verify_google_token(id_token)

        if not user_info:
            return jsonify({
                "status": "valid",
                "valid": False,
                "message": "Invalid or expired token"
            }), 401

        # Token is valid
        return jsonify({
            "status": "valid",
            "valid": True,
            "user": user_info
        }), 200

    except Exception as e:
        # Log error for debugging
        print("Error verifying token:", e)
        return jsonify({
            "status": "error",
            "message": "Internal server error"
        }), 500
# ─── Admin API Endpoints ──────────────────────────────────────────────────────

@app.route('/api/admin/users', methods=['GET'])
def admin_list_users():
    """
    Return all users from Firebase Realtime DB.
    """
    try:
        from firebase_admin import db as rtdb
        users_ref = rtdb.reference('users')
        users_data = users_ref.get()

        if not users_data:
            return jsonify({"status": "success", "users": []}), 200

        users_list = []
        for uid, data in users_data.items():
            if data:
                users_list.append({
                    "uid":       uid,
                    "name":      data.get("name", ""),
                    "email":     data.get("email", ""),
                    "createdAt": data.get("created_at", ""),
                    "status":    data.get("status", "active"),
                })

        return jsonify({"status": "success", "users": users_list}), 200
    except Exception as e:
        print(f"Admin list users error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/admin/users/<uid>/block', methods=['POST'])
def admin_block_user(uid):
    """Set user status to 'blocked' in Realtime DB."""
    try:
        from firebase_admin import db as rtdb
        user_ref = rtdb.reference(f'users/{uid}')
        if user_ref.get() is None:
            return jsonify({"status": "error", "message": "User not found"}), 404
        user_ref.update({"status": "blocked"})
        return jsonify({"status": "success", "message": "User blocked"}), 200
    except Exception as e:
        print(f"Admin block user error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/admin/users/<uid>/unblock', methods=['POST'])
def admin_unblock_user(uid):
    """Set user status back to 'active' in Realtime DB."""
    try:
        from firebase_admin import db as rtdb
        user_ref = rtdb.reference(f'users/{uid}')
        if user_ref.get() is None:
            return jsonify({"status": "error", "message": "User not found"}), 404
        user_ref.update({"status": "active"})
        return jsonify({"status": "success", "message": "User unblocked"}), 200
    except Exception as e:
        print(f"Admin unblock user error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/admin/users/<uid>', methods=['DELETE'])
def admin_delete_user(uid):
    """
    Delete a user:
    1. Remove from Firebase Auth
    2. Remove from Realtime DB users/
    3. Add email to blacklist/
    """
    try:
        from firebase_admin import auth as fbauth, db as rtdb
        from datetime import datetime

        # Get user data before deletion for blacklist
        user_ref = rtdb.reference(f'users/{uid}')
        user_data = user_ref.get()

        if not user_data:
            return jsonify({"status": "error", "message": "User not found"}), 404

        email = user_data.get("email", "")

        # 1. Delete from Firebase Auth (best-effort)
        try:
            fbauth.delete_user(uid)
        except Exception as auth_err:
            print(f"Firebase Auth delete error (continuing): {auth_err}")

        # 2. Remove from Realtime DB
        user_ref.delete()

        # 3. Blacklist the email
        if email:
            blacklist_ref = rtdb.reference('blacklist')
            blacklist_ref.push({
                "email":     email,
                "blockedAt": datetime.now().isoformat(),
            })

        return jsonify({
            "status":  "success",
            "message": f"User {uid} deleted and email blacklisted."
        }), 200

    except Exception as e:
        print(f"Admin delete user error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ─── Emergency Broadcast Email API Endpoints ──────────────────────────────────

@app.route('/api/admin/broadcast/preview', methods=['POST'])
def preview_broadcast_email():
    """
    Generate a preview of the broadcast email with HTML rendering.
    Expected JSON: {
        "title": "Emergency Alert",
        "message": "System maintenance..."
    }
    """
    try:
        from services.broadcast_email import EmergencyBroadcastService
        
        data = request.json or {}
        title = data.get('title', '')
        message = data.get('message', '')
        
        if not title or not message:
            return jsonify({
                "status": "error",
                "message": "title and message are required"
            }), 400
        
        service = EmergencyBroadcastService()
        html_preview = service.create_email_html(title, message)
        
        return jsonify({
            "status": "success",
            "preview": html_preview
        }), 200
    
    except ValueError as e:
        # SMTP credentials not configured
        return jsonify({
            "status": "error",
            "message": f"Broadcast email not configured: {str(e)}"
        }), 500
    except Exception as e:
        print(f"Preview broadcast email error: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/api/admin/broadcast/send', methods=['POST'])
def send_broadcast_email():
    """
    Send emergency broadcast email to all registered users.
    Expected JSON: {
        "title": "Emergency Alert",
        "message": "System maintenance scheduled...",
        "cc_emails": ["optional@email.com"],  // optional
        "bcc_emails": ["optional@email.com"]  // optional
    }
    """
    try:
        from services.broadcast_email import EmergencyBroadcastService
        
        data = request.json or {}
        title = data.get('title', '')
        message = data.get('message', '')
        cc_emails = data.get('cc_emails', [])
        bcc_emails = data.get('bcc_emails', [])
        
        if not title or not message:
            return jsonify({
                "status": "error",
                "message": "title and message are required"
            }), 400
        
        # Validate email lists
        cc_emails = cc_emails if isinstance(cc_emails, list) else []
        bcc_emails = bcc_emails if isinstance(bcc_emails, list) else []
        
        service = EmergencyBroadcastService()
        success, stats = service.send_broadcast_email(
            title=title,
            message=message,
            cc_emails=cc_emails,
            bcc_emails=bcc_emails
        )
        
        response = {
            "status": "success" if success else "partial",
            "stats": {
                "total": stats.get('total', 0),
                "sent": stats.get('sent', 0),
                "failed": stats.get('failed', 0)
            }
        }
        
        # Include errors if any
        if stats.get('errors'):
            response['errors'] = stats['errors'][:10]  # Limit to first 10 errors
            response['error_count'] = len(stats.get('errors', []))
        
        http_status = 200 if success else (206 if stats.get('sent', 0) > 0 else 500)
        return jsonify(response), http_status
    
    except ValueError as e:
        # SMTP credentials not configured
        return jsonify({
            "status": "error",
            "message": f"Broadcast email not configured: {str(e)}"
        }), 500
    except Exception as e:
        print(f"Send broadcast email error: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route('/api/admin/broadcast/test', methods=['POST'])
def test_broadcast_email():
    """
    Send a test broadcast email to a specific address.
    Expected JSON: {
        "test_email": "test@example.com",
        "title": "Test Email",
        "message": "This is a test message"
    }
    """
    try:
        from services.broadcast_email import EmergencyBroadcastService
        
        data = request.json or {}
        test_email = data.get('test_email', '')
        title = data.get('title', 'Test Email')
        message = data.get('message', 'This is a test broadcast email.')
        
        if not test_email:
            return jsonify({
                "status": "error",
                "message": "test_email is required"
            }), 400
        
        service = EmergencyBroadcastService()
        success, stats = service.send_bulk_email(
            recipient_emails=[test_email],
            title=title,
            message=message
        )
        
        return jsonify({
            "status": "success" if success else "error",
            "message": "Test email sent successfully" if success else "Failed to send test email",
            "sent": stats.get('sent', 0),
            "failed": stats.get('failed', 0),
            "errors": stats.get('errors', [])
        }), (200 if success else 500)
    
    except ValueError as e:
        return jsonify({
            "status": "error",
            "message": f"Broadcast email not configured: {str(e)}"
        }), 500
    except Exception as e:
        print(f"Test broadcast email error: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)}
        ), 500


# ─── Community Message API Endpoints ────────────────────────────────────────

@app.route('/api/community/messages', methods=['GET'])
def get_community_messages():
    """Fetch all active (non-expired) community messages"""
    try:
        from services.community_message import CommunityMessageService
        service = CommunityMessageService()
        messages = service.get_active_messages()
        return jsonify({"status": "success", "messages": messages}), 200
    except Exception as e:
        print(f"Error fetching community messages: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/community/message', methods=['POST'])
def create_public_community_message():
    """Create and publish a community message from the public community page"""
    try:
        from services.community_message import CommunityMessageService

        data = request.json or {}
        title = data.get('title', '')
        content = data.get('content', '')
        expires_at = data.get('expiresAt', '')

        if not title or not content or not expires_at:
            return jsonify({"status": "error", "message": "title, content, and expiresAt are required"}), 400

        service = CommunityMessageService()
        success, result = service.create_message(title, content, expires_at)

        if success:
            return jsonify({"status": "success", **result}), 201
        return jsonify({"status": "error", **result}), 500
    except Exception as e:
        print(f"Error creating community message: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/admin/community/message', methods=['POST'])
def create_community_message():
    """Create and publish a new community message (admin only)"""
    try:
        from services.community_message import CommunityMessageService
        
        data = request.json or {}
        title = data.get('title', '')
        content = data.get('content', '')
        expires_at = data.get('expiresAt', '')
        
        if not title or not content or not expires_at:
            return jsonify({"status": "error", "message": "title, content, and expiresAt are required"}), 400
        
        service = CommunityMessageService()
        success, result = service.create_message(title, content, expires_at)
        
        if success:
            return jsonify({"status": "success", **result}), 201
        else:
            return jsonify({"status": "error", **result}), 500
    except Exception as e:
        print(f"Error creating community message: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/admin/community/message/<message_id>', methods=['PUT'])
def update_community_message(message_id):
    """Update an existing community message (admin only)"""
    try:
        from services.community_message import CommunityMessageService
        
        data = request.json or {}
        title = data.get('title', '')
        content = data.get('content', '')
        expires_at = data.get('expiresAt', '')
        
        if not title or not content or not expires_at:
            return jsonify({"status": "error", "message": "title, content, and expiresAt are required"}), 400
        
        service = CommunityMessageService()
        success, result = service.update_message(message_id, title, content, expires_at)
        
        if success:
            return jsonify({"status": "success", **result}), 200
        else:
            return jsonify({"status": "error", **result}), 500
    except Exception as e:
        print(f"Error updating community message: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/admin/community/message/<message_id>', methods=['DELETE'])
def delete_community_message(message_id):
    """Delete a community message (admin only)"""
    try:
        from services.community_message import CommunityMessageService
        service = CommunityMessageService()
        success, result = service.delete_message(message_id)
        
        if success:
            return jsonify({"status": "success", **result}), 200
        else:
            return jsonify({"status": "error", **result}), 500
    except Exception as e:
        print(f"Error deleting community message: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# ─── Reports Management API Endpoints ───────────────────────────────────────

@app.route('/api/admin/reports', methods=['GET'])
def get_admin_reports():
    """Fetch all reports with optional filtering (admin only)"""
    try:
        from services.reports_management import ReportsManagementService
        
        # Optional filter by status: 'resolved', 'unresolved', or None for all
        status_filter = request.args.get('status', None)
        
        service = ReportsManagementService()
        reports = service.get_all_reports(filter_status=status_filter)
        
        return jsonify({"status": "success", "reports": reports}), 200
    except Exception as e:
        print(f"Error fetching reports: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/admin/reports/stats', methods=['GET'])
def get_reports_stats():
    """Get statistics about all reports (admin only)"""
    try:
        from services.reports_management import ReportsManagementService
        
        service = ReportsManagementService()
        stats = service.get_report_stats()
        
        return jsonify({"status": "success", "stats": stats}), 200
    except Exception as e:
        print(f"Error getting report stats: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/admin/reports/<report_id>/resolve', methods=['POST'])
def resolve_report(report_id):
    """Mark a report as resolved (admin only)"""
    try:
        from services.reports_management import ReportsManagementService
        
        service = ReportsManagementService()
        success, result = service.mark_resolved(report_id)
        
        if success:
            return jsonify({"status": "success", **result}), 200
        else:
            return jsonify({"status": "error", **result}), 500
    except Exception as e:
        print(f"Error resolving report: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/admin/reports/<report_id>/unresolve', methods=['POST'])
def unresolve_report(report_id):
    """Mark a report as unresolved (admin only)"""
    try:
        from services.reports_management import ReportsManagementService
        
        service = ReportsManagementService()
        success, result = service.mark_unresolved(report_id)
        
        if success:
            return jsonify({"status": "success", **result}), 200
        else:
            return jsonify({"status": "error", **result}), 500
    except Exception as e:
        print(f"Error unresolving report: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/admin/reports/<report_id>/comment', methods=['POST'])
def add_report_comment(report_id):
    """Add an admin comment to a report (admin only)"""
    try:
        from services.reports_management import ReportsManagementService
        
        data = request.json or {}
        admin_email = data.get('adminEmail', '')
        comment = data.get('comment', '')
        
        if not admin_email or not comment:
            return jsonify({"status": "error", "message": "adminEmail and comment are required"}), 400
        
        service = ReportsManagementService()
        success, result = service.add_admin_comment(report_id, admin_email, comment)
        
        if success:
            return jsonify({"status": "success", **result}), 201
        else:
            return jsonify({"status": "error", **result}), 500
    except Exception as e:
        print(f"Error adding comment: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/admin/reports/<report_id>', methods=['DELETE'])
def delete_admin_report(report_id):
    """Delete a report (admin only)"""
    try:
        from services.reports_management import ReportsManagementService
        
        service = ReportsManagementService()
        success, result = service.delete_report(report_id)
        
        if success:
            return jsonify({"status": "success", **result}), 200
        else:
            return jsonify({"status": "error", **result}), 500
    except Exception as e:
        print(f"Error deleting report: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    from config import PORT, HOST, DEBUG
    print(f"Starting Team-X project on http://{HOST}:{PORT}")
    app.run(debug=DEBUG, host=HOST, port=PORT)
