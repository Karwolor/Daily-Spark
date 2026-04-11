# DAILYSPARK Deployment Guide

## Firebase Setup & Deployment

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login & Initialize

```bash
firebase login
firebase init
# Select: Hosting, Functions, Firestore
# Choose your project: dailyspark-abdc9
```

### 3. Deploy Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 4. Deploy Hosting

```bash
firebase deploy --only hosting
```

## Stripe Setup for Monetization

### 1. Create Stripe Account

- Go to [stripe.com](https://stripe.com) and sign up (free).

### 2. Create Products

- Create a "Premium Subscription" product with monthly/yearly pricing.

### 3. Get API Keys

- Replace `pk_test_YOUR_STRIPE_PUBLISHABLE_KEY` in app.js with your publishable key.
- Set up webhook for subscription updates.

### 4. Webhook Handler (Add to Functions)

```javascript
exports.handleStripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.get("stripe-signature");
  try {
    const event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      endpointSecret,
    );
    if (event.type === "customer.subscription.created") {
      const uid = event.data.object.client_reference_id;
      await updatePremiumStatus(uid, true);
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
```

## Alternative Free Hosting

- **Vercel**: `vercel --prod`
- **Netlify**: Drag & drop build folder

## Analytics Setup

- Google Analytics: Add GA4 property and tracking ID.
- Firebase Analytics: Already enabled.

## Notifications

- Deploy functions for automated reminders.
- Use FCM for push notifications.

Your app is now production-ready with monetization! 🚀
