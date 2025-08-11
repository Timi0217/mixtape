import axios from 'axios';
import { prisma } from '../config/database';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { v4 as uuidv4 } from 'uuid';

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
  getSpotifyAuthUrl(state: string): string {
    const scope = [
      'user-read-email',
      'user-read-private', 
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-public',
      'playlist-modify-private'
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      scope,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
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

  // Create or update user with OAuth data
  async createOrUpdateUser(
    platform: 'spotify' | 'apple-music',
    profileData: SpotifyUserProfile | AppleMusicUserProfile,
    tokenData: SpotifyTokenResponse | any
  ) {
    const isSpotify = platform === 'spotify';
    const email = isSpotify 
      ? (profileData as SpotifyUserProfile).email 
      : `${(profileData as AppleMusicUserProfile).id}@appleid.apple.com`;
    
    const displayName = isSpotify
      ? (profileData as SpotifyUserProfile).display_name
      : (profileData as AppleMusicUserProfile).attributes?.name || 'Apple Music User';

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
      include: { musicAccounts: true }
    });

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
      config.jwtSecret,
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
      const decoded = jwt.verify(token, config.jwtSecret) as any;
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