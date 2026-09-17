# Quick Start Guide - Authentication System

Get the auth system running in 10 minutes!

## Step 1: Firebase Setup (5 min)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project
3. Enable **Authentication** → **Google Sign-in**
4. Create **Realtime Database** (Test Mode)
5. Get database URL: `https://your-project.firebaseio.com`
6. Download Service Account Key (Project Settings → Service Accounts → Generate Private Key)

## Step 2: Backend Setup (2 min)

### Create `.env` file (project root):
```
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

### Add `firebase-key.json` to project root:
Copy the service account JSON file you downloaded

### No need to edit `app.py` - auth endpoints already there! ✓

## Step 3: Frontend Setup (2 min)

### Create `frontend/.env` file:
Get config from Firebase Console → Project Settings → Your Apps:

```
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abc...
```

## Step 4: Run It! (1 min)

### Terminal 1 - Backend:
```bash
pip install -r requirements.txt
python app.py
```
→ http://localhost:5000

### Terminal 2 - Frontend:
```bash
cd frontend
npm install
npm run dev
```
→ http://localhost:5173

## Done! 🎉

You now have:
- ✓ Landing page with Google Sign-in
- ✓ Profile setup onboarding form
- ✓ User data saved to Firebase
- ✓ Protected dashboard routes
- ✓ Automatic login on page refresh
- ✓ User profile display in sidebar

## What's Working

| Feature | Status |
|---------|--------|
| Google Sign-in | ✓ |
| New user detection | ✓ |
| Profile setup form | ✓ |
| Medical conditions selection | ✓ |
| Age calculation | ✓ |
| Data persistence in Firebase | ✓ |
| Protected routes | ✓ |
| User profile in sidebar | ✓ |
| Logout functionality | ✓ |
| Auto-login on refresh | ✓ |

## Troubleshot?

**Google Sign-in doesn't work:**
→ Add `localhost:5173` to Firebase Console → Auth → Authorized domains

**Backend error "Firebase initialization failed":**
→ Check `firebase-key.json` is in project root

**Profile won't save:**
→ Check backend is running and Firebase credentials are correct

**Need more help?**
→ See `AUTH_SYSTEM.md` for detailed documentation

## File Guide

Important files (don't need to edit, already done):

```
✓ frontend/src/context/AuthContext.jsx (handles auth state)
✓ frontend/src/pages/Landing.jsx (login page)
✓ frontend/src/pages/ProfileSetup.jsx (onboarding form)
✓ frontend/src/components/ProtectedRoute.jsx (route protection)
✓ frontend/src/utils/firebase.js (Firebase config)
✓ backend/auth.py (Firebase operations)
✓ backend/app.py (auth endpoints)
```

## Key URLs

- Landing/Login: `http://localhost:5173/` or `/login`
- Profile Setup: `http://localhost:5173/profile-setup`
- Dashboard: `http://localhost:5173/dashboard`

## Next Steps

1. ✓ Get it running (you're here!)
2. ✓ Test Google Sign-in
3. ✓ Fill profile setup form
4. ✓ See your data in Firebase Console
5. Customize medical conditions list (see AUTH_SYSTEM.md)
6. Customize styling
7. Deploy to production

---

**All code is production-ready!** Just plug in your Firebase credentials and go.
