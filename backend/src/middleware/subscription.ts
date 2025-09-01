import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscriptionService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    displayName: string;
  };
}

// Middleware to check if user can perform a specific action
export const requireFeature = (feature: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const hasAccess = await SubscriptionService.checkFeatureAccess(userId, feature);
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Feature not available in your plan',
          requiredFeature: feature,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      console.error('Feature check error:', error);
      res.status(500).json({ error: 'Failed to check feature access' });
    }
  };
};

// Middleware to check usage limits before allowing action
export const checkUsageLimit = (action: 'songShared' | 'groupJoined' | 'groupCreated') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const canPerform = await SubscriptionService.checkUsageLimits(userId, action);
      
      if (!canPerform) {
        const subscription = await SubscriptionService.getUserSubscription(userId);
        const features = subscription.features;
        
        let limitMessage = '';
        switch (action) {
          case 'songShared':
            limitMessage = `Daily song limit reached (${features.maxSongsPerDay})`;
            break;
          case 'groupJoined':
            limitMessage = `Group limit reached (${features.maxGroups})`;
            break;
          case 'groupCreated':
            limitMessage = 'Group creation requires Pro subscription';
            break;
        }

        return res.status(403).json({ 
          error: limitMessage,
          action,
          upgradeRequired: true,
          currentPlan: subscription.plan,
        });
      }

      next();
    } catch (error) {
      console.error('Usage limit check error:', error);
      res.status(500).json({ error: 'Failed to check usage limits' });
    }
  };
};

// Middleware to track usage after successful action
export const trackUsage = (action: 'songShared' | 'groupJoined' | 'groupCreated') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Override res.json to track usage after successful response
    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Only track if the response was successful
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.id;
        if (userId) {
          SubscriptionService.trackUsage(userId, action).catch(error => {
            console.error('Failed to track usage:', error);
            // Don't fail the request if usage tracking fails
          });
        }
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
};

// Middleware to check subscription status
export const requireActiveSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const subscription = await SubscriptionService.getUserSubscription(userId);
    
    if (subscription.status !== 'active') {
      return res.status(403).json({ 
        error: 'Active subscription required',
        subscriptionStatus: subscription.status,
        upgradeRequired: true,
      });
    }

    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
};