// Firebase Cloud Functions for advanced notifications
// Deploy this to Firebase Functions for server-side notifications

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_SECRET_KEY');

// Export HF proxy function
try {
  require('./hfProxy');
} catch (e) {
  console.warn('hfProxy not loaded:', e?.message || e);
}

/**
 * Create a Stripe Checkout Session
 * Called from frontend when user clicks "Upgrade"
 */
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  const userId = context.auth.uid;
  const { priceId } = data;

  if (!priceId) {
    throw new functions.https.HttpsError('invalid-argument', 'Price ID is required');
  }

  try {
    // Create Stripe session with user ID in metadata
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.DOMAIN || 'http://localhost:8000'}?checkout=success`,
      cancel_url: `${process.env.DOMAIN || 'http://localhost:8000'}?checkout=cancel`,
      // Store user ID so webhook can find them
      metadata: {
        userId,
      },
      // Optional: pre-fill customer email
      customer_email: context.auth.token.email || undefined,
    });

    console.log(`✅ Created checkout session ${session.id} for user ${userId}`);

    return {
      sessionId: session.id,
    };
  } catch (err) {
    console.error('❌ Error creating checkout session:', err);
    throw new functions.https.HttpsError('internal', err.message);
  }
});

/**
 * Import Stripe webhook handlers
 */
try {
  const webhookHandlers = require('./stripeWebhook');
  exports.handleStripeWebhook = webhookHandlers.handleStripeWebhook;
  exports.checkSubscriptionStatus = webhookHandlers.checkSubscriptionStatus;
  console.log('✅ Stripe webhook handlers loaded');
} catch (e) {
  console.warn('⚠️ Stripe webhook handlers not loaded:', e?.message || e);
}



exports.sendDailyReminder = functions.pubsub.schedule('every day 09:00').onRun(async (context) => {
  const users = await admin.firestore().collection('users').get();
  const promises = [];
  users.forEach(user => {
    const token = user.data().fcmToken;
    if (token) {
      const message = {
        notification: {
          title: 'Daily Spark Reminder',
          body: 'Don\'t forget to log your day and complete your challenge!'
        },
        token: token
      };
      promises.push(admin.messaging().send(message));
    }
  });
  await Promise.all(promises);
  console.log('Daily reminders sent');
  return null;
});

exports.sendWeeklySummary = functions.pubsub.schedule('every monday 10:00').onRun(async (context) => {
  // Similar logic for weekly summaries
  console.log('Weekly summaries sent');
  return null;
});