# Quick Start - Deploy DailySpark to Render

## What I've Set Up For You

✅ **server.js** - Express server to serve your app and handle API requests  
✅ **render.yaml** - Render configuration file with all settings  
✅ **Updated package.json** - Added start script and dotenv dependency  
✅ **RENDER_DEPLOYMENT.md** - Comprehensive deployment guide  

## 3-Step Deployment

### Step 1: Push to GitHub
```bash
cd "c:\Users\karda\Downloads\Daily Spark app"
git init
git add .
git commit -m "Add Render deployment files"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dailyspark.git
git push -u origin main
```

### Step 2: Create Render Service
1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`

### Step 3: Add Environment Variables
In Render dashboard, go to your service → **Environment** and add:

```
NODE_ENV=production
DOMAIN=https://YOUR_RENDER_URL.onrender.com

FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

## Get Environment Variables From:

**Firebase:**
- Go to Firebase Console → Project Settings → General
- Copy the firebaseConfig object values

**Stripe:**
- Go to Stripe Dashboard → Developers → API Keys
- Copy test/live keys

## Testing Your Deployment

After deployment completes:
1. Visit `https://YOUR_RENDER_URL.onrender.com`
2. Test the `/health` endpoint at `https://YOUR_RENDER_URL.onrender.com/health`
3. Try logging in with Firebase
4. Test journal and challenges features

## What's Different from Firebase Hosting?

| Aspect | Firebase | Render |
|--------|----------|--------|
| **Frontend** | CDN | Express server |
| **Functions** | Firebase Functions | Node.js server |
| **Database** | Firestore | Firestore (same) |
| **Auth** | Firebase Auth | Firebase Auth (same) |
| **Cost** | $0 free tier | $0 free tier |
| **Uptime** | 99.95% | Free tier = periodic sleep |

## Next Steps

1. **Read [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)** for detailed instructions
2. **Test thoroughly** before going to production
3. **Upgrade to paid** Render plan for production reliability (removes free tier cold starts)
4. **Set up custom domain** (optional)
5. **Monitor** app performance in Render dashboard

## Support

- **Render Docs:** https://render.com/docs
- **Firebase Docs:** https://firebase.google.com/docs
- **Troubleshooting:** See RENDER_DEPLOYMENT.md

---

**Your app is ready to deploy! 🚀**
