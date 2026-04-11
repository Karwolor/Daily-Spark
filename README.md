# DailySpark (MVP)

A minimal PWA that merges a one-line daily diary (LifeLog) with 1‑minute daily challenges (MicroHabit).

## Quick start

1. Serve locally (any static server). On Windows, you can open index.html directly, but Service Worker needs http(s).
2. Replace placeholder icons at `assets/icons/icon-192.png` and `assets/icons/icon-512.png` with actual PNG files (download from icons8.com or flaticon.com).
3. Configure Firebase (already set up) and Hugging Face token (prompted in app).
4. Enable notifications by clicking the 🔔 button after signing in.

## Setup Instructions

### 1. Hugging Face AI Token (Required for AI features)

- Sign up at [huggingface.co](https://huggingface.co)
- Go to Settings → Access Tokens → Create new token
- In browser console, run: `localStorage.setItem('HF_TOKEN', 'hf_xxxxxxxxxxxxxxxxxxxxxxxxx');`
- **Recommended (CORS-safe):** Deploy a server-side proxy using Firebase Functions and store your token in Functions config. After deployment you can set the proxy URL in the browser:
  - `firebase functions:config:set huggingface.token="hf_xxxxxxxxxxxxxxxxx"`
  - Deploy the function: `cd functions && npm install && firebase deploy --only functions:hfProxy`
  - Configure client to use proxy (optional): in browser console run `localStorage.setItem('HF_PROXY','https://us-central1-YOUR_PROJECT.cloudfunctions.net/hfProxy')` or set `window.HF_PROXY_URL` before app init.
  - The app will try the proxy (`/api/hf` or the configured `HF_PROXY`) first and fall back to direct HF calls if proxy is unavailable.

### 2. Stripe Payment Keys (Required for Premium features)

- Sign up at [stripe.com](https://stripe.com)
- Get your publishable key from Dashboard → Developers → API keys
- Replace `pk_test_YOUR_STRIPE_PUBLISHABLE_KEY` in `assets/js/app.js`
- Create a "Premium Subscription" product in Stripe Dashboard

### 3. Firebase Cloud Functions (Optional for automated notifications)

- Install dependencies: `cd functions && npm install`
- Deploy functions: `firebase deploy --only functions`
- Functions include daily reminders and weekly summaries

### 4. Deploy to Production

- Install Firebase CLI: `npm install -g firebase-tools`
- Login: `firebase login`
- Initialize: `firebase init` (select Hosting, Functions, Firestore)
- Deploy: `firebase deploy`

## Data Persistence

**Anonymous Users**: Data persists in Firestore but is tied to the anonymous user ID. Clearing browser data will lose access to saved journals.

**Authenticated Users**: Data syncs across devices and can be recovered if you lose access to your account.

## Features

- Daily log with AI mood analysis (Hugging Face)
- 1-minute challenges (AI-generated)
- Streak tracking and insights
- Shareable cards (export as image)
- PWA with offline support
- Push notifications (Firebase Messaging)
- Analytics tracking

## Authentication Options

Your app supports multiple authentication methods:

### Current: Anonymous Authentication (No Login Required)

- ✅ Zero friction - users start immediately
- ✅ Privacy-focused - no personal data required
- ✅ Perfect for casual journaling
- ❌ Data tied to browser/device (lost if cleared)
- ❌ No account recovery or cross-device sync

### Optional: Full Authentication (For Production)

- **Google Sign-In**: One-click login with Google account
- **Email/Password**: Traditional account creation
- **Benefits**: Cross-device sync, data recovery, personalized features

To enable full authentication, uncomment the login options in the header dropdown.

## Firebase setup (free tier)

- Already configured in `assets/js/firebase.js`.
- Supports Anonymous, Google, and Email/Password authentication
- Enables Authentication (Anonymous), Firestore, Analytics, Messaging.
- Uses Firebase compat CDN.

### Firestore rules (recommended)

To enable the app to read/write a user's logs and challenges, create and deploy Firestore security rules that allow users to access their own documents only:

1. Edit `firestore.rules` (a sample is included in the repo):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{documents=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

2. Deploy rules to your Firebase project:

- Using the CLI (recommended):
  - `firebase login`
  - `firebase deploy --only firestore:rules`
  - Or run `npm run deploy:firestore` from the project root.

3. Verify:

- In Firebase Console → Firestore → Rules, confirm the rules are active.
- In the app, sign in (anonymous is OK) and try **Save Entry** and **Mark Done**; you should no longer see permission errors.

> Note: Keep rules least-privilege. The above allows each authenticated user to read and write their own documents only.


## Hugging Face (free tier)

- Token prompted in app if needed.
- Features: sentiment (SST-2), summarization (BART), challenge generation (GPT-2 fallback).

## Deploy (Firebase Hosting)

- Install Firebase CLI and initialize hosting in this folder.
- Set `public` to `.` and deploy. CDN + HTTPS included.

## Notes

- This is a no-build stack (CDN libraries). You can later migrate to a framework.
- Notifications require HTTPS in production.
