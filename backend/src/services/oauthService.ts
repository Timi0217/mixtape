import axios from 'axios';
import { prisma } from '../config/database';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';

export class MergeRequiredError extends Error {
  public mergeData: any;
  
  constructor(mergeData: any) {
    super('Account merge required');
    this.name = 'MergeRequiredError';
    this.mergeData = mergeData;
  }
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifyUserProfile {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
}

export interface AppleMusicUserProfile {
  id: string;
  attributes: {
    name: string;
  };
}

class OAuthService {
  // Generate OAuth state parameter for security
  generateState(): string {
    return uuidv4();
  }

  // Spotify OAuth URLs and token exchange
  getSpotifyAuthUrl(state: string, isLinking: boolean = false, customRedirectUri?: string): string {
    console.log(`🎵 getSpotifyAuthUrl called with isLinking: ${isLinking}, customRedirectUri: ${customRedirectUri}`);
    
    const scope = [
      'user-read-email',
      'user-read-private', 
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-public',
      'playlist-modify-private'
    ].join(' ');

    // Use custom redirect URI if provided, otherwise default behavior
    let redirectUri: string;
    if (customRedirectUri) {
      console.log(`🎵 Using custom redirect URI: ${customRedirectUri}`);
      redirectUri = customRedirectUri;
    } else if (isLinking) {
      // Use the same registered callback - we'll detect linking in the callback handler
      redirectUri = process.env.SPOTIFY_REDIRECT_URI!;
      console.log(`🎵 Using registered redirect URI for linking: ${redirectUri}`);
    } else {
      redirectUri = process.env.SPOTIFY_REDIRECT_URI!;
      console.log(`🎵 Using default redirect URI: ${redirectUri}`);
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      scope,
      redirect_uri: redirectUri,
      state,
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async exchangeSpotifyCode(code: string): Promise<SpotifyTokenResponse> {
    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64')}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Spotify token exchange error:', error);
      throw new Error('Failed to exchange Spotify authorization code');
    }
  }

  async exchangeSpotifyCodeWithUri(code: string, redirectUri: string): Promise<SpotifyTokenResponse> {
    try {
      console.log('Exchanging code with custom redirect URI:', redirectUri);
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64')}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Spotify token exchange error:', error);
      console.error('Error details:', error.response?.data);
      throw new Error('Failed to exchange Spotify authorization code');
    }
  }

  async getSpotifyUserProfile(accessToken: string): Promise<SpotifyUserProfile> {
    try {
      const response = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Spotify profile fetch error:', error);
      throw new Error('Failed to fetch Spotify user profile');
    }
  }

  async refreshSpotifyToken(refreshToken: string): Promise<SpotifyTokenResponse> {
    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64')}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Spotify token refresh error:', error);
      throw new Error('Failed to refresh Spotify token');
    }
  }

  // Apple Music OAuth (uses MusicKit JS approach)
  getAppleMusicAuthUrl(state: string): string {
    // Apple Music uses MusicKit JS for web authentication
    // Return a special URL that the frontend will handle
    return `musickit://auth?state=${state}`;
  }

  async validateAppleMusicUserToken(userToken: string): Promise<boolean> {
    const { appleMusicService } = await import('./appleMusicService');
    return await appleMusicService.validateUserToken(userToken);
  }

  // Link music account to existing user
  async linkMusicAccountToUser(
    userId: string,
    platform: 'spotify' | 'apple-music',
    profileData: SpotifyUserProfile | AppleMusicUserProfile,
    tokenData: SpotifyTokenResponse | any
  ) {
    console.log(`🔗 Linking ${platform} account to user ${userId}`);
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { musicAccounts: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // CRITICAL: Check if this platform account is already linked to another user
    const platformUserId = platform === 'spotify' ? 
      (profileData as SpotifyUserProfile).id : 
      (profileData as AppleMusicUserProfile).id;
      
    const platformEmail = platform === 'spotify' ? 
      (profileData as SpotifyUserProfile).email : 
      `apple_music_${platformUserId}@mixtape.internal`;

    // Find existing user with this platform account (check both primary email and aliases)
    let existingUserWithPlatform = await prisma.user.findUnique({
      where: { email: platformEmail },
      include: { 
        musicAccounts: true,
        groupMemberships: {
          include: { group: true }
        },
        adminGroups: true,
        submissions: true
      }
    });

    // If not found by primary email, check email aliases
    if (!existingUserWithPlatform) {
      const emailAlias = await prisma.userEmailAlias.findUnique({
        where: { aliasEmail: platformEmail },
        include: {
          user: {
            include: {
              musicAccounts: true,
              groupMemberships: {
                include: { group: true }
              },
              adminGroups: true,
              submissions: true
            }
          }
        }
      });
      
      if (emailAlias) {
        existingUserWithPlatform = emailAlias.user;
      }
    }

    if (existingUserWithPlatform && existingUserWithPlatform.id !== userId) {
      console.log(`⚠️ Account ${platformEmail} is already linked to another user (${existingUserWithPlatform.id}). Merge required.`);
      
      // Return merge info instead of auto-merging
      throw new MergeRequiredError({
        currentUser: user,
        existingUser: existingUserWithPlatform,
        platform,
        tokenData
      });
    } else {
      // Normal case - either no existing account or same user
      // Check if this platform is already linked to current user
      const existingAccount = await prisma.userMusicAccount.findUnique({
        where: {
          userId_platform: {
            userId,
            platform,
          },
        },
      });

      if (existingAccount) {
        console.log(`🔄 Updating existing ${platform} account for user ${userId}`);
        // Update existing account
        const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
        
        await prisma.userMusicAccount.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || existingAccount.refreshToken,
            expiresAt,
          },
        });
      } else {
        console.log(`➕ Adding new ${platform} account for user ${userId}`);
        // Create new music account
        const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
        
        await prisma.userMusicAccount.create({
          data: {
            userId,
            platform,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || null,
            expiresAt,
          },
        });
      }
    }

    console.log(`✅ Successfully linked ${platform} account to user ${userId}`);
    return user;
  }

  // Perform merge with user's choice of primary account
  async performChosenMerge(
    chosenPrimaryUserId: string,
    secondaryUserId: string,
    platform: 'spotify' | 'apple-music',
    tokenData: SpotifyTokenResponse | any
  ) {
    console.log(`🔄 User chose ${chosenPrimaryUserId} as primary, merging ${secondaryUserId}`);
    
    const secondaryUser = await prisma.user.findUnique({
      where: { id: secondaryUserId },
      include: { 
        musicAccounts: true,
        groupMemberships: true,
        adminGroups: true,
        submissions: true
      }
    });

    if (!secondaryUser) {
      throw new Error('Secondary user not found');
    }

    await this.mergeMusicProfiles(chosenPrimaryUserId, secondaryUser, platform, tokenData);
    return true;
  }

  // Merge two user profiles when linking accounts
  private async mergeMusicProfiles(
    primaryUserId: string,
    secondaryUser: any,
    platform: 'spotify' | 'apple-music',
    tokenData: SpotifyTokenResponse | any
  ) {
    console.log(`🔄 Merging profile ${secondaryUser.id} into ${primaryUserId}`);

    return await prisma.$transaction(async (tx) => {
      // 1. Move music accounts to primary user
      await tx.userMusicAccount.updateMany({
        where: { userId: secondaryUser.id },
        data: { userId: primaryUserId }
      });

      // 2. Update the linking platform account with new tokens
      await tx.userMusicAccount.updateMany({
        where: { 
          userId: primaryUserId,
          platform: platform
        },
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        }
      });

      // 3. Move group memberships to primary user (avoid duplicates)
      const existingMemberships = await tx.groupMember.findMany({
        where: { userId: primaryUserId },
        select: { groupId: true }
      });
      const existingGroupIds = new Set(existingMemberships.map(m => m.groupId));

      const secondaryMemberships = await tx.groupMember.findMany({
        where: { userId: secondaryUser.id }
      });

      for (const membership of secondaryMemberships) {
        if (!existingGroupIds.has(membership.groupId)) {
          // Move membership to primary user
          await tx.groupMember.update({
            where: { id: membership.id },
            data: { userId: primaryUserId }
          });
        } else {
          // Duplicate membership, just delete it
          await tx.groupMember.delete({
            where: { id: membership.id }
          });
        }
      }

      // 4. Move group ownership to primary user
      await tx.group.updateMany({
        where: { adminUserId: secondaryUser.id },
        data: { adminUserId: primaryUserId }
      });

      // 5. Move song submissions to primary user
      await tx.submission.updateMany({
        where: { userId: secondaryUser.id },
        data: { userId: primaryUserId }
      });

      // 6. Move user preferences to primary user (if primary doesn't have them)
      const primaryPrefs = await tx.userMusicPreferences.findUnique({
        where: { userId: primaryUserId }
      });

      if (!primaryPrefs) {
        await tx.userMusicPreferences.updateMany({
          where: { userId: secondaryUser.id },
          data: { userId: primaryUserId }
        });
      } else {
        // Delete secondary preferences if primary already has them
        await tx.userMusicPreferences.deleteMany({
          where: { userId: secondaryUser.id }
        });
      }

      // 7. Create email alias so user can login with either credential
      await tx.userEmailAlias.create({
        data: {
          userId: primaryUserId,
          aliasEmail: secondaryUser.email,
          platform: platform,
          createdAt: new Date(),
        },
      });

      // 8. Finally, delete the secondary user
      await tx.user.delete({
        where: { id: secondaryUser.id }
      });

      console.log(`✅ Successfully merged profile ${secondaryUser.id} into ${primaryUserId}`);
    });
  }

  // Create or update user with OAuth data
  async createOrUpdateUser(
    platform: 'spotify' | 'apple-music',
    profileData: SpotifyUserProfile | AppleMusicUserProfile,
    tokenData: SpotifyTokenResponse | any
  ) {
    const isSpotify = platform === 'spotify';
    
    // For Apple Music, we don't have access to user email, so we create a unique identifier
    // Instead of a fake email, we use the platform prefix + user ID as the unique identifier
    let email: string;
    let displayName: string;
    
    if (isSpotify) {
      email = (profileData as SpotifyUserProfile).email;
      displayName = (profileData as SpotifyUserProfile).display_name;
    } else {
      // For Apple Music, use a proper unique identifier instead of fake email
      const appleUserId = (profileData as AppleMusicUserProfile).id;
      email = `apple_music_${appleUserId}@mixtape.internal`;
      displayName = (profileData as AppleMusicUserProfile).attributes?.name || 'Apple Music User';
      
      // Ensure the identifier is unique and doesn't collide with real emails
      if (!appleUserId || typeof appleUserId !== 'string') {
        throw new Error('Invalid Apple Music user ID');
      }
    }

    // Find or create user (check both primary email and aliases)
    let user = await prisma.user.findUnique({
      where: { email },
      include: { musicAccounts: true }
    });

    // If not found by primary email, check email aliases
    if (!user) {
      const emailAlias = await prisma.userEmailAlias.findUnique({
        where: { aliasEmail: email },
        include: {
          user: {
            include: { musicAccounts: true }
          }
        }
      });
      
      if (emailAlias) {
        user = emailAlias.user;
        console.log(`📧 Found user via email alias: ${email} -> ${user.email}`);
      }
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          displayName,
        },
        include: { musicAccounts: true }
      });
    }

    // Update or create music account
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    
    await prisma.userMusicAccount.upsert({
      where: {
        userId_platform: {
          userId: user.id,
          platform,
        },
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt,
      },
      create: {
        userId: user.id,
        platform,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt,
      },
    });

    // Generate JWT token for our app
    const jwtToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    return {
      user,
      token: jwtToken,
    };
  }

  // Get user's music account tokens
  async getUserMusicAccount(userId: string, platform: string) {
    const account = await prisma.userMusicAccount.findUnique({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
    });

    if (!account) {
      throw new Error(`No ${platform} account found for user`);
    }

    // Check if token is expired and refresh if needed
    if (account.expiresAt && account.expiresAt < new Date()) {
      if (platform === 'spotify' && account.refreshToken) {
        const newTokens = await this.refreshSpotifyToken(account.refreshToken);
        
        // Update account with new tokens
        const updatedAccount = await prisma.userMusicAccount.update({
          where: { id: account.id },
          data: {
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token || account.refreshToken,
            expiresAt: new Date(Date.now() + (newTokens.expires_in * 1000)),
          },
        });

        return updatedAccount;
      } else {
        throw new Error(`${platform} token expired and cannot be refreshed`);
      }
    }

    return account;
  }

  // Validate and decode JWT token
  async validateToken(token: string) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { musicAccounts: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

export const oauthService = new OAuthService();