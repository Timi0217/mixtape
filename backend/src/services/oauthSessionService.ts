import { prisma } from '../config/database';
import { customAlphabet } from '../utils/nanoid';

const generateSessionId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 32);

export interface OAuthSessionData {
  platform: string;
  state?: string;
  tokenData?: any;
  expiresInMinutes?: number;
}

export class OAuthSessionService {
  
  /**
   * Create a new OAuth session
   */
  static async createSession(data: OAuthSessionData): Promise<string> {
    const sessionId = generateSessionId();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + (data.expiresInMinutes || 10));

    await prisma.oAuthSession.create({
      data: {
        sessionId,
        platform: data.platform,
        state: data.state,
        tokenData: data.tokenData,
        expiresAt,
      },
    });

    return sessionId;
  }

  /**
   * Store OAuth state for verification
   */
  static async storeState(state: string, platform: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    await prisma.oAuthSession.upsert({
      where: { sessionId: state },
      create: {
        sessionId: state,
        platform,
        state,
        expiresAt,
      },
      update: {
        platform,
        state,
        expiresAt,
      },
    });
  }

  /**
   * Verify and consume OAuth state
   */
  static async verifyState(state: string, platform: string): Promise<boolean> {
    try {
      const session = await prisma.oAuthSession.findUnique({
        where: { sessionId: state },
      });

      if (!session || session.platform !== platform || session.expiresAt < new Date()) {
        return false;
      }

      // Delete the state after verification (one-time use)
      await prisma.oAuthSession.delete({
        where: { sessionId: state },
      });

      return true;
    } catch (error) {
      console.error('Error verifying OAuth state:', error);
      return false;
    }
  }

  /**
   * Store token data for polling
   */
  static async storeTokenData(sessionId: string, tokenData: any, platform: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutes for polling

    await prisma.oAuthSession.upsert({
      where: { sessionId },
      create: {
        sessionId,
        platform,
        tokenData,
        expiresAt,
      },
      update: {
        tokenData,
        expiresAt,
      },
    });
  }

  /**
   * Get token data for polling
   */
  static async getTokenData(sessionId: string): Promise<any | null> {
    try {
      const session = await prisma.oAuthSession.findUnique({
        where: { sessionId },
      });

      if (!session || session.expiresAt < new Date() || !session.tokenData) {
        return null;
      }

      // Only return token data if it contains the completed authentication
      const tokenData = session.tokenData as any;
      if (tokenData && tokenData.token && tokenData.platform) {
        // Delete the token data after retrieval (one-time use)
        await prisma.oAuthSession.delete({
          where: { sessionId },
        });
        
        return tokenData;
      }
      
      // If only Apple credential is stored (not completed yet), return null
      return null;
    } catch (error) {
      console.error('Error getting token data:', error);
      return null;
    }
  }

  /**
   * Get session data by state
   */
  static async getSessionState(state: string): Promise<{ platform: string; redirectUrl?: string } | null> {
    try {
      const session = await prisma.oAuthSession.findUnique({
        where: { sessionId: state },
      });

      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      return {
        platform: session.platform,
        redirectUrl: '/groups', // Default redirect URL
      };
    } catch (error) {
      console.error('Error getting session state:', error);
      return null;
    }
  }

  /**
   * Delete session state
   */
  static async deleteSessionState(state: string): Promise<void> {
    try {
      await prisma.oAuthSession.delete({
        where: { sessionId: state },
      });
    } catch (error) {
      console.error('Error deleting session state:', error);
      // Don't throw, just log the error
    }
  }

  /**
   * Store Apple credential for later use
   */
  static async storeAppleCredential(state: string, appleCredential: any): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 20); // 20 minutes expiry

    await prisma.oAuthSession.upsert({
      where: { sessionId: state },
      create: {
        sessionId: state,
        platform: 'apple-music',
        state,
        tokenData: { appleCredential },
        expiresAt,
      },
      update: {
        tokenData: { appleCredential },
        expiresAt,
      },
    });
  }

  /**
   * Get Apple credential by state
   */
  static async getAppleCredential(state: string): Promise<any | null> {
    try {
      const session = await prisma.oAuthSession.findUnique({
        where: { sessionId: state },
      });

      if (!session || session.expiresAt < new Date() || !session.tokenData) {
        return null;
      }

      const tokenData = session.tokenData as any;
      return tokenData?.appleCredential;
    } catch (error) {
      console.error('Error getting Apple credential:', error);
      return null;
    }
  }

  /**
   * Store linking session for account linking
   */
  static async storeLinkingState(state: string, platform: string, userId: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    await prisma.oAuthSession.upsert({
      where: { sessionId: state },
      create: {
        sessionId: state,
        platform,
        state,
        tokenData: { linkingUserId: userId },
        expiresAt,
      },
      update: {
        platform,
        state,
        tokenData: { linkingUserId: userId },
        expiresAt,
      },
    });
  }

  /**
   * Get linking session for account linking
   */
  static async getLinkingSession(state: string): Promise<{ platform: string; userId: string } | null> {
    try {
      const session = await prisma.oAuthSession.findUnique({
        where: { sessionId: state },
      });

      if (!session || session.expiresAt < new Date() || !session.tokenData) {
        return null;
      }

      const tokenData = session.tokenData as any;
      if (tokenData?.linkingUserId) {
        return {
          platform: session.platform,
          userId: tokenData.linkingUserId,
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting linking session:', error);
      return null;
    }
  }

  /**
   * Delete linking session
   */
  static async deleteLinkingSession(state: string): Promise<void> {
    try {
      await prisma.oAuthSession.delete({
        where: { sessionId: state },
      });
    } catch (error) {
      console.error('Error deleting linking session:', error);
      // Don't throw, just log the error
    }
  }

  /**
   * Store merge data for user confirmation
   */
  static async storeMergeData(state: string, mergeData: any): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes for merge decision

    await prisma.oAuthSession.upsert({
      where: { sessionId: state },
      create: {
        sessionId: state,
        platform: mergeData.platform,
        state,
        tokenData: { mergeData },
        expiresAt,
      },
      update: {
        tokenData: { mergeData },
        expiresAt,
      },
    });
  }

  /**
   * Get merge data for confirmation
   */
  static async getMergeData(state: string): Promise<any | null> {
    try {
      const session = await prisma.oAuthSession.findUnique({
        where: { sessionId: state },
      });

      if (!session || session.expiresAt < new Date() || !session.tokenData) {
        return null;
      }

      const tokenData = session.tokenData as any;
      return tokenData?.mergeData;
    } catch (error) {
      console.error('Error getting merge data:', error);
      return null;
    }
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.oAuthSession.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      return result.count;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }
}

// Clean up expired sessions every 5 minutes
setInterval(async () => {
  try {
    const cleanedCount = await OAuthSessionService.cleanupExpiredSessions();
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired OAuth sessions`);
    }
  } catch (error) {
    console.error('Error in OAuth session cleanup:', error);
  }
}, 5 * 60 * 1000);