# Blazer Rental Management — Madhusanka Tailors

A web app to manage blazer rentals with **cloud sync**, **login protection**, **English/Sinhala** language support, and **mobile-friendly** design.

---

## Login details

| Field | Value |
|-------|-------|
| **Username** | `madhusanka_tailor` |
| **Password** | `Manju1975@` |

> The password is checked securely by **Firebase Authentication** (not stored in the website code).

---

## What changed from local storage

- Data is saved in **Firebase Firestore** (cloud database)
- Updates sync to **phone, tablet, and computer** automatically
- Old browser data is **migrated once** to the cloud on first login
- You must **log in** before using the app

---

## Step 1 — Create Firebase project (free)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** → name it e.g. `madhusanka-tailors`
3. Disable Google Analytics (optional) → **Create project**

### Enable Authentication

1. Open **Build → Authentication → Get started**
2. Click **Sign-in method → Email/Password → Enable → Save**
3. Go to **Users → Add user**
   - Email: `madhusankatailors1994@gmail.com`
   - Password: `Manju1975@`

### Enable Firestore

1. Open **Build → Firestore Database → Create database**
2. Choose **Start in production mode**
3. Pick a region close to you (e.g. `asia-south1`)

### Add web app config

1. Project **Settings** (gear icon) → **Your apps → Web** (`</>`)
2. Register app name: `Blazer Rental`
3. Copy the `firebaseConfig` values
4. Paste them into `js/firebase-config.js` (replace `YOUR_*` placeholders)

Example:

```js
export const firebaseConfig = {
  apiKey: 'AIza...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project-id.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123',
};
```

### Deploy Firestore security rules

1. Install Firebase CLI: `npm install -g firebase-tools`
2. In this folder run:

```bash
firebase login
firebase init firestore
# Select your project, use firestore.rules from this repo
firebase deploy --only firestore:rules
```

Or paste the contents of `firestore.rules` manually in Firebase Console → Firestore → **Rules** → **Publish**.

### Authorize your website domain

1. **Authentication → Settings → Authorized domains**
2. Add your GitHub Pages URL, e.g.:
   - `yourusername.github.io`

---

## Step 2 — Publish to GitHub Pages

### Create GitHub repository

```bash
cd "Blazer Rental Management Madhusanka Tailors"
git init
git add .
git commit -m "Add blazer rental app with cloud sync and login"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Enable GitHub Pages

1. Open your repo on GitHub
2. **Settings → Pages**
3. **Build and deployment → Source**: `GitHub Actions`
4. Push to `main` — the workflow in `.github/workflows/pages.yml` deploys automatically

Your site will be live at:

`https://YOUR_USERNAME.github.io/YOUR_REPO/`

---

## Step 3 — Test

1. Open your GitHub Pages URL
2. You are redirected to **login.html**
3. Sign in with:
   - Username: `madhusanka_tailor`
   - Password: `Manju1975@`
4. Add a booking on your phone — it should appear on your computer too

---

## Project structure

```
index.html          Main app (requires login)
login.html          Login page
setup.html          Shown if Firebase is not configured
js/
  app.js            Rental management logic
  auth.js           Login / logout
  storage.js        Cloud sync (Firestore)
  firebase.js       Firebase initialization
  firebase-config.js  ← Add your Firebase keys here
  i18n.js           English / Sinhala translations
css/styles.css      Responsive styles
firestore.rules     Database security rules
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Redirects to `setup.html` | Fill in `js/firebase-config.js` |
| Invalid username/password | Create Firebase user with exact email above |
| Sync error | Check internet; verify Firestore rules are published |
| Login works locally but not on GitHub | Add `yourusername.github.io` to Firebase authorized domains |

---

## Security note

This app is suitable for a small business internal tool. Keep your Firebase login password private. Only share the username/password with trusted staff.
