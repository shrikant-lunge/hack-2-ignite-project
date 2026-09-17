You are working inside the **EcoStride Environmental Health & Safe Routing Platform** project.

The project stack is:

Frontend:

* React + Vite
* Firebase Authentication
* Firebase Realtime Database
* Existing theme and UI already implemented (do NOT change colors or design system)

Backend:

* Python Flask backend
* SMTP email system already configured
* Firebase Admin SDK available

Your task is to implement a **complete Admin Dashboard system** with secure authentication, user management, and email broadcasting.

IMPORTANT RULES:

* Follow the existing folder structure.
* Follow the existing UI theme and color scheme.
* Reuse existing components when possible.
* Implement proper error handling.
* Do not break the existing authentication system.
* Write clean modular code.

---

1️⃣ ADMIN LOGIN SYSTEM

Create a new page:

/src/pages/AdminLogin.jsx

Requirements:

* Admin logs in using **username + password**
* No signup option
* Credentials are verified using Firebase Realtime Database

Realtime DB structure example:

admins
admin1
username: "admin"
password: "securepassword"

Logic:

* When admin enters credentials:

  * Fetch admin list from Firebase Realtime Database
  * Compare username and password
  * If match → authenticated
  * Save admin session in localStorage
  * Redirect to:

/admin

If authentication fails:

* Show error message:
  "Invalid admin credentials"

Add loading state and proper error handling.

---

2️⃣ ADMIN ROUTE PROTECTION

Create:

/src/components/AdminProtectedRoute.jsx

Logic:

* Check if admin session exists in localStorage
* If not → redirect to:

/admin-login

---

3️⃣ ADMIN DASHBOARD PAGE

Create:

/src/pages/AdminDashboard.jsx

Route:

/admin

Features inside dashboard:

A) USER LIST

Fetch all users from Firebase Realtime Database.

Example structure:

users
uid1
email
name
createdAt
uid2
email
name

Display table:

Columns:

* Name
* Email
* UID
* Status (Active / Blocked)
* Actions

Actions:

* Delete
* Block
* Unblock

---

B) DELETE USER

When admin deletes a user:

Steps:

1. Remove user from:
   Firebase Authentication

2. Remove user data from:
   Realtime DB → users/

3. Add email to blacklist:

blacklist
email1
email: "[user@email.com](mailto:user@email.com)"
blockedAt: timestamp

Show confirmation dialog before deletion.

---
