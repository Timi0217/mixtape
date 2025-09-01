import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { SubscriptionService, SUBSCRIPTION_PLANS } from '../services/subscriptionService';
import { prisma } from '../config/database';

const router = express.Router();

// Get current user subscription
router.get('/user/subscription', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const subscription = await SubscriptionService.getUserSubscription(userId);
    
    res.json({
      plan: subscription.plan,
      status: subscription.status,
      features: subscription.features,
      planDetails: subscription.planDetails,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEnd: subscription.trialEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Create or update subscription 
router.post('/user/subscription', 
  authenticateToken,
  [
    body('plan').isIn(['basic', 'pro', 'curator']).withMessage('Invalid subscription plan'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { plan, email } = req.body;

      // For basic plan, just update subscription
      if (plan === 'basic') {
        const subscription = await SubscriptionService.createSubscription(userId, plan);
        return res.json(subscription);
      }

      // For paid plans, create payment session
      const paymentSession = await SubscriptionService.createPaymentSession(userId, plan, email);
      
      res.json({
        requiresPayment: true,
        paymentUrl: paymentSession.url,
        sessionId: paymentSession.sessionId,
      });
    } catch (error) {
      console.error('Error creating subscription:', error);
      console.error('Full error details:', {
        message: error.message,
        stack: error.stack,
        userId: (req.user as any)?.id,
        plan: req.body.plan,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ 
        error: 'Failed to create subscription',
        details: error.message 
      });
    }
  }
);

// Cancel subscription
router.delete('/user/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const subscription = await SubscriptionService.cancelSubscription(userId);
    
    res.json({
      message: 'Subscription cancelled successfully',
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get available subscription plans
router.get('/subscription/plans', async (req, res) => {
  try {
    const plans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      interval: plan.interval,
      features: plan.features,
    }));

    res.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Stripe webhook handler
router.post('/subscription/webhook', 
  express.raw({ type: 'application/json' }),
  async (req: AuthRequest, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      if (!sig) {
        return res.status(400).json({ error: 'Missing stripe signature' });
      }

      const event = req.body; // In production, verify webhook signature
      
      await SubscriptionService.handleStripeWebhook(event);
      
      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({ error: 'Webhook handler failed' });
    }
  }
);

// Check if user can perform action
router.get('/user/subscription/can-perform/:action', authenticateToken, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { action } = req.params;
    const canPerform = await SubscriptionService.checkFeatureAccess(userId, action);
    
    res.json({ canPerform });
  } catch (error) {
    console.error('Error checking feature access:', error);
    res.status(500).json({ error: 'Failed to check feature access' });
  }
});

// Get usage statistics
router.get('/user/subscription/usage', authenticateToken, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await SubscriptionService.getUserSubscription(userId);
    const todayUsage = await prisma.subscriptionUsage.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    res.json({
      subscription: usage,
      todayUsage: todayUsage || {
        songsShared: 0,
        groupsJoined: 0,
        groupsCreated: 0,
      },
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// Confirm subscription after successful payment
router.post('/user/subscription/confirm',
  authenticateToken,
  [
    body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required'),
    body('plan').isIn(['basic', 'pro', 'curator']).withMessage('Invalid subscription plan'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { paymentIntentId, plan } = req.body;

      // Verify payment was successful and create subscription
      const subscription = await SubscriptionService.confirmSubscriptionPayment(userId, plan, paymentIntentId);
      
      res.json(subscription);
    } catch (error) {
      console.error('Error confirming subscription:', error);
      res.status(500).json({ error: 'Failed to confirm subscription' });
    }
  }
);

// Stripe success/cancel redirect handlers
router.get('/subscription/success', async (req, res) => {
  const { session_id } = req.query;
  
  if (session_id) {
    // Redirect to app with success
    res.redirect(`mixtape://subscription/success?session_id=${session_id}`);
  } else {
    res.redirect('mixtape://subscription/success');
  }
});

router.get('/subscription/cancelled', async (req, res) => {
  // Redirect to app with cancellation
  res.redirect('mixtape://subscription/cancelled');
});

export default router;