import sqlite3
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import datetime
import requests
import os

try:
    from config import SMTP_EMAIL, SMTP_APP_PASSWORD, FAST2SMS_API_KEY, AUTHORITY_EMAIL
except ImportError:
    SMTP_EMAIL = ""
    SMTP_APP_PASSWORD = ""
    FAST2SMS_API_KEY = ""
    AUTHORITY_EMAIL = ""

class AQIAlertService:
    def __init__(self):
        self.db_path = os.path.join(os.path.dirname(__file__), '..', 'database', 'teamx.db')
        self._create_tables()
    
    def _create_tables(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
        CREATE TABLE IF NOT EXISTS subscribers (
            id INTEGER PRIMARY KEY,
            contact TEXT NOT NULL,
            contact_type TEXT NOT NULL,
            city TEXT NOT NULL,
            lat REAL, lon REAL,
            threshold INTEGER DEFAULT 100,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        c.execute('''
        CREATE TABLE IF NOT EXISTS alert_logs (
            id INTEGER PRIMARY KEY,
            subscriber_id INTEGER,
            city TEXT,
            aqi INTEGER,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        c.execute('''
        CREATE TABLE IF NOT EXISTS community_reports (
            id INTEGER PRIMARY KEY,
            report_type TEXT NOT NULL,
            description TEXT,
            city TEXT,
            lat REAL,
            lon REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        conn.commit()
        conn.close()
        
    def subscribe(self, contact, contact_type, city, lat, lon, threshold=100):
        # Remove existing subscription for this contact
        self.unsubscribe(contact)

        # Save new subscription to DB
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
        INSERT INTO subscribers (contact, contact_type, city, lat, lon, threshold)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (contact, contact_type, city, lat, lon, threshold))
        conn.commit()
        conn.close()

        # FIX: Send confirmation immediately on subscribe
        if contact_type == 'email':
            self._send_subscription_confirmation(contact, city, threshold)
        elif contact_type == 'sms':
            self._send_sms_confirmation(contact, city, threshold)

    def _send_subscription_confirmation(self, email_addr, city, threshold):
        """Send a confirmation email immediately when user subscribes."""
        if not SMTP_EMAIL or not SMTP_APP_PASSWORD:
            print("Confirmation email not sent: SMTP credentials missing")
            return

        html = f"""
        <html><body style="font-family:Arial;background:#0d1117;color:#fff;padding:20px">
          <div style="max-width:600px;margin:auto;background:#161b22;border-radius:16px;padding:24px;border:1px solid #30363d">

            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
              <span style="font-size:2rem">🌿</span>
              <h2 style="margin:0;color:#00e5a0;font-family:Arial">EcoStride</h2>
            </div>

            <h3 style="color:#e8f0f2;margin-bottom:8px">✅ You're subscribed to AQI Alerts!</h3>
            <p style="color:#7a9ba8;margin-bottom:20px">
              You'll receive an alert email whenever the Air Quality Index in 
              <strong style="color:#e8f0f2">{city}</strong> exceeds 
              <strong style="color:#f5c542">AQI {threshold}</strong>.
            </p>

            <div style="background:#0d1518;border:1px solid #30363d;border-radius:12px;padding:16px;margin-bottom:20px">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="color:#7a9ba8;font-size:0.85rem">📍 City</span>
                <span style="color:#e8f0f2;font-weight:bold">{city}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="color:#7a9ba8;font-size:0.85rem">⚠️ Alert Threshold</span>
                <span style="color:#f5c542;font-weight:bold">AQI &gt; {threshold}</span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span style="color:#7a9ba8;font-size:0.85rem">📧 Subscribed Email</span>
                <span style="color:#e8f0f2">{email_addr}</span>
              </div>
            </div>

            <p style="color:#7a9ba8;font-size:0.85rem;margin-bottom:20px">
              When AQI crosses your threshold, we'll send you health recommendations 
              and safe routing suggestions instantly.
            </p>

            <a href="https://noninfallibly-extraversive-fairy.ngrok-free.dev" 
               style="background:#00e5a0;color:#080d0f;padding:12px 24px;border-radius:8px;
                      text-decoration:none;display:inline-block;font-weight:bold;font-size:0.9rem">
              🗺️ View Live AQI Dashboard
            </a>

            <hr style="border:none;border-top:1px solid #30363d;margin:24px 0">
            <p style="color:#3d5a64;font-size:0.75rem;text-align:center">
              EcoStride — Environmental Health & Safe Routing Platform<br>
              To unsubscribe, visit the Community page and enter your email.
            </p>
          </div>
        </body></html>"""

        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"✅ EcoStride Alert Subscription Confirmed — {city}"
        msg['From']    = SMTP_EMAIL
        msg['To']      = email_addr
        msg.attach(MIMEText(html, 'html'))

        try:
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
            server.send_message(msg)
            server.quit()
            print(f"Confirmation email sent to {email_addr}")
        except Exception as e:
            print(f"Failed to send confirmation email to {email_addr}: {e}")

    def _send_sms_confirmation(self, phone, city, threshold):
        """Send confirmation SMS immediately when user subscribes."""
        if not FAST2SMS_API_KEY:
            print("SMS confirmation not sent: Fast2SMS API key missing")
            return
        msg = f"EcoStride: You're subscribed to AQI alerts for {city}. You'll be notified when AQI exceeds {threshold}. Reply STOP to unsubscribe."
        url = "https://www.fast2sms.com/dev/bulkV2"
        payload = {
            "route": "q",
            "message": msg,
            "language": "english",
            "flash": 0,
            "numbers": phone.replace('+91', '').strip()
        }
        headers = {
            "authorization": FAST2SMS_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        try:
            requests.post(url, data=payload, headers=headers)
            print(f"Confirmation SMS sent to {phone}")
        except Exception as e:
            print(f"Failed to send confirmation SMS: {e}")

    def unsubscribe(self, contact):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('DELETE FROM subscribers WHERE contact = ?', (contact,))
        conn.commit()
        conn.close()
        
    def send_email_alert(self, email_addr, city, aqi, message):
        if not SMTP_EMAIL or not SMTP_APP_PASSWORD:
            print("Email not sent: SMTP credentials missing")
            return
            
        html = f"""
        <html><body style="font-family:Arial;background:#0d1117;color:#fff;padding:20px">
          <div style="max-width:600px;margin:auto;background:#161b22;border-radius:16px;padding:24px;border:1px solid #30363d">

            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
              <span style="font-size:2rem">🌿</span>
              <h2 style="margin:0;color:#00e5a0">EcoStride</h2>
            </div>

            <h2 style="color:#ff4f6b;margin-bottom:8px">⚠️ AQI Health Alert — {city}</h2>

            <div style="background:#ff4f6b22;border:1px solid #ff4f6b44;border-radius:12px;
                        padding:20px;text-align:center;margin-bottom:20px">
              <div style="font-size:56px;font-weight:bold;color:#ff4f6b;line-height:1">{aqi}</div>
              <div style="color:#7a9ba8;font-size:0.85rem;margin-top:4px">Current AQI Level</div>
            </div>

            <p style="color:#e8f0f2">
              Air quality in <strong>{city}</strong> has reached 
              <strong style="color:#ff4f6b">AQI {aqi}</strong> — above your alert threshold.
            </p>

            <div style="background:#0d1518;border:1px solid #30363d;border-radius:12px;padding:16px;margin:16px 0">
              <p style="color:#f5c542;font-weight:bold;margin-bottom:8px">🛡️ Health Recommendations:</p>
              <ul style="color:#7a9ba8;margin:0;padding-left:20px;line-height:1.8">
                <li>Stay indoors and keep windows closed</li>
                <li>Use air purifiers if available</li>
                <li>Wear N95 mask if going outside is unavoidable</li>
                <li>Avoid exercise and outdoor activities</li>
                <li>Keep children and elderly indoors</li>
              </ul>
            </div>

            <a href="http://localhost:5173" 
               style="background:#00e5a0;color:#080d0f;padding:12px 24px;border-radius:8px;
                      text-decoration:none;display:inline-block;font-weight:bold;font-size:0.9rem">
              🗺️ View Safe Routes on EcoStride
            </a>

            <hr style="border:none;border-top:1px solid #30363d;margin:24px 0">
            <p style="color:#3d5a64;font-size:0.75rem;text-align:center">
              EcoStride — Environmental Health & Safe Routing Platform<br>
              To unsubscribe, visit the Community page and enter your email.
            </p>
          </div>
        </body></html>"""
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"⚠️ AQI Alert: {city} is at {aqi} — Stay Safe"
        msg['From']    = SMTP_EMAIL
        msg['To']      = email_addr
        msg.attach(MIMEText(html, 'html'))
        
        try:
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
            server.send_message(msg)
            server.quit()
            print(f"Alert email sent to {email_addr}")
        except Exception as e:
            print(f"Failed to send email to {email_addr}: {e}")

    def send_authority_report(self, report_type, description, city, lat, lon):
        if not SMTP_EMAIL or not SMTP_APP_PASSWORD or not AUTHORITY_EMAIL:
            print("Authority report not sent: Missing credentials or authority email")
            return False

        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
        INSERT INTO community_reports (report_type, description, city, lat, lon)
        VALUES (?, ?, ?, ?, ?)
        ''', (report_type, description, city, lat, lon))
        conn.commit()
        conn.close()

        subject = f"🚨 COMMUNITY REPORT: {report_type.upper()} in {city}"
        body = f"""
        <html><body style="font-family:Arial;background:#f8f9fa;padding:20px">
          <div style="max-width:600px;margin:auto;background:#fff;border:1px solid #ddd;border-radius:8px;padding:24px">
            <h2 style="color:#d32f2f">Community Pollution Report</h2>
            <hr>
            <p><strong>Type:</strong> {report_type}</p>
            <p><strong>City:</strong> {city}</p>
            <p><strong>Location:</strong> {lat}, {lon}</p>
            <p><strong>Description:</strong> {description or 'No description provided'}</p>
            <p><strong>Timestamp:</strong> {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <hr>
            <p style="font-size:0.8rem;color:#666">This is an automated report from EcoStride.</p>
          </div>
        </body></html>
        """
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From']    = SMTP_EMAIL
        msg['To']      = AUTHORITY_EMAIL
        msg.attach(MIMEText(body, 'html'))

        try:
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
            server.send_message(msg)
            server.quit()
            return True
        except Exception as e:
            print(f"Failed to send authority report: {e}")
            return False
        
    def send_sms_alert(self, phone, city, aqi, message):
        if not FAST2SMS_API_KEY:
            print("SMS not sent: Fast2SMS API key missing")
            return
            
        msg = f"ALERT: AQI in {city} is {aqi}. Stay indoors. Avoid outdoor activities. Visit EcoStride for safe routes. Reply STOP to unsubscribe."
        url = "https://www.fast2sms.com/dev/bulkV2"
        payload = {
            "route": "q",
            "message": msg,
            "language": "english",
            "flash": 0,
            "numbers": phone.replace('+91', '').strip()
        }
        headers = {
            "authorization": FAST2SMS_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded"
        }
        try:
            requests.post(url, data=payload, headers=headers)
        except Exception as e:
            print(f"Failed to send SMS: {e}")
        
    def check_and_send_alerts(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('SELECT id, contact, contact_type, city, lat, lon, threshold FROM subscribers WHERE active=1')
        subscribers = c.fetchall()
        conn.close()
        
        from models.forecasting import AQIForecaster
        forecaster = AQIForecaster()
        
        for sub in subscribers:
            sid, contact, ctype, city, lat, lon, threshold = sub
            try:
                current = forecaster.get_current(location=city, lat=lat, lon=lon)
                aqi = current.get('aqi', 0)
                if aqi > threshold:
                    conn = sqlite3.connect(self.db_path)
                    c = conn.cursor()
                    c.execute('SELECT sent_at FROM alert_logs WHERE subscriber_id=? ORDER BY sent_at DESC LIMIT 1', (sid,))
                    row = c.fetchone()
                    
                    can_send = True
                    if row:
                        last_sent = datetime.datetime.strptime(row[0], '%Y-%m-%d %H:%M:%S')
                        if (datetime.datetime.now() - last_sent).total_seconds() < 4 * 3600:
                            can_send = False
                            
                    if can_send:
                        if ctype == 'email':
                            self.send_email_alert(contact, city, aqi, "")
                        else:
                            self.send_sms_alert(contact, city, aqi, "")
                            
                        c.execute('INSERT INTO alert_logs (subscriber_id, city, aqi) VALUES (?, ?, ?)', (sid, city, aqi))
                        conn.commit()
                    conn.close()
            except Exception as e:
                print(f"Error processing subscriber {sid}: {e}")