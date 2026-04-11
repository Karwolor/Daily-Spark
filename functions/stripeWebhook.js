const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Stripe = require('stripe');

// Get your Stripe secret key from environment or set it
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_YOUR_SECRET_HERE';

const stripe = new Stripe(stripeSecretKey);

/**
 * Stripe Webhook Handler
 * Listens for payment events and updates user premium status
 */
exports.handleStripeWebhook = functions.https.onRequest(async (req, res) => {
  // Only accept POST
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const sig = req.headers['stripe-signature'];
  
  let event;
  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle different Stripe events
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionEvent(event.data.object, 'active');
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(event.data.object, 'canceled');
        break;
      
      case 'invoice.payment_succeeded':
        // Optional: handle successful invoice payment
        console.log('Payment succeeded:', event.data.object.id);
        break;
      
      case 'invoice.payment_failed':
        // Optional: handle failed payment
        console.log('Payment failed:', event.data.object.id);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return success
    res.json({ received: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(500).send(`Server error: ${err.message}`);
  }
});

/**
 * Update user premium status based on subscription
 */
async function handleSubscriptionEvent(subscription, status) {
  try {
    // Get user ID from subscription metadata
    const userId = subscription.metadata?.userId;
    
    if (!userId) {
      console.error('No userId in subscription metadata:', subscription.id);
      return;
    }

    console.log(`Processing subscription ${subscription.id} for user ${userId}, status: ${status}`);

    const db = admin.firestore();
    
    if (status === 'active') {
      // User is now premium
      await db.collection('users').doc(userId).set({
        isPremium: true,
        stripeCustomerId: subscription.customer,
        subscriptionId: subscription.id,
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      console.log(`✅ User ${userId} upgraded to premium`);
    } else if (status === 'canceled') {
      // User's subscription canceled
      await db.collection('users').doc(userId).set({
        isPremium: false,
        subscriptionStatus: 'canceled',
        canceledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      console.log(`⏹️ User ${userId} canceled premium`);
    }
  } catch (err) {
    console.error('Error updating user premium status:', err);
    throw err;
  }
}

/**
 * Helper: Check subscription status
 * Call this manually if needed to sync a user's status
 */
exports.checkSubscriptionStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const userId = context.auth.uid;
  const db = admin.firestore();
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const subscriptionId = userDoc.data()?.subscriptionId;
    
    if (!subscriptionId) {
      return { isPremium: false, message: 'No subscription found' };
    }

    // Fetch subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Update local isPremium status
    const isPremium = subscription.status === 'active';
    await db.collection('users').doc(userId).set({
      isPremium,
      subscriptionStatus: subscription.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    return { 
      isPremium, 
      status: subscription.status,
      message: 'Subscription status updated'
    };
  } catch (err) {
    console.error('Error checking subscription:', err);
    throw new functions.https.HttpsError('internal', err.message);
  }
});
