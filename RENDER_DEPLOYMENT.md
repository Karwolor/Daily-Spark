# DailySpark - Render Deployment Guide

## Overview
This guide explains how to deploy DailySpark to Render. The app uses Firebase for backend services while being served from a Node.js/Express server on Render.

## Prerequisites
- GitHub account with your DailySpark repository
- Render account (free tier available at https://render.com)
- Firebase project already set up
- Stripe account (for payments)

## Step 1: Prepare Your Repository

1. **Ensure you have these files in your project root:**
   - `server.js` - Express server
   - `render.yaml` - Render configuration
   - `package.json` - Node.js dependencies

2. **Update package.json scripts:**
   ```json
   "scripts": {
     "start": "node server.js",
     "build": "npm run build-css",
     "build-css": "tailwindcss -i ./assets/css/main.css -o ./assets/css/output.css --minify"
   }
   ```

3. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Prepare for Render deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/dailyspark.git
   git push -u origin main
   ```

## Step 2: Create Render Web Service

1. **Go to https://dashboard.render.com**
2. **Click "New +"** → Select **"Web Service"**
3. **Connect your GitHub repository**
   - Click "Connect" next to your dailyspark repo
   - Grant Render access if needed

4. **Configure the Service:**
   - **Name:** `dailyspark`
   - **Environment:** `Node`
   - **Region:** Choose closest to you
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free (or Paid for better uptime)

## Step 3: Configure Environment Variables

1. **In Render dashboard, go to your service → Environment**
2. **Add these environment variables:**

   ```
   NODE_ENV=production
   PORT=3000
   DOMAIN=https://YOUR_RENDER_URL.onrender.com
   
   FIREBASE_API_KEY=<your_firebase_api_key>
   FIREBASE_AUTH_DOMAIN=<your_project>.firebaseapp.com
   FIREBASE_PROJECT_ID=<your_project_id>
   FIREBASE_STORAGE_BUCKET=<your_project>.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=<your_sender_id>
   FIREBASE_APP_ID=<your_app_id>
   
   STRIPE_PUBLISHABLE_KEY=pk_test_or_live_key
   STRIPE_SECRET_KEY=sk_test_or_live_key
   ```

   **Get these values from:**
   - **Firebase:** Project Settings → General tab
   - **Stripe:** Dashboard → Developers → API Keys

3. **Click "Save"** - Your service will auto-deploy

## Step 4: Verify Your Deployment

- Wait for the build to complete (usually 2-3 minutes)
- Visit `https://YOUR_RENDER_URL.onrender.com`
- Check `/health` endpoint: `https://YOUR_RENDER_URL.onrender.com/health`
- Test Firebase login functionality
- Verify Firestore reads/writes work

## Step 5: Configure Stripe Webhook (Optional but Recommended)

1. **In Stripe Dashboard, go to Developers → Webhooks**
2. **Click "Add Endpoint"**
3. **Endpoint URL:** `https://YOUR_RENDER_URL.onrender.com/api/stripe-webhook`
4. **Events:** Select `customer.subscription.created`, `customer.subscription.deleted`
5. **Copy the signing secret** and add to Render environment variables:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

## Step 6: Domain Setup (Optional)

### Custom Domain
1. Go to Render dashboard → Your service → Settings
2. **Custom Domain:** Add your domain (e.g., `dailyspark.com`)
3. Follow DNS setup instructions

### Update Firebase/Stripe URLs
Update authorized domains in:
- **Firebase Console:** Project Settings → Authorized domains
- **Stripe Dashboard:** Settings → Authorized URLs

## Troubleshooting

### Cold Starts
Free tier services go to sleep after 15 mins of inactivity. Use Render's paid tier for production.

### Build Fails
- Check build logs: Dashboard → Your service → "Logs"
- Ensure all dependencies in `package.json` are listed
- Make sure `.env` isn't committed to Git (use `.env.example` instead)

### Firebase Issues
- Verify environment variables are set correctly
- Check Firebase security rules allow your domain
- Test with `/health` endpoint first

### Stripe Webhook Errors
- Verify webhook secret is correct
- Check function logs for errors
- Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe-webhook`

## Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] `server.js` created and working
- [ ] `render.yaml` configured
- [ ] Render service connected to GitHub
- [ ] All environment variables set in Render
- [ ] Build completes successfully
- [ ] Health check endpoint responds
- [ ] Firebase login works
- [ ] Stripe integration tested
- [ ] Custom domain configured (optional)

## Updating Your App

Simply push changes to `main` branch:
```bash
git add .
git commit -m "Update feature"
git push origin main
```

Render will automatically rebuild and redeploy within 2-3 minutes!

## Next Steps

- Monitor performance in Render Dashboard
- Set up error alerts
- Enable auto-deploy on push
- Upgrade to paid plan for production reliability
- Set up backup strategies for Firestore

---

**Need help?** Check:
- Render Docs: https://render.com/docs
- Firebase Docs: https://firebase.google.com/docs
- Express.js Docs: https://expressjs.com
