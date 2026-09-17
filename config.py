import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ─── API Keys (loaded from environment) ──────────────────
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
AQICN_API_TOKEN = os.getenv("AQICN_API_TOKEN", "")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
USE_LOCAL_LLM = os.getenv("USE_LOCAL_LLM", "false").lower() == "true"

# ── AirGuard Agent (Claude) ─────────────────────────────
# Get your free key at: https://console.anthropic.com
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Govt India Open Data Portal (Data.gov.in)
GOV_INDIA_API_KEY = os.getenv("GOV_INDIA_API_KEY", "")
GOV_INDIA_RESOURCE_ID = os.getenv("GOV_INDIA_RESOURCE_ID", "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69")

# ─── Database ─────────────────────────────────
DATABASE_PATH = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "database", "teamx.db"))

# ─── Server ──────────────────────────────────
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 5000))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# ─── Data Update Intervals ───────────────────
DATA_UPDATE_INTERVAL = int(os.getenv("DATA_UPDATE_INTERVAL", 15))  # minutes
FORECAST_RETRAIN_DAYS = int(os.getenv("FORECAST_RETRAIN_DAYS", 7))

# ─── Caching & Updates ───────────────────────
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "true").lower() == "true"
CACHE_DURATION = int(os.getenv("CACHE_DURATION", 900))  # seconds (15 min)

# ─── Email / SMS Alerts (Optional) ───────────
# SMTP_EMAIL            = os.getenv("SMTP_EMAIL", "")
# SMTP_APP_PASSWORD     = os.getenv("SMTP_APP_PASSWORD", "")
# AUTHORITY_EMAIL       = os.getenv("AUTHORITY_EMAIL", "")
# FAST2SMS_API_KEY      = os.getenv("FAST2SMS_API_KEY", "")

# ─── Firebase Configuration ──────────────────
# IMPORTANT: Set these environment variables or use a .env file
# Get your Firebase Database URL from Firebase Console > Realtime Database > Your Project
FIREBASE_DATABASE_URL = os.getenv(
    'FIREBASE_DATABASE_URL',
    'https://eco-stride2026-default-rtdb.firebaseio.com'
)

# Firebase Security Rules - If you see 404 errors, update your Firebase Console with these rules:
# Go to: Firebase Console > Your Project > Realtime Database > Rules tab
# Copy and paste this JSON:
"""
{
  "rules": {
    "users": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "communityMessages": {
      ".read": true,
      ".write": "auth != null"
    },
    "communityReports": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "blacklist": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    ".read": false,
    ".write": false
  }
}
"""

# Local fallback storage for when Firebase is unavailable
USE_LOCAL_STORAGE_FALLBACK = os.getenv('USE_LOCAL_STORAGE_FALLBACK', 'true').lower() == 'true'
LOCAL_STORAGE_PATH = os.path.join(os.path.dirname(__file__), 'local_storage')