"""
Firebase Authentication Module
Handles Google Sign-in, user verification, and database operations
"""

import firebase_admin
from firebase_admin import credentials, db, auth
import os
import json
from datetime import datetime

# Initialize Firebase Admin SDK
def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    from config import FIREBASE_DATABASE_URL
    
    # Try to get credentials from environment variable first
    firebase_credentials = os.getenv('FIREBASE_CREDENTIALS')
    
    if firebase_credentials:
        # Parse JSON from environment variable
        creds_dict = json.loads(firebase_credentials)
        cred = credentials.Certificate(creds_dict)
    elif os.path.exists(os.path.join('Keys', 'eco-stride2026.json')):
        # Fallback to local file in Keys/ directory
        cred = credentials.Certificate(os.path.join('Keys', 'eco-stride2026.json'))
    else:
        raise FileNotFoundError(
            "Firebase credentials not found. "
            "Please set FIREBASE_CREDENTIALS environment variable or provide eco-stride2026.json"
        )
    
    # Use database URL from config
    if not FIREBASE_DATABASE_URL:
        raise ValueError(
            "FIREBASE_DATABASE_URL not configured. "
            "Set it in config.py or via FIREBASE_DATABASE_URL environment variable"
        )
    
    firebase_admin.initialize_app(cred, {
        'databaseURL': FIREBASE_DATABASE_URL
    })

def verify_google_token(id_token):
    """
    Verify Google ID token and get user info
    Returns: dict with uid, email, name, or None if invalid
    """
    try:
        decoded_token = auth.verify_id_token(id_token)
        return {
            'uid': decoded_token['uid'],
            'email': decoded_token.get('email'),
            'name': decoded_token.get('name'),
            'picture': decoded_token.get('picture')
        }
    except Exception as e:
        print(f"Token verification failed: {e}")
        return None

def user_exists(uid):
    """Check if user exists in database"""
    try:
        user_ref = db.reference(f'users/{uid}')
        return user_ref.get() is not None
    except Exception as e:
        print(f"Error checking user existence: {e}")
        return False

def get_user_data(uid):
    """Get user data from Firebase Realtime DB"""
    try:
        user_ref = db.reference(f'users/{uid}')
        return user_ref.get()
    except Exception as e:
        print(f"Error fetching user data: {e}")
        return None

def user_email_exists(email):
    """Check if another user with the same email already exists"""
    try:
        users_ref = db.reference('users')
        users = users_ref.get()
        
        if not users:
            return False
        
        for uid, user_data in users.items():
            if user_data and user_data.get('email', '').lower() == email.lower():
                return True
        return False
    except Exception as e:
        print(f"Error checking email existence: {e}")
        return False

def create_user(uid, email, name):
    """
    Create a new user in Firebase Realtime DB
    Returns: success status and message
    """
    try:
        # Check if email already exists
        if user_email_exists(email):
            return False, "Email already registered with another account"
        
        user_ref = db.reference(f'users/{uid}')
        user_ref.set({
            'uid': uid,
            'email': email,
            'name': name,
            'created_at': datetime.now().isoformat()
        })
        return True, "User created successfully"
    except Exception as e:
        print(f"Error creating user: {e}")
        return False, str(e)

def update_user_profile(uid, profile_data):
    """
    Update user profile with onboarding information
    
    Expected profile_data:
    {
        'name': str,
        'dob': str (YYYY-MM-DD),
        'age': int,
        'medical_conditions': list,
        'activity_level': str,
        'emergency_contact': str (optional),
        'allergies': str (optional),
        'profile_completed': bool
    }
    """
    try:
        user_ref = db.reference(f'users/{uid}')
        user_ref.update(profile_data)
        return True, "Profile updated successfully"
    except Exception as e:
        print(f"Error updating profile: {e}")
        return False, str(e)

def get_user_by_email(email):
    """Get user UID by email"""
    try:
        users_ref = db.reference('users')
        users = users_ref.get()
        
        if not users:
            return None
        
        for uid, user_data in users.items():
            if user_data and user_data.get('email', '').lower() == email.lower():
                return uid
        return None
    except Exception as e:
        print(f"Error getting user by email: {e}")
        return None
