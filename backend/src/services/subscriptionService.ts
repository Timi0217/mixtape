import Stripe from 'stripe';
import { prisma } from '../config/database';
import { config } from '../config/env';

const stripe = new Stripe(config.stripe.secretKey || 'sk_test_placeholder', {
  apiVersion: '2025-08-27.basil',
});

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: {
    maxSongsPerDay: number | 'unlimited';
    maxGroups: number | 'unlimited';
    hasAdvancedDiscovery: boolean;
    hasPrioritySupport: boolean;
    hasExclusivePlaylists: boolean;
    canCreateGroups: boolean;
    hasAnalytics: boolean;
    hasCustomThemes: boolean;
    hasApiAccess: boolean;
  };
  stripePriceId?: string;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  basic: {
    id: 'basic',
    name: 'Mixtape Basic',
    price: 0,
    interval: 'month',
    features: {
      maxSongsPerDay: 1,
      maxGroups: 1,
      hasAdvancedDiscovery: false,
      hasPrioritySupport: false,
      hasExclusivePlaylists: false,
      canCreateGroups: false,
      hasAnalytics: true,
      hasCustomThemes: true,
      hasApiAccess: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Mixtape Pro',
    price: 4.99,
    interval: 'month',
    features: {
      maxSongsPerDay: 'unlimited',
      maxGroups: 'unlimited',
      hasAdvancedDiscovery: true,
      hasPrioritySupport: true,
      hasExclusivePlaylists: true,
      canCreateGroups: false,
      hasAnalytics: true,
      hasCustomThemes: true,
      hasApiAccess: false,
    },
    stripePriceId: config.stripe.proPriceId,
  },
  curator: {
    id: 'curator',
    name: 'Mixtape Curator',
    price: 9.99,
    interval: 'month',
    features: {
      maxSongsPerDay: 'unlimited',
      maxGroups: 'unlimited',
      hasAdvancedDiscovery: true,
      hasPrioritySupport: true,
      hasExclusivePlaylists: true,
      canCreateGroups: true,
      hasAnalytics: true,
      hasCustomThemes: true,
      hasApiAccess: false,
    },
    stripePriceId: config.stripe.curatorPriceId,
  },
};

export class SubscriptionService {
  static async getUserSubscription(userId: string) {
    try {
      let subscription = await prisma.userSubscription.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      });

      // Create default basic subscription if none exists
      if (!subscription) {
        subscription = await prisma.userSubscription.create({
          data: {
            userId,
            plan: 'basic',
            status: 'active',
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
        });
      }

      const plan = SUBSCRIPTION_PLANS[subscription.plan];
      
      return {
        ...subscription,
        features: plan.features,
        planDetails: plan,
      };
    } catch (error) {
      console.error('Error fetching user subscription:', error);
      throw new Error('Failed to fetch subscription');
    }
  }

  static async createSubscription(userId: string, planId: string) {
    try {
      const plan = SUBSCRIPTION_PLANS[planId];
      if (!plan) {
        throw new Error('Invalid subscription plan');
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // For free plan, just update the subscription
      if (planId === 'basic') {
        const subscription = await prisma.userSubscription.upsert({
          where: { userId },
          update: {
            plan: 'basic',
            status: 'active',
            cancelAtPeriodEnd: false,
          },
          create: {
            userId,
            plan: 'basic',
            status: 'active',
          },
        });

        return this.getUserSubscription(userId);
      }

      // For paid plans, create Stripe customer and subscription
      let stripeCustomerId = '';
      
      // Check if user already has a Stripe customer ID
      const existingSubscription = await prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (existingSubscription?.stripeCustomerId) {
        stripeCustomerId = existingSubscription.stripeCustomerId;
      } else {
        // Create new Stripe customer
        const customerEmail = user.email.includes('@') 
          ? user.email 
          : `${user.email.replace(/[^0-9]/g, '')}@mixtape-user.com`;
          
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: user.displayName,
          metadata: {
            userId: user.id,
          },
        });
        stripeCustomerId = customer.id;
      }

      // Create Stripe subscription with trial
      const stripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: plan.stripePriceId }],
        trial_period_days: 7,
        metadata: {
          userId: user.id,
          plan: planId,
        },
      });

      // Save subscription to database
      const subscription = await prisma.userSubscription.upsert({
        where: { userId },
        update: {
          plan: planId,
          status: 'active',
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
          trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
          cancelAtPeriodEnd: false,
        },
        create: {
          userId,
          plan: planId,
          status: 'active',
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
          trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
        },
      });

      return this.getUserSubscription(userId);
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  static async cancelSubscription(userId: string) {
    try {
      const subscription = await prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!subscription) {
        throw new Error('No subscription found');
      }

      // If it's a paid subscription, cancel in Stripe
      if (subscription.stripeSubscriptionId) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });

        await prisma.userSubscription.update({
          where: { userId },
          data: {
            cancelAtPeriodEnd: true,
          },
        });
      } else {
        // For basic plan, just update to basic
        await prisma.userSubscription.update({
          where: { userId },
          data: {
            plan: 'basic',
            status: 'active',
            cancelAtPeriodEnd: false,
          },
        });
      }

      return this.getUserSubscription(userId);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  static async updateSubscriptionFromStripe(stripeSubscription: Stripe.Subscription) {
    try {
      const userId = stripeSubscription.metadata.userId;
      if (!userId) {
        throw new Error('No userId in subscription metadata');
      }

      const status = this.mapStripeStatus(stripeSubscription.status);
      const plan = stripeSubscription.metadata.plan || 'basic';

      await prisma.userSubscription.update({
        where: { userId },
        data: {
          status,
          plan,
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        },
      });

      return this.getUserSubscription(userId);
    } catch (error) {
      console.error('Error updating subscription from Stripe:', error);
      throw error;
    }
  }

  static async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const features = subscription.features;

      switch (feature) {
        case 'shareUnlimitedSongs':
          return features.maxSongsPerDay === 'unlimited';
        case 'joinUnlimitedGroups':
          return features.maxGroups === 'unlimited';
        case 'createGroups':
          return features.canCreateGroups;
        case 'accessAnalytics':
          return features.hasAnalytics;
        case 'customizeThemes':
          return features.hasCustomThemes;
        case 'useApi':
          return features.hasApiAccess;
        case 'advancedDiscovery':
          return features.hasAdvancedDiscovery;
        case 'prioritySupport':
          return features.hasPrioritySupport;
        case 'exclusivePlaylists':
          return features.hasExclusivePlaylists;
        default:
          return true; // Basic features available to all
      }
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false; // Deny access on error
    }
  }

  static async trackUsage(userId: string, action: 'songShared' | 'groupJoined' | 'groupCreated') {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const usage = await prisma.subscriptionUsage.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        update: {
          ...(action === 'songShared' && { songsShared: { increment: 1 } }),
          ...(action === 'groupJoined' && { groupsJoined: { increment: 1 } }),
          ...(action === 'groupCreated' && { groupsCreated: { increment: 1 } }),
        },
        create: {
          userId,
          date: today,
          songsShared: action === 'songShared' ? 1 : 0,
          groupsJoined: action === 'groupJoined' ? 1 : 0,
          groupsCreated: action === 'groupCreated' ? 1 : 0,
        },
      });

      return usage;
    } catch (error) {
      console.error('Error tracking usage:', error);
      // Don't throw error - usage tracking shouldn't break app functionality
    }
  }

  static async checkUsageLimits(userId: string, action: 'songShared' | 'groupJoined' | 'groupCreated'): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const features = subscription.features;

      // No limits for unlimited plans
      if (action === 'songShared' && features.maxSongsPerDay === 'unlimited') return true;
      if (action === 'groupJoined' && features.maxGroups === 'unlimited') return true;
      if (action === 'groupCreated' && features.canCreateGroups) return true;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const usage = await prisma.subscriptionUsage.findUnique({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
      });

      if (!usage) return true; // No usage recorded yet

      switch (action) {
        case 'songShared':
          return usage.songsShared < (features.maxSongsPerDay as number);
        case 'groupJoined':
          // Check total groups, not daily joins
          const totalGroups = await prisma.groupMember.count({
            where: { userId },
          });
          return totalGroups < (features.maxGroups as number);
        case 'groupCreated':
          return features.canCreateGroups;
        default:
          return true;
      }
    } catch (error) {
      console.error('Error checking usage limits:', error);
      return false; // Deny on error
    }
  }

  static async createPaymentSession(userId: string, planId: string) {
    try {
      console.log(`Creating payment session for user ${userId}, plan ${planId}`);
      
      const plan = SUBSCRIPTION_PLANS[planId];
      console.log('Plan found:', plan ? `${plan.name} - ${plan.price}` : 'null');
      
      if (!plan || planId === 'basic') {
        throw new Error('Invalid plan for payment');
      }

      console.log('Stripe price ID:', plan.stripePriceId);
      if (!plan.stripePriceId) {
        throw new Error(`Stripe price ID not configured for ${planId} plan`);
      }

      console.log('Finding user...');
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }
      
      console.log('User found:', user.email);

      // Handle phone number as email case
      const customerEmail = user.email.includes('@') 
        ? user.email 
        : `${user.email.replace(/[^0-9]/g, '')}@mixtape-user.com`;

      console.log('Creating Stripe session with:', {
        customer_email: customerEmail,
        price: plan.stripePriceId,
        planId,
        userId: user.id,
        originalEmail: user.email
      });

      const session = await stripe.checkout.sessions.create({
        customer_email: customerEmail,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: 7,
          metadata: {
            userId: user.id,
            plan: planId,
          },
        },
        success_url: `${config.frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontendUrl}/subscription/cancelled`,
        metadata: {
          userId: user.id,
          plan: planId,
        },
      });

      console.log('Stripe session created successfully:', session.id);

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      console.error('Error creating payment session:', error);
      throw error; // Propagate the original error instead of generic message
    }
  }

  static mapStripeStatus(stripeStatus: string): string {
    switch (stripeStatus) {
      case 'active':
      case 'trialing':
        return 'active';
      case 'canceled':
        return 'cancelled';
      case 'incomplete_expired':
      case 'unpaid':
        return 'expired';
      case 'past_due':
        return 'past_due';
      default:
        return 'active';
    }
  }

  static async handleStripeWebhook(event: Stripe.Event) {
    try {
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const subscription = event.data.object as Stripe.Subscription;
          await this.updateSubscriptionFromStripe(subscription);
          break;

        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode === 'subscription' && session.subscription) {
            const stripeSubscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );
            await this.updateSubscriptionFromStripe(stripeSubscription);
          }
          break;

        case 'invoice.payment_failed':
          const invoice = event.data.object as Stripe.Invoice;
          if ((invoice as any).subscription) {
            const stripeSubscription = await stripe.subscriptions.retrieve(
              (invoice as any).subscription as string
            );
            await this.updateSubscriptionFromStripe(stripeSubscription);
          }
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      throw error;
    }
  }
}