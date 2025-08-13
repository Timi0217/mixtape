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

      // Delete the token data after retrieval (one-time use)
      await prisma.oAuthSession.delete({
        where: { sessionId },
      });

      return session.tokenData;
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