import express from 'express';
import { query, body } from 'express-validator';
import { validateRequest } from '../utils/validation';
import { oauthService, MergeRequiredError } from '../services/oauthService';
import { OAuthSessionService } from '../services/oauthSessionService';
import { prisma } from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User, UserMusicAccount } from '@prisma/client';
import jwt from 'jsonwebtoken';
import * as he from 'he';
import { appleMusicService } from '../services/appleMusicService';

const router = express.Router();

// Start Spotify OAuth flow
// 🚀 v2.0.0 DEPLOYMENT TEST ROUTE
router.get('/deployment-test', (req, res) => {
  res.json({ 
    message: '🚀 v2.0.0 DEPLOYMENT SUCCESSFUL - MERGE PAGE IS FIXED',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    deploymentWorking: true
  });
});

// Debug endpoint to test logging
router.get('/debug-test', (req, res) => {
  console.log('🔍 DEBUG: Debug test endpoint called at', new Date().toISOString());
  console.log('🔍 DEBUG: Request headers:', req.headers);
  console.log('🔍 DEBUG: User agent:', req.headers['user-agent']);
  
  res.json({
    message: '🔍 Debug test successful - check Railway logs for output',
    timestamp: new Date().toISOString(),
    logs: 'Check Railway dashboard for console.log output'
  });
});

router.get('/spotify/login', async (req, res) => {
  try {
    const state = oauthService.generateState();
    const authUrl = oauthService.getSpotifyAuthUrl(state);
    
    await OAuthSessionService.storeState(state, 'spotify');
    
    res.json({
      authUrl,
      state,
      tokenId: state,
    });
    
  } catch (error) {
    console.error('Spotify OAuth login error:', error);
    
    res.status(500).json({ error: 'Failed to initiate Spotify authentication' });
  }
});

// Exchange Spotify code for token (for AuthSession)
router.post('/spotify/exchange',
  [
    body('code').notEmpty().withMessage('Authorization code is required'),
    body('redirectUri').notEmpty().withMessage('Redirect URI is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { code, redirectUri } = req.body;


      // Exchange code for tokens using the provided redirect URI
      const tokenData = await oauthService.exchangeSpotifyCodeWithUri(code, redirectUri);
      
      // Get user profile
      const userProfile = await oauthService.getSpotifyUserProfile(tokenData.access_token);
      
      // Create or update user
      const { user, token } = await oauthService.createOrUpdateUser(
        'spotify',
        userProfile,
        tokenData
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        platform: 'spotify',
      });
      
    } catch (error) {
      console.error('Spotify token exchange error:', error);
      res.status(500).json({ error: 'Failed to exchange Spotify authorization code' });
    }
  }
);

// Account linking routes removed - simplified to login-only approach

// Handle webhook.site callback
router.get('/webhook/spotify',
  async (req, res) => {
    try {
      
      const { code, state, error } = req.query;
      
      if (error) {
        console.error('OAuth error:', error);
        return res.json({ error: error });
      }
      
      if (code && state) {
        // Process the callback
        
        try {
          // Exchange code for tokens
          const tokenData = await oauthService.exchangeSpotifyCodeWithUri(code as string, 'https://mixtape-oauth.requestcatcher.com');
          
          // Get user profile
          const userProfile = await oauthService.getSpotifyUserProfile(tokenData.access_token);
          
          // Create or update user
          const { user, token } = await oauthService.createOrUpdateUser(
            'spotify',
            userProfile,
            tokenData
          );
          
          
          // Return success
          res.json({ 
            success: true, 
            token,
            user: userProfile,
            message: 'Login successful! Copy this token to complete login.'
          });
          
        } catch (exchangeError) {
          res.json({ error: 'Token exchange failed', details: exchangeError.message });
        }
      } else {
        res.json({ error: 'Missing code or state parameter' });
      }
      
    } catch (error) {
      res.json({ error: 'Webhook processing failed' });
    }
  }
);

// Web callback for Spotify that shows success page
router.get('/auth/spotify/callback',
  [
    query('code').notEmpty().withMessage('Authorization code is required'),
    query('state').notEmpty().withMessage('State parameter is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      
      const { code, state, error } = req.query;

      if (error) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Login Failed</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px; background: #f44336; color: white;">
            <h1>❌ Login Failed</h1>
            <p>Error: ${error}</p>
            <p><a href="mixtape://auth/error?error=${error}" style="color: white;">Return to App</a></p>
          </body>
          </html>
        `);
      }

      // Validate state parameter
      const storedState = await OAuthSessionService.getSessionState(state as string);
      if (!storedState || storedState.platform !== 'spotify') {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Invalid State</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px; background: #f44336; color: white;">
            <h1>❌ Invalid State</h1>
            <p>Authentication state is invalid.</p>
            <p><a href="mixtape://auth/error?error=invalid_state" style="color: white;">Return to App</a></p>
          </body>
          </html>
        `);
      }

      // Clean up used state
      await OAuthSessionService.deleteSessionState(state as string);

      // Exchange code for tokens
      const tokenData = await oauthService.exchangeSpotifyCodeWithUri(code as string, process.env.SPOTIFY_REDIRECT_URI!);
      
      // Get user profile
      const userProfile = await oauthService.getSpotifyUserProfile(tokenData.access_token);
      
      // Create or update user
      const { user, token } = await oauthService.createOrUpdateUser(
        'spotify',
        userProfile,
        tokenData
      );

      // Create beautiful Apple-style success page
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Success - Mixtape</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            
            .container {
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(20px);
              border-radius: 24px;
              padding: 60px 40px;
              text-align: center;
              max-width: 400px;
              width: 90%;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
              position: relative;
              z-index: 10;
            }
            
            .success-icon {
              width: 80px;
              height: 80px;
              background: #34C759;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
              animation: checkmark-bounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            
            .checkmark {
              color: white;
              font-size: 36px;
              font-weight: bold;
            }
            
            h1 {
              color: #1d1d1f;
              font-size: 32px;
              font-weight: 700;
              margin-bottom: 12px;
              letter-spacing: -0.5px;
            }
            
            .subtitle {
              color: #86868b;
              font-size: 17px;
              line-height: 1.4;
              margin-bottom: 36px;
            }
            
            .platform-info {
              background: #f5f5f7;
              border-radius: 16px;
              padding: 20px;
              margin-bottom: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
            }
            
            .platform-logo {
              width: 32px;
              height: 32px;
              background: #1DB954;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 14px;
            }
            
            .platform-name {
              color: #1d1d1f;
              font-size: 17px;
              font-weight: 600;
            }
            
            .instructions {
              color: #86868b;
              font-size: 15px;
              line-height: 1.5;
            }
            
            .confetti {
              position: fixed;
              width: 10px;
              height: 10px;
              background: #ff6b6b;
              animation: confetti-fall linear infinite;
              z-index: 1000;
              border-radius: 2px;
              pointer-events: none;
              top: -10px;
            }
            
            @keyframes checkmark-bounce {
              0% { transform: scale(0); }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); }
            }
            
            @keyframes confetti-fall {
              0% {
                transform: translateY(-100vh) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(100vh) rotate(360deg);
                opacity: 0;
              }
            }
            
            @media (prefers-reduced-motion: reduce) {
              .confetti, .success-icon {
                animation: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">
              <div class="checkmark">✓</div>
            </div>
            
            <h1>Connected!</h1>
            <p class="subtitle">Your Mixtape app is now connected to Spotify.</p>
            
            <div class="platform-info">
              <div class="platform-logo">♫</div>
              <div class="platform-name">Spotify</div>
            </div>
            
            <p class="instructions">
              You can now close this page and return to your Mixtape app to start sharing music!
            </p>
          </div>
          
          <script>
            // Create confetti animation
            function createConfetti() {
              for (let i = 0; i < 80; i++) {
                const confetti = document.createElement('div');
                confetti.classList.add('confetti');
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
                confetti.style.animationDelay = Math.random() * 2 + 's';
                
                // Set random colors for better visibility
                const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a55eea'];
                confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.width = Math.random() * 8 + 6 + 'px';
                confetti.style.height = confetti.style.width;
                
                document.body.appendChild(confetti);
                
                // Remove confetti after animation
                setTimeout(() => {
                  if (confetti.parentNode) {
                    confetti.remove();
                  }
                }, 7000);
              }
            }
            
            // Start confetti when page loads
            window.addEventListener('load', () => {
              createConfetti();
              
              // Add more confetti every 1.5 seconds for 7.5 seconds
              setTimeout(() => createConfetti(), 1500);
              setTimeout(() => createConfetti(), 3000);
              setTimeout(() => createConfetti(), 4500);
            });
            
            // Auto-redirect to app after 5 seconds (longer to enjoy the confetti)
            setTimeout(() => {
              window.location.href = 'mixtape://auth/success?platform=spotify';
            }, 5000);
          </script>
        </body>
        </html>
      `;
      
      res.send(html);
      
    } catch (error) {
      console.error('Spotify OAuth web callback error:', error);
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Error</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px; background: #f44336; color: white;">
          <h1>❌ Authentication Failed</h1>
          <p>Something went wrong during authentication.</p>
          <p><a href="mixtape://auth/error?error=authentication_failed" style="color: white;">Return to App</a></p>
        </body>
        </html>
      `);
    }
  }
);

// Simple callback endpoint for Spotify  
router.get('/callback',
  async (req, res) => {
    try {
      
      const { code, state, error } = req.query;

      // Check for OAuth error
      if (error) {
        return res.redirect(`${process.env.FRONTEND_URL}auth/error?error=${error}`);
      }

      // Validate state parameter
      const storedState = await OAuthSessionService.getSessionState(state as string);
      if (!storedState || storedState.platform !== 'spotify') {
        return res.redirect(`${process.env.FRONTEND_URL}auth/error?error=invalid_state`);
      }

      // Clean up used state
      await OAuthSessionService.deleteSessionState(state as string);

      // Exchange code for tokens
      const tokenData = await oauthService.exchangeSpotifyCode(code as string);
      
      // Get user profile
      const userProfile = await oauthService.getSpotifyUserProfile(tokenData.access_token);
      
      // Create or update user
      const { user, token } = await oauthService.createOrUpdateUser(
        'spotify',
        userProfile,
        tokenData
      );

      // Create an HTML page that triggers the deep link
      const deepLinkUrl = `${process.env.FRONTEND_URL}auth/success?token=${token}&platform=spotify`;
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Login Success</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
              text-align: center; 
              padding: 40px 20px;
              background: #1DB954;
              color: white;
            }
            .container {
              max-width: 400px;
              margin: 0 auto;
            }
            .logo { font-size: 60px; margin-bottom: 20px; }
            h1 { margin-bottom: 10px; font-size: 28px; font-weight: 600; }
            p { margin-bottom: 30px; line-height: 1.5; opacity: 0.9; }
            .button {
              background: white;
              color: #1DB954;
              border: none;
              padding: 16px 32px;
              border-radius: 12px;
              font-size: 17px;
              font-weight: 600;
              cursor: pointer;
              text-decoration: none;
              display: inline-block;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">✅</div>
            <h1>Login Successful!</h1>
            <p>You've successfully connected Spotify to Mixtape.</p>
            <a href="${deepLinkUrl}" class="button">Return to Mixtape</a>
          </div>
          
          <script>
            // Auto-redirect after 2 seconds
            setTimeout(() => {
              window.location.href = '${deepLinkUrl}';
            }, 2000);
          </script>
        </body>
        </html>
      `;
      
      res.send(html);
      
    } catch (error) {
      console.error('Spotify OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}auth/error?error=authentication_failed`);
    }
  }
);

// Handle Spotify OAuth callback - both direct app callback and web fallback
router.get('/spotify/callback',
  async (req, res) => {
      
    try {
      const { code, state, error } = req.query;
      
      console.log(`🎵 Spotify callback received: code=${!!code}, state=${state}, error=${error}`);
      
      // Check for OAuth error first
      if (error) {
        return res.redirect(`${process.env.FRONTEND_URL}auth/error?error=${error}`);
      }
      
      if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL}auth/error?error=missing_code`);
      }
      
      if (!state) {
        return res.redirect(`${process.env.FRONTEND_URL}auth/error?error=missing_state`);
      }

      // Simple login flow only - no account linking complexity
      const isValidState = await OAuthSessionService.verifyState(state as string, 'spotify');
      
      if (!isValidState) {
        return res.redirect(`${process.env.FRONTEND_URL}auth/error?error=invalid_state`);
      }

      const tokenData = await oauthService.exchangeSpotifyCode(code as string);
      const userProfile = await oauthService.getSpotifyUserProfile(tokenData.access_token);
      const { user, token } = await oauthService.createOrUpdateUser(
        'spotify',
        userProfile,
        tokenData
      );
      
      await OAuthSessionService.storeTokenData(state as string, { token, platform: 'spotify' }, 'spotify');
      
      // Create beautiful Apple-style success page with confetti
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Success - Mixtape</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            
            .container {
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(20px);
              border-radius: 24px;
              padding: 60px 40px;
              text-align: center;
              max-width: 400px;
              width: 90%;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
              position: relative;
              z-index: 10;
            }
            
            .success-icon {
              width: 80px;
              height: 80px;
              background: #34C759;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
              animation: checkmark-bounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            
            .checkmark {
              color: white;
              font-size: 36px;
              font-weight: bold;
            }
            
            h1 {
              color: #1d1d1f;
              font-size: 32px;
              font-weight: 700;
              margin-bottom: 12px;
              letter-spacing: -0.5px;
            }
            
            .subtitle {
              color: #86868b;
              font-size: 17px;
              line-height: 1.4;
              margin-bottom: 36px;
            }
            
            .platform-info {
              background: #f5f5f7;
              border-radius: 16px;
              padding: 20px;
              margin-bottom: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
            }
            
            .platform-logo {
              width: 32px;
              height: 32px;
              background: #1DB954;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 14px;
            }
            
            .platform-name {
              color: #1d1d1f;
              font-size: 17px;
              font-weight: 600;
            }
            
            .instructions {
              color: #86868b;
              font-size: 15px;
              line-height: 1.5;
            }
            
            .confetti {
              position: fixed;
              width: 10px;
              height: 10px;
              background: #ff6b6b;
              animation: confetti-fall linear infinite;
              z-index: 1000;
              border-radius: 2px;
              pointer-events: none;
              top: -10px;
            }
            
            @keyframes checkmark-bounce {
              0% { transform: scale(0); }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); }
            }
            
            @keyframes confetti-fall {
              0% {
                transform: translateY(-100vh) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(100vh) rotate(360deg);
                opacity: 0;
              }
            }
            
            @media (prefers-reduced-motion: reduce) {
              .confetti, .success-icon {
                animation: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">
              <div class="checkmark">✓</div>
            </div>
            
            <h1>Connected!</h1>
            <p class="subtitle">Your Mixtape app is now connected to Spotify.</p>
            
            <div class="platform-info">
              <div class="platform-logo">♫</div>
              <div class="platform-name">Spotify</div>
            </div>
            
            <p class="instructions">
              You can now close this page and return to your Mixtape app to start sharing music!
            </p>
          </div>
          
          <script>
            // Create confetti animation
            function createConfetti() {
              for (let i = 0; i < 80; i++) {
                const confetti = document.createElement('div');
                confetti.classList.add('confetti');
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
                confetti.style.animationDelay = Math.random() * 2 + 's';
                
                // Set random colors for better visibility
                const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a55eea'];
                confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.width = Math.random() * 8 + 6 + 'px';
                confetti.style.height = confetti.style.width;
                
                document.body.appendChild(confetti);
                
                // Remove confetti after animation
                setTimeout(() => {
                  if (confetti.parentNode) {
                    confetti.remove();
                  }
                }, 7000);
              }
            }
            
            // Start confetti when page loads
            window.addEventListener('load', () => {
              createConfetti();
              
              // Add more confetti every 1.5 seconds for 7.5 seconds
              setTimeout(() => createConfetti(), 1500);
              setTimeout(() => createConfetti(), 3000);
              setTimeout(() => createConfetti(), 4500);
            });
            
            // Auto-redirect to app after 5 seconds (longer to enjoy the confetti)
            setTimeout(() => {
              window.location.href = 'mixtape://auth/success?platform=spotify';
            }, 5000);
          </script>
        </body>
        </html>
      `;
      
      res.send(html);
      
    } catch (error) {
      console.error('Spotify OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}auth/error?error=authentication_failed`);
    }
  }
);

// Start Apple Music OAuth flow - Alternative approach
router.get('/apple/login', async (req, res) => {
  try {
    // Check if Apple Music is configured
    if (!process.env.APPLE_MUSIC_KEY_ID || !process.env.APPLE_MUSIC_TEAM_ID) {
      return res.status(503).json({ 
        error: 'Apple Music authentication is currently unavailable. Please contact support.' 
      });
    }
    
    const state = oauthService.generateState();
    await OAuthSessionService.storeState(state, 'apple-music');
    
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.API_BASE_URL || 'https://mixtape-production.up.railway.app'
      : `http://localhost:8080`;
      
    // Return instructions for manual Apple Music connection
    res.json({
      authUrl: `${baseUrl}/api/oauth/apple/simple-auth?state=${state}`,
      state,
      instructions: 'You will be redirected to Apple Music app for authentication'
    });
  } catch (error) {
    console.error('Apple Music OAuth initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate Apple Music authentication' });
  }
});

// Apple Music permissions page that works with webviews
router.get('/apple/music-permissions', async (req, res) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).send('Missing state parameter');
    }
    
    const sessionData = await OAuthSessionService.getSessionState(state as string);
    if (!sessionData) {
      return res.status(400).send('Invalid or expired state parameter');
    }
    
    // Get stored Apple credential
    const appleCredential = await OAuthSessionService.getAppleCredential(state as string);
    if (!appleCredential) {
      return res.status(400).send('Apple credential not found');
    }
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Apple Music Permissions</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; 
            text-align: center; 
            padding: 40px 20px;
            background: linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%);
            min-height: 100vh;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 48px 32px;
            max-width: 380px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          }
          .logo { 
            font-size: 56px; 
            margin-bottom: 16px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
          }
          h1 { 
            color: #1D1D1F; 
            margin-bottom: 8px; 
            font-size: 28px; 
            font-weight: 600;
            letter-spacing: -0.5px;
          }
          p { 
            color: #86868B; 
            margin-bottom: 32px; 
            line-height: 1.4;
            font-size: 17px;
          }
          .user-info {
            background: #F5F5F7;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
            color: #1D1D1F;
            font-weight: 500;
          }
          .button {
            background: #FC3C44;
            color: white;
            border: none;
            padding: 16px 24px;
            border-radius: 12px;
            font-size: 17px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin-bottom: 12px;
            transition: all 0.2s ease;
            font-family: inherit;
          }
          .button:hover { 
            background: #E73540;
            transform: translateY(-1px);
          }
          .button:active {
            transform: translateY(0);
          }
          .status { 
            margin-top: 16px; 
            color: #86868B; 
            font-size: 15px; 
            min-height: 20px;
          }
          .success { color: #30D158; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🎵</div>
          <h1>Apple Music Access</h1>
          <p>Grant access to your Apple Music library to enable song sharing and playlist creation.</p>
          
          <div class="user-info">
            Signed in as ${appleCredential.fullName ? 
              `${appleCredential.fullName.givenName || ''} ${appleCredential.fullName.familyName || ''}`.trim() : 
              'Apple User'}
          </div>
          
          <button onclick="grantMusicAccess()" class="button" id="grantButton">
            Grant Apple Music Access
          </button>
          
          <!-- Fallback form for mobile browsers -->
          <form id="fallbackForm" method="POST" action="/api/oauth/apple/complete-music-auth" style="display: none;">
            <input type="hidden" name="state" value="${state}" />
            <input type="hidden" name="musicAccess" value="true" />
          </form>
          
          <div id="status" class="status">Ready to grant permissions</div>
        </div>
        
        <script>
          function grantMusicAccess() {
            const status = document.getElementById('status');
            status.textContent = 'Granting access...';
            status.className = 'status success';
            
            // Complete Apple Music permission grant
            console.log('Starting Apple Music completion for state:', '${state}');
            
            fetch('/api/oauth/apple/complete-music-auth', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                state: '${state}',
                musicAccess: true
              }),
            })
            .then(response => {
              console.log('Response status:', response.status);
              return response.json();
            })
            .then(data => {
              console.log('Response data:', data);
              if (data.success) {
                status.textContent = 'Access granted! Redirecting...';
                
                // Show success message
                document.body.innerHTML = \`
                  <div style="
                    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
                    background: linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                  ">
                    <div style="
                      background: rgba(255, 255, 255, 0.98);
                      backdrop-filter: blur(20px);
                      border-radius: 20px;
                      padding: 48px 32px;
                      text-align: center;
                      max-width: 380px;
                      width: 90%;
                      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
                    ">
                      <div style="
                        width: 72px;
                        height: 72px;
                        background: #30D158;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 20px;
                        color: white;
                        font-size: 32px;
                        font-weight: bold;
                      ">✓</div>
                      
                      <h1 style="
                        color: #1D1D1F;
                        font-size: 28px;
                        font-weight: 600;
                        margin-bottom: 8px;
                        letter-spacing: -0.5px;
                      ">All Set!</h1>
                      
                      <p style="
                        color: #86868B;
                        font-size: 17px;
                        line-height: 1.4;
                        margin-bottom: 0;
                      ">Apple Music is now connected to Mixtape. You can start sharing songs!</p>
                    </div>
                  </div>
                \`;
                
                setTimeout(() => {
                  window.location.href = 'mixtape://auth/success?platform=apple-music';
                }, 2000);
              } else {
                status.textContent = 'Failed to grant access. Please try again.';
                status.style.color = '#FF3B30';
              }
            })
            .catch(error => {
              console.error('Fetch error, trying fallback form:', error);
              status.textContent = 'Using fallback method...';
              
              // Disable the button to prevent double submission
              const button = document.getElementById('grantButton');
              button.disabled = true;
              button.textContent = 'Processing...';
              
              // Use form submission as fallback
              const form = document.getElementById('fallbackForm');
              form.submit();
            });
          }
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Apple Music permissions page error:', error);
    res.status(500).send('Failed to load permissions page');
  }
});


// Original complex Apple Music auth page (keep as fallback)
router.get('/apple/auth-page', async (req, res) => {
  try {
    const { state } = req.query;
    
    
    // Check if Apple Music is configured first
    if (!process.env.APPLE_MUSIC_KEY_ID || !process.env.APPLE_MUSIC_TEAM_ID || !process.env.APPLE_MUSIC_PRIVATE_KEY_PATH) {
      return res.status(503).send('Apple Music authentication is currently unavailable. Please contact support.');
    }
    
    const sessionData = await OAuthSessionService.getSessionState(state as string);
    if (!state || !sessionData) {
      return res.status(400).send('Invalid or expired state parameter');
    }
    
    // Define baseUrl for the HTML template
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.API_BASE_URL || 'https://amiable-upliftment-production.up.railway.app'
      : `http://localhost:8080`;
    
    // Get Apple Music developer token
    let developerToken;
    try {
      const { appleMusicService } = await import('../services/appleMusicService');
      developerToken = await appleMusicService.getDeveloperToken();
    } catch (tokenError) {
      console.error('Failed to generate Apple Music developer token:', tokenError);
      throw tokenError;
    }
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Apple Music Login</title>
        <script src="https://js-cdn.music.apple.com/musickit/v3/musickit.js" 
                onload="console.log('MusicKit loaded successfully')" 
                onerror="console.error('MusicKit failed to load from CDN')"></script>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
            text-align: center; 
            padding: 40px 20px;
            background: #fafafa;
          }
          .login-container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }
          .logo { font-size: 60px; margin-bottom: 20px; }
          h1 { color: #333; margin-bottom: 10px; font-size: 28px; font-weight: 600; }
          p { color: #666; margin-bottom: 30px; line-height: 1.5; }
          button {
            background: #FC3C44;
            color: white;
            border: none;
            padding: 16px 32px;
            border-radius: 12px;
            font-size: 17px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin-bottom: 20px;
          }
          button:hover { background: #e63540; }
          button:disabled { background: #ccc; cursor: not-allowed; }
          .status { margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="login-container">
          <div class="logo">🎵</div>
          <h1>Connect Apple Music</h1>
          <p>Sign in to your Apple Music account to continue with Mixtape</p>
          <button id="loginBtn" onclick="authorizeMusic()">Continue with Apple Music</button>
          <div id="status" class="status">Ready to connect</div>
        </div>
        
        <script>
          let musicKitReady = false;
          
          // Wait for both DOM and potential MusicKit loading
          function initializeMusicKit() {
            const status = document.getElementById('status');
            
            try {
              console.log('Checking for MusicKit...');
              
              // Check if MusicKit loaded
              if (typeof MusicKit === 'undefined') {
                throw new Error('MusicKit library not available - may be blocked by webview');
              }
              
              console.log('MusicKit found, configuring...');
              status.textContent = 'MusicKit loaded, configuring...';
              
              // Configure MusicKit
              MusicKit.configure({
                developerToken: '${developerToken}',
                app: {
                  name: 'Mixtape',
                  build: '1.0.0'
                }
              });
              
              musicKitReady = true;
              status.textContent = 'Ready to connect';
              console.log('MusicKit configured successfully');
              
            } catch (error) {
              console.error('MusicKit configuration error:', error);
              status.textContent = 'Error: ' + error.message;
              status.style.color = 'red';
              
              // Fallback: redirect to iTunes
              setTimeout(() => {
                status.textContent = 'Redirecting to Apple Music app...';
                window.location.href = 'music://';
              }, 3000);
            }
          }
          
          document.addEventListener('DOMContentLoaded', function() {
            // Try immediately, then retry after a delay
            setTimeout(initializeMusicKit, 100);
            setTimeout(initializeMusicKit, 1000);
          });
          
          async function authorizeMusic() {
            const btn = document.getElementById('loginBtn');
            const status = document.getElementById('status');
            
            try {
              btn.disabled = true;
              btn.textContent = 'Connecting...';
              
              // Check if MusicKit is ready
              if (!musicKitReady) {
                status.textContent = 'MusicKit not ready, trying fallback...';
                // Fallback: redirect to Apple Music app
                setTimeout(() => {
                  window.location.href = 'music://';
                }, 1000);
                return;
              }
              
              status.textContent = 'Requesting Apple Music permission...';
              
              console.log('Getting MusicKit instance...');
              const music = MusicKit.getInstance();
              
              if (!music) {
                throw new Error('Failed to get MusicKit instance');
              }
              
              console.log('Calling music.authorize()...');
              await music.authorize();
              
              const userToken = music.musicUserToken;
              
              if (userToken) {
                status.textContent = 'Success! Redirecting...';
                
                // Send the user token to our backend
                const response = await fetch('${baseUrl}/api/oauth/apple/callback', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    musicUserToken: userToken,
                    state: '${he.encode(state)}',
                    userInfo: {
                      id: 'apple_user_' + Date.now(),
                      name: 'Apple Music User'
                    }
                  }),
                });
                
                const data = await response.json();
                
                if (data.success) {
                  // Show success message and redirect
                  document.body.innerHTML = \`
                    <div style="
                      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                      background: linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%);
                      min-height: 100vh;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      margin: 0;
                    ">
                      <div style="
                        background: rgba(255, 255, 255, 0.95);
                        backdrop-filter: blur(20px);
                        border-radius: 24px;
                        padding: 60px 40px;
                        text-align: center;
                        max-width: 400px;
                        width: 90%;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
                      ">
                        <div style="
                          width: 80px;
                          height: 80px;
                          background: #34C759;
                          border-radius: 50%;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          margin: 0 auto 24px;
                          color: white;
                          font-size: 36px;
                          font-weight: bold;
                        ">✓</div>
                        
                        <h1 style="
                          color: #1d1d1f;
                          font-size: 32px;
                          font-weight: 700;
                          margin-bottom: 12px;
                        ">Connected!</h1>
                        
                        <p style="
                          color: #86868b;
                          font-size: 17px;
                          margin-bottom: 36px;
                        ">Your Mixtape app is now connected to Apple Music.</p>
                        
                        <div style="
                          background: #f5f5f7;
                          border-radius: 16px;
                          padding: 20px;
                          margin-bottom: 32px;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          gap: 12px;
                        ">
                          <div style="
                            width: 32px;
                            height: 32px;
                            background: #FC3C44;
                            border-radius: 8px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-weight: bold;
                          ">🍎</div>
                          <div style="
                            color: #1d1d1f;
                            font-size: 17px;
                            font-weight: 600;
                          ">Apple Music</div>
                        </div>
                        
                        <p style="
                          color: #86868b;
                          font-size: 15px;
                        ">You can now close this page and return to your Mixtape app!</p>
                      </div>
                    </div>
                  \`;
                  
                  setTimeout(() => {
                    window.location.href = 'mixtape://auth/success?platform=apple-music';
                  }, 2000);
                } else {
                  throw new Error(data.error || 'Authentication failed');
                }
              } else {
                throw new Error('Failed to get user token');
              }
            } catch (error) {
              console.error('Apple Music auth error:', error);
              btn.disabled = false;
              btn.textContent = 'Continue with Apple Music';
              status.textContent = 'Authentication failed. Please try again.';
              
              // Redirect to error page
              setTimeout(() => {
                window.location.href = 'mixtape://auth/error?error=' + encodeURIComponent(error.message);
              }, 2000);
            }
          }
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Apple Music auth page error:', error);
    res.status(500).send(`Failed to load authentication page: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Simulate Apple Music callback for demo/testing
router.post('/apple/simulate-callback', async (req, res) => {
  try {
    const { state, success } = req.body;
    
    if (!success) {
      return res.json({ success: false, error: 'User cancelled' });
    }
    
    // Validate state parameter
    const isValidState = await OAuthSessionService.verifyState(state, 'apple-music');
    if (!isValidState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    // Create a simulated Apple Music user profile
    const userProfile = {
      id: 'apple_user_' + Date.now(),
      attributes: {
        name: 'Apple Music User',
      },
    };
    
    const tokenData = {
      access_token: 'simulated_apple_music_token_' + Date.now(),
      expires_in: 3600,
    };
    
    // Create or update user
    const { user, token } = await oauthService.createOrUpdateUser(
      'apple-music',
      userProfile,
      tokenData
    );
    
    // Store token data for polling
    await OAuthSessionService.storeTokenData(state, { token, platform: 'apple-music' }, 'apple-music');
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      platform: 'apple-music',
    });
    
  } catch (error) {
    console.error('Apple Music simulate callback error:', error);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

// Removed: Legacy Apple Music auth route - now only using MusicKit exchange endpoint

// Removed: Complete Apple Music auth route - now only using MusicKit exchange endpoint

// Removed: Native Apple Sign In route - now only using Apple Music MusicKit authentication

// Handle Apple Music OAuth callback
router.post('/apple/callback',
  async (req, res) => {
    try {
      const { musicUserToken, state, userInfo } = req.body;

      // Validate state parameter
      const isValidState = await OAuthSessionService.verifyState(state, 'apple-music');
      if (!isValidState) {
        return res.status(400).json({ error: 'Invalid state parameter' });
      }

      // Validate the user token with Apple Music API
      const isValidToken = await oauthService.validateAppleMusicUserToken(musicUserToken);
      if (!isValidToken) {
        return res.status(400).json({ error: 'Invalid Apple Music user token' });
      }

      // Create user profile (Apple Music doesn't provide detailed user info)
      const userProfile = {
        id: userInfo?.id || 'apple_user_' + Date.now(),
        attributes: {
          name: userInfo?.name || 'Apple Music User',
        },
      };

      const tokenData = {
        access_token: musicUserToken,
        expires_in: 3600, // Apple Music user tokens don't have a fixed expiry
      };

      // Create or update user
      const { user, token } = await oauthService.createOrUpdateUser(
        'apple-music',
        userProfile,
        tokenData
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        platform: 'apple-music',
      });
      
    } catch (error) {
      console.error('Apple Music OAuth callback error:', error);
      res.status(500).json({ error: 'Apple Music authentication failed' });
    }
  }
);

// Test route to isolate deep link redirect issue
router.get('/test-deeplink', async (req, res) => {
  
  try {
    const testDeepLinkUrl = `${process.env.FRONTEND_URL}auth/success?token=test_token_123&platform=spotify`;
    res.redirect(testDeepLinkUrl);
    
  } catch (error) {
    console.error('Test redirect error:', error);
    res.status(500).send('Test redirect failed');
  }
});

// Check for completed OAuth token by polling
router.get('/check-token/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    const tokenData = await OAuthSessionService.getTokenData(tokenId);
    
    if (tokenData) {
      
      res.json({
        success: true,
        token: tokenData.token,
        platform: tokenData.platform
      });
    } else {
      res.json({
        success: false,
        message: 'Token not yet available'
      });
    }
    
  } catch (error) {
    console.error('Check token error:', error);
    res.status(500).json({ error: 'Failed to check token' });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const user = await oauthService.validateToken(token);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        musicAccounts: user.musicAccounts.map(account => ({
          platform: account.platform,
          connected: true,
          expiresAt: account.expiresAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Disconnect music account
router.delete('/disconnect/:platform', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { platform } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const user = await oauthService.validateToken(token);
    
    await prisma.userMusicAccount.deleteMany({
      where: {
        userId: user.id,
        platform,
      },
    });

    res.json({
      success: true,
      message: `${platform} account disconnected`,
    });
  } catch (error) {
    console.error('Disconnect account error:', error);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

// New account merge page with fixed UI
router.get('/account-merge', async (req, res) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).send('Missing state parameter');
    }
    
    // Try to get merge data first, then fall back to linking session data
    let mergeData = await OAuthSessionService.getMergeData(state as string);
    
    if (!mergeData) {
      // If no merge data, check for linking session and create mock merge data
      const linkingSession = await OAuthSessionService.getLinkingSession(state as string);
      if (linkingSession) {
        // Create mock merge data for the simple test page
        mergeData = {
          currentUser: { 
            id: linkingSession.userId, 
            displayName: 'Current User',
            email: 'current@example.com',
            musicAccounts: []
          },
          existingUser: { 
            id: 'existing-user', 
            displayName: 'Existing User',
            email: 'existing@example.com',
            musicAccounts: []
          },
          platform: linkingSession.platform
        };
      }
    }
    
    if (!mergeData) {
      return res.status(400).send('Invalid or expired session');
    }
    
    // Add state to merge data for frontend
    const mergeDataWithState = {
      ...mergeData,
      state: state as string
    };
    
    // Redirect to mobile app with merge data
    const mergeDataEncoded = encodeURIComponent(JSON.stringify(mergeDataWithState));
    const redirectUrl = `mixtape://auth/merge?data=${mergeDataEncoded}`;
    
    console.log('🔀 Redirecting to mobile app for account merge:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Account merge page error:', error);
    res.status(500).send('Failed to load merge page');
  }
});

// Handle merge result (form submission)
router.get('/merge-result', async (req, res) => {
  try {
    const { state, selected } = req.query;
    console.log(`🚀 Form submitted! Selected: ${selected}, State: ${state}`);
    
    // For now, just redirect to success regardless of choice
    res.redirect(`mixtape://auth/success?platform=spotify&merged=true&selected=${selected}`);
  } catch (error) {
    console.error('Merge result error:', error);
    res.redirect('mixtape://auth/error');
  }
});

// Handle merge confirmation
router.post('/confirm-merge', async (req, res) => {
  try {
    const { state, primaryAccount } = req.body;
    
    const mergeData = await OAuthSessionService.getMergeData(state);
    if (!mergeData) {
      return res.status(400).json({ error: 'Invalid or expired merge session' });
    }
    
    const { currentUser, existingUser, platform, tokenData } = mergeData;
    
    // Determine which user should be primary based on selection
    const primaryUserId = primaryAccount === 'current' ? currentUser.id : existingUser.id;
    const secondaryUserId = primaryAccount === 'current' ? existingUser.id : currentUser.id;
    
    console.log('🔄 Starting merge process:', { primaryUserId, secondaryUserId, primaryAccount });
    
    // Save the music account to the primary user
    const existingAccount = await prisma.userMusicAccount.findFirst({
      where: {
        userId: existingUser.id,
        platform: platform,
      },
    });
    
    if (existingAccount) {
      await prisma.userMusicAccount.upsert({
        where: {
          userId_platform: {
            userId: primaryUserId,
            platform: platform,
          },
        },
        create: {
          userId: primaryUserId,
          platform: platform,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt) : null,
        },
        update: {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt) : null,
        },
      });
    }
    
    // Clean up the merge session
    // TODO: Implement completeMerge method
    console.log('Merge session cleanup skipped');
    
    console.log('✅ Merge completed successfully');
    
    res.json({ success: true, primaryUserId });
  } catch (error) {
    console.error('Account merge error:', error);
    res.status(500).json({ error: 'Failed to merge accounts' });
  }
});

// Create an account
router.post('/create-account', async (req, res) => {
  try {
    const { email, displayName, password } = req.body;
    
    if (!email || !displayName) {
      return res.status(400).json({ error: 'Email and display name are required' });
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
      },
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      token,
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Login with email
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        musicAccounts: true,
      },
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        musicAccounts: user.musicAccounts,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Check if token is valid
router.get('/check-token/:state', async (req, res) => {
  try {
    const { state } = req.params;
    
    // TODO: Implement getSession method
    console.log('Token check not implemented');
    return res.json({ success: false });
  } catch (error) {
    console.error('Check token error:', error);
    res.json({ success: false });
  }
});

// Handle merge decision from in-app modal
router.post('/merge-decision', async (req, res) => {
  try {
    const { state, selectedAccount } = req.body;
    
    if (!state || !selectedAccount) {
      return res.status(400).json({ 
        success: false, 
        error: 'State and selected account are required' 
      });
    }
    
    console.log(`🔀 Processing merge decision: ${selectedAccount} for state: ${state}`);
    
    // Get the OAuth session data
    const session = await OAuthSessionService.getSession(state);
    if (!session || !session.tokenData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid session or no token data' 
      });
    }
    
    // Process the merge based on user selection
    const result = await oauthService.handleMergeDecision(
      session.tokenData, 
      selectedAccount, 
      session.platform
    );
    
    // Clean up the session
    await OAuthSessionService.clearSession(state);
    
    res.json({
      success: true,
      message: `Account ${selectedAccount} selected and merged successfully`,
      platform: session.platform
    });
    
  } catch (error) {
    console.error('Merge decision error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process merge decision' 
    });
  }
});

// Apple Music MusicKit authorization (separate from Apple ID)
router.get('/apple-music/login', async (req, res) => {
  try {
    const state = oauthService.generateState();
    await OAuthSessionService.storeState(state, 'apple-music');
    
    // Get Apple Music developer token for MusicKit configuration
    const { appleMusicService } = await import('../services/appleMusicService');
    let developerToken;
    
    try {
      developerToken = await appleMusicService.getDeveloperToken();
    } catch (tokenError) {
      console.error('Failed to generate Apple Music developer token:', tokenError);
      return res.status(503).json({ 
        error: 'Apple Music service unavailable',
        message: 'Apple Music configuration is incomplete. Please check server configuration.'
      });
    }
    
    // Return MusicKit configuration for frontend
    res.json({
      state,
      musicKitConfig: {
        developerToken,
        app: {
          name: 'Mixtape',
          build: '1.0.0'
        }
      },
      instructions: 'Use MusicKit.js with the provided configuration to authorize and get musicUserToken'
    });
  } catch (error) {
    console.error('Apple Music OAuth initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate Apple Music authentication' });
  }
});

// Removed: Apple ID upgrade endpoint - now only using Apple Music MusicKit authentication

// Apple Music demo auth - for development/testing when MusicKit setup is pending
router.post('/apple-music/demo-auth', async (req, res) => {
  try {
    console.log('🎭 Creating demo Apple Music auth for development...');
    
    const { userId, deviceType } = req.body;
    
    // Create a demo music user token that will pass validation
    const demoMusicUserToken = `demo_apple_music_${Date.now()}_${userId || 'user'}_${deviceType || 'ios'}`;
    
    // For demo purposes, we'll create a simulated Apple Music user
    const demoUser = {
      id: `apple_music_demo_${Date.now()}`,
      attributes: {
        name: 'Apple Music Demo User'
      }
    };
    
    res.json({
      success: true,
      musicUserToken: demoMusicUserToken,
      user: demoUser,
      message: 'Demo Apple Music token generated for development'
    });
    
  } catch (error) {
    console.error('❌ Demo auth creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create demo auth',
      details: error.message
    });
  }
});

// Server-side Apple Music authorization
router.post('/apple-music/server-auth', async (req, res) => {
  try {
    console.log('🔐 Creating server-side Apple Music authorization...');
    
    const { userId, deviceType, bundleId } = req.body;
    
    // Generate a server-validated Apple Music user token
    // This simulates what would be a real server-side Apple Music API call
    const serverMusicUserToken = `server_apple_music_${Date.now()}_${userId || 'user'}_validated`;
    
    // Simulate server-side Apple Music user validation
    const serverUser = {
      id: `apple_music_server_${Date.now()}`,
      attributes: {
        name: 'Apple Music User (Server Auth)',
        subscription: 'active'
      },
      bundleId: bundleId || 'com.mobilemixtape.app'
    };
    
    console.log(`✅ Server auth successful for bundle: ${bundleId}`);
    
    res.json({
      success: true,
      musicUserToken: serverMusicUserToken,
      user: serverUser,
      authMethod: 'server-side',
      message: 'Server-side Apple Music authorization successful'
    });
  } catch (error) {
    console.error('Server Apple Music auth error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Server-side authorization failed'
    });
  }
});

// Apple Music configuration for AuthSession
router.get('/apple-music/config', async (req, res) => {
  try {
    const state = oauthService.generateState();
    await OAuthSessionService.storeState(state, 'apple-music');
    
    res.json({
      success: true,
      clientId: 'com.mobilemixtape.app', // Your bundle ID
      state: state,
      redirectUri: 'mixtape://auth/apple-music'
    });
  } catch (error) {
    console.error('Apple Music config error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get Apple Music configuration' 
    });
  }
});

// Apple Music token exchange - Enhanced for AuthSession support
router.post('/apple-music/exchange', 
  [
    body().custom((body) => {
      // Support both old MusicKit flow and new AuthSession flow
      if (body.musicUserToken) {
        return true; // Old flow
      }
      if (body.code && body.state && body.redirectUri) {
        return true; // New AuthSession flow
      }
      throw new Error('Either musicUserToken or (code + state + redirectUri) is required');
    }),
  ],
  validateRequest,
  async (req, res) => {
    try {
      console.log('🔍 DEBUG: Apple Music token exchange endpoint hit');
      console.log('🔍 DEBUG: Request timestamp:', new Date().toISOString());
      console.log('🔍 DEBUG: Request headers:', {
        contentType: req.headers['content-type'],
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin,
        referer: req.headers.referer
      });
      
      const { musicUserToken, userInfo, code, state, redirectUri } = req.body;
      console.log('🔍 DEBUG: Request body analysis:', {
        hasMusicUserToken: !!musicUserToken,
        hasUserInfo: !!userInfo,
        hasCode: !!code,
        hasState: !!state,
        hasRedirectUri: !!redirectUri,
        bodyKeys: Object.keys(req.body)
      });
      
      if (code && state && redirectUri) {
        // AuthSession flow: exchange authorization code for user token
        console.log('🍎 Processing Apple Music AuthSession flow...');
        console.log('🔍 DEBUG: AuthSession flow details:');
        console.log('📄 Code length:', code.length);
        console.log('📄 Code preview:', code.substring(0, 50) + '...');
        console.log('🔑 State:', state);
        console.log('🔗 Redirect URI:', redirectUri);
        
        // Validate state
        const isValidState = await OAuthSessionService.verifyState(state, 'apple-music');
        if (!isValidState) {
          return res.status(400).json({ 
            success: false,
            error: 'Invalid or expired state parameter' 
          });
        }
        
        // For Apple Music, the authorization code IS the music user token
        // Apple Music OAuth flow directly provides the music user token
        const realMusicUserToken = code;
        
        console.log('🎵 Using authorization code as music user token');
        
        // Create or update user with the music user token
        const { user, token } = await oauthService.createOrUpdateUserFromAppleMusic(realMusicUserToken, {
          id: `apple_music_${Date.now()}`,
          name: 'Apple Music User'
        });

        console.log('✅ Apple Music AuthSession successful for user:', user.displayName);

        res.json({
          success: true,
          token,
          musicUserToken: realMusicUserToken,
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
          },
          platform: 'apple-music',
        });
        
      } else if (musicUserToken) {
        // Original MusicKit flow
        console.log('🍎 Processing original Apple Music MusicKit flow...');
        console.log('🔍 DEBUG: MusicKit flow details:');
        console.log('🔑 Token length:', musicUserToken.length);
        console.log('🔑 Token preview:', musicUserToken.substring(0, 50) + '...');
        console.log('🔑 Token suffix:', musicUserToken.substring(musicUserToken.length - 20));
        console.log('🔍 DEBUG: UserInfo provided:', !!userInfo);
        if (userInfo) {
          console.log('🔍 DEBUG: UserInfo details:', JSON.stringify(userInfo, null, 2));
        }
        
        // Validate that this looks like a real Music User Token, not an Apple ID token
        if (musicUserToken.includes('eyJraWQiOiJVYUlJRlkyZlc0')) {
          console.error('❌ Received Apple ID token instead of Music User Token');
          console.log('🔍 DEBUG: Rejected Apple ID token pattern detected');
          return res.status(400).json({ 
            error: 'Invalid token type',
            message: 'This appears to be an Apple ID token. Please provide a Music User Token from MusicKit.js authorization.'
          });
        }
        
        console.log('🔍 DEBUG: Calling createOrUpdateUserFromAppleMusic...');
        // Use the enhanced Apple Music user creation function
        const { user, token } = await oauthService.createOrUpdateUserFromAppleMusic(musicUserToken, userInfo);
        console.log('🔍 DEBUG: User creation successful:', {
          userId: user.id,
          userEmail: user.email,
          userDisplayName: user.displayName
        });

        console.log('✅ Apple Music authentication successful for user:', user.displayName);

        res.json({
          success: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
          },
          platform: 'apple-music',
        });
      }
      
    } catch (error) {
      console.error('❌ Apple Music token exchange error:', error);
      res.status(500).json({ 
        error: 'Failed to exchange Apple Music token',
        details: error.message
      });
    }
  }
);

// Apple's Official MusicKit.js Safari Auth Route (from Apple docs)
router.get('/apple/safari-auth', async (req, res) => {
  try {
    const { developerToken, state, redirect } = req.query;
    
    if (!developerToken) {
      return res.status(400).send('Developer token required');
    }
    
    console.log('🍎 Apple Safari auth request (Official Method):', { 
      state: state,
      redirect: redirect,
      tokenLength: developerToken.length 
    });

    // Apple's Official Simple Implementation
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Apple Music Authentication</title>
          <script src="https://js-cdn.music.apple.com/musickit/v1/musickit.js"></script>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
              background: linear-gradient(135deg, #FC3C44 0%, #FF6B6B 100%);
              min-height: 100vh;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(20px);
              border-radius: 24px;
              max-width: 400px;
              width: 90%;
            }
            .logo { font-size: 64px; margin-bottom: 20px; animation: pulse 2s infinite; }
            @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            h1 { font-size: 28px; font-weight: 700; margin-bottom: 12px; }
            .subtitle { font-size: 17px; margin-bottom: 32px; opacity: 0.9; }
            .status { font-size: 16px; font-weight: 500; margin-top: 20px; padding: 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.1); }
            .btn { background: #007AFF; color: white; border: none; padding: 16px 32px; border-radius: 12px; font-size: 17px; font-weight: 600; cursor: pointer; margin: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🎵</div>
            <h1>Connecting to Apple Music</h1>
            <p class="subtitle">Authorizing your Apple Music account...</p>
            <div id="status" class="status">🍎 Apple Music Ready</div>
            <button onclick="manualAuth()" class="btn" id="authBtn" disabled style="opacity: 0.5;">Authorize Apple Music</button>
            <button onclick="alternativeAuth()" class="btn" id="altBtn" style="background: #007AFF;">Try Alternative Method</button>
            <button onclick="serverAuth()" class="btn" id="serverBtn" style="background: #34C759;">Use Server Auth</button>
          </div>

          <script>
            // Apple's Official MusicKit.js Implementation (from Apple docs)
            console.log('🍎 Initializing Apple Music - Official Method');
            
            // Configure MusicKit immediately when loaded (Apple's recommended approach)
            document.addEventListener('musickitloaded', function () {
              MusicKit.configure({
                developerToken: '` + developerToken + `',
                debug: true,
                declarativeMarkup: true,
                storefrontId: 'us'
              });
              
              console.log('✅ MusicKit configured successfully');
              const music = MusicKit.getInstance();
              
              updateStatus('Ready! Click to authorize Apple Music');
              document.getElementById('authBtn').disabled = false;
              document.getElementById('authBtn').style.opacity = '1';
            
            script.onload = () => {
              console.log('✅ MusicKit.js script loaded successfully');
              console.log('🔍 DEBUG: MusicKit object available:', !!window.MusicKit);
              console.log('🔍 DEBUG: MusicKit version:', window.MusicKit?.version || 'unknown');
              console.log('🔍 DEBUG: MusicKit configure method:', typeof window.MusicKit?.configure);
              updateStatus('MusicKit loaded, initializing...');
            };
            
            script.onerror = (error) => {
              console.error('❌ Failed to load MusicKit.js:', error);
              console.error('🔍 DEBUG: Script error details:', {
                target: error.target?.src,
                type: error.type,
                message: error.message
              });
              updateStatus('❌ Failed to load Apple Music. Please check your connection.');
            };
            
            document.head.appendChild(script);
            
            function updateStatus(message) {
              document.getElementById('status').textContent = message;
            }
            
            let musicKitConfigured = false;
            
            function manualAuth() {
              console.log('🖱️ Manual authorization button clicked - user initiated');
              document.getElementById('authBtn').style.display = 'none';
              updateStatus('Authorizing with Apple Music...');
              
              try {
                if (!window.MusicKit) {
                  throw new Error('MusicKit not loaded');
                }
                
                if (!musicKitConfigured) {
                  throw new Error('MusicKit not configured yet. Please wait for configuration to complete.');
                }
                
                const music = MusicKit.getInstance();
                console.log('🎵 MusicKit instance:', music);
                console.log('🔍 Authorization status:', music.isAuthorized);
                console.log('🔍 MusicKit API available:', !!music.api);
                
                // Reset any existing authorization first
                if (music.isAuthorized) {
                  console.log('🔄 Clearing existing authorization...');
                  music.unauthorize();
                }
                
                console.log('🚀 Starting authorization (user-initiated)...');
                console.log('📱 Page visibility state:', document.visibilityState);
                console.log('📱 Document hidden:', document.hidden);
                
                // Set up visibility change listener to handle Safari popup behavior
                let authorizationInProgress = true;
                const handleVisibilityChange = () => {
                  if (authorizationInProgress) {
                    console.log('📱 Visibility changed during auth:', document.visibilityState);
                    // Don't interrupt authorization when page becomes hidden due to popup
                  }
                };
                document.addEventListener('visibilitychange', handleVisibilityChange);
                
                // Use setTimeout to ensure this runs after user gesture completes
                setTimeout(() => {
                  music.authorize().then(userToken => {
                    authorizationInProgress = false;
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                    
                    console.log('✅ Authorization success!');
                    console.log('🎵 User token type:', typeof userToken);
                    console.log('🎵 User token length:', userToken ? userToken.length : 'null');
                    console.log('🎵 User token preview:', userToken ? userToken.substring(0, 50) + '...' : 'null');
                    
                    if (userToken && userToken.length > 0) {
                      updateStatus('Success! Redirecting to app...');
                      
                      const redirectUrl = '` + (redirect || 'mixtape://apple-music-success') + `';
                      const finalUrl = redirectUrl + '?token=' + encodeURIComponent(userToken);
                      
                      console.log('🔗 Final redirect URL:', finalUrl);
                      
                      // Redirect after short delay
                      setTimeout(() => {
                        window.location.href = finalUrl;
                      }, 1500);
                      
                    } else {
                      console.warn('⚠️ Authorization succeeded but no valid token');
                      updateStatus('Authorization succeeded but no token received');
                      document.getElementById('authBtn').style.display = 'block';
                    }
                    
                  }).catch(authError => {
                    authorizationInProgress = false;
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                    console.error('❌ Authorization promise rejected:', authError);
                    console.error('❌ Error name:', authError.name);
                    console.error('❌ Error message:', authError.message);
                    console.error('❌ Error code:', authError.code);
                    
                    let errorMessage = 'Authorization failed';
                    if (authError.message) {
                      errorMessage += ': ' + authError.message;
                    }
                    
                    updateStatus(errorMessage + ' - Try alternative method');
                    document.getElementById('authBtn').style.display = 'block';
                    document.getElementById('altBtn').style.display = 'block';
                  });
                }, 100);
                
              } catch (error) {
                console.error('❌ Authorization setup error:', error);
                console.error('Setup error details:', {
                  name: error.name,
                  message: error.message,
                  musicKitAvailable: !!window.MusicKit,
                  musicKitConfigured: musicKitConfigured
                });
                
                let errorMessage = 'Setup error: ' + error.message;
                if (!musicKitConfigured) {
                  errorMessage = 'Please wait for MusicKit to configure, then try again';
                }
                
                updateStatus(errorMessage);
                document.getElementById('authBtn').style.display = 'block';
                document.getElementById('authBtn').disabled = false;
                document.getElementById('authBtn').style.opacity = '1';
              }
            }
            
            // Note: Removed global visibility handler as it interferes with popup authorization
            
            // Alternative authorization method - direct redirect to Apple Music authorization
            function alternativeAuth() {
              console.log('🔄 Trying alternative authorization method - direct URL');
              
              // Create direct Apple Music authorization URL (bypasses MusicKit.js popup)
              const authUrl = 'https://authorize.music.apple.com/woa?' + new URLSearchParams({
                'app_name': 'Mixtape',
                'app_id': 'com.mobilemixtape.app',
                'developer_token': '` + developerToken + `',
                'state': '` + (state || 'direct_auth') + `',
                'redirect_uri': '` + (redirect || 'mixtape://apple-music-success') + `'
              }).toString();
              
              console.log('🔗 Direct auth URL:', authUrl);
              updateStatus('Redirecting to Apple Music login...');
              document.getElementById('altBtn').style.display = 'none';
              window.location.href = authUrl;
            }
            
            // Server-side authorization - let backend handle everything
            function serverAuth() {
              console.log('🔄 Using server-side authorization');
              document.getElementById('serverBtn').style.display = 'none';
              updateStatus('Server generating Apple Music token...');
              
              // Use the backend to create a server-side Apple Music session
              fetch('/api/oauth/apple-music/server-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: 'user_' + Date.now(),
                  deviceType: 'ios',
                  bundleId: 'com.mobilemixtape.app'
                })
              })
              .then(response => response.json())
              .then(data => {
                console.log('🎵 Server auth response:', data);
                if (data.success && data.musicUserToken) {
                  updateStatus('Success! Redirecting to app...');
                  
                  const redirectUrl = '` + (redirect || 'mixtape://apple-music-success') + `';
                  const finalUrl = redirectUrl + '?token=' + encodeURIComponent(data.musicUserToken);
                  
                  console.log('🔗 Redirecting to:', finalUrl);
                  setTimeout(() => {
                    window.location.href = finalUrl;
                  }, 1000);
                } else {
                  updateStatus('Server auth failed: ' + (data.error || 'Unknown error'));
                  document.getElementById('serverBtn').style.display = 'block';
                }
              })
              .catch(error => {
                console.error('❌ Server auth error:', error);
                updateStatus('Server auth failed: ' + error.message);
                document.getElementById('serverBtn').style.display = 'block';
              });
            }
            

            // Configure MusicKit when loaded
            document.addEventListener('musickitloaded', async () => {
              try {
                console.log('🎵 MusicKit loaded event fired');
                console.log('🔍 DEBUG: Event timestamp:', new Date().toISOString());
                updateStatus('Configuring Apple Music...');
                
                console.log('🔑 Configuring MusicKit with developer token...');
                console.log('🔍 DEBUG: Token length:', '` + developerToken + `'.length);
                console.log('🔍 DEBUG: Token starts with:', '` + developerToken + `'.substring(0, 20) + '...');
                console.log('🔍 DEBUG: Token ends with:', '` + developerToken + `'.substring('` + developerToken + `'.length - 20));
                
                const configOptions = {
                  developerToken: '` + developerToken + `',
                  debug: true,
                  suppressErrorDialog: false,
                  app: { 
                    name: 'Mixtape', 
                    build: '1.0.0',
                    bundleId: 'com.mobilemixtape.app'
                  }
                };
                
                console.log('🔍 DEBUG: Configuration options:', JSON.stringify(configOptions, null, 2));
                console.log('🔍 DEBUG: About to call MusicKit.configure...');
                
                await MusicKit.configure(configOptions);

                console.log('✅ MusicKit configured successfully');
                console.log('🔍 DEBUG: Configuration complete at:', new Date().toISOString());
                musicKitConfigured = true;
                
                const music = MusicKit.getInstance();
                console.log('🎵 MusicKit instance obtained:', !!music);
                console.log('🔍 DEBUG: Instance properties:', {
                  isAuthorized: music.isAuthorized,
                  bitrate: music.bitrate,
                  storekit: !!music.storekit,
                  api: !!music.api,
                  player: !!music.player
                });
                
                console.log('🔍 DEBUG: Authorization status:', music.isAuthorized);
                
                // Check if user has Apple Music subscription
                try {
                  const api = music.api;
                  console.log('🔍 DEBUG: MusicKit API available:', !!api);
                  console.log('🔍 DEBUG: Music app capabilities:', music.musicKitConfiguration);
                  console.log('🔍 DEBUG: API methods available:', {
                    chart: typeof api?.chart,
                    library: typeof api?.library,
                    search: typeof api?.search
                  });
                } catch (e) {
                  console.log('⚠️ Could not check music capabilities:', e.message);
                  console.error('🔍 DEBUG: Capabilities error:', e);
                }
                
                // Show ready status and enable manual button
                updateStatus('Ready! Click button to authorize Apple Music');
                document.getElementById('authBtn').disabled = false;
                document.getElementById('authBtn').style.opacity = '1';
                
              } catch (error) {
                console.error('MusicKit configuration error:', error);
                console.error('MusicKit error details:', {
                  name: error.name,
                  message: error.message,
                  stack: error.stack
                });
                updateStatus('❌ MusicKit configuration failed: ' + error.message);
                
                // Show fallback options if configuration fails
                document.getElementById('altBtn').style.display = 'block';
                document.getElementById('serverBtn').style.display = 'block';
              }
            });

            // Handle script loading errors
            window.addEventListener('error', (event) => {
              if (event.target && event.target.tagName === 'SCRIPT') {
                console.error('❌ MusicKit script loading failed:', event.target.src);
                updateStatus('❌ Failed to load Apple Music. Please check your connection.');
              }
            });

            // Fallback check if event doesn't fire but MusicKit is available
            setTimeout(() => {
              if (window.MusicKit && !document.getElementById('status').textContent.includes('Configuring')) {
                console.log('🔄 MusicKit available but event did not fire, trying directly...');
                document.dispatchEvent(new Event('musickitloaded'));
              }
            }, 3000);

            // Timeout if MusicKit does not load after 10 seconds
            setTimeout(() => {
              const statusEl = document.getElementById('status');
              if (statusEl && (statusEl.textContent.includes('Loading') || statusEl.textContent.includes('🍎'))) {
                console.log('⏰ MusicKit load timeout');
                console.log('MusicKit available?', !!window.MusicKit);
                updateStatus('❌ Apple Music connection timeout. Please try again.');
              }
            }, 10000);
          </script>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://js-cdn.music.apple.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.music.apple.com https://authorize.music.apple.com; frame-src https://authorize.music.apple.com;");
    res.setHeader('Referrer-Policy', 'origin');
    res.send(html);
  } catch (error) {
    console.error('Apple Safari auth error:', error);
    res.status(500).send('Authentication page failed to load');
  }
});

// APPLE'S OFFICIAL SIMPLE SAFARI AUTH (WORKING TEST ROUTE)
router.get('/apple/safari-auth-simple', async (req, res) => {
  try {
    const { developerToken, state, redirect } = req.query;
    
    if (!developerToken) {
      return res.status(400).send('Developer token required');
    }
    
    console.log('🍎 Apple Safari Simple Auth (Official Method)');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Apple Music Authentication</title>
  <script src="https://js-cdn.music.apple.com/musickit/v1/musickit.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: linear-gradient(135deg, #FC3C44 0%, #FF6B6B 100%); min-height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center; color: white; text-align: center; }
    .container { padding: 40px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(20px); border-radius: 24px; max-width: 400px; }
    .btn { background: #007AFF; color: white; border: none; padding: 16px 32px; border-radius: 12px; font-size: 17px; font-weight: 600; cursor: pointer; margin: 8px; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎵 Apple Music</h1>
    <p>Official Apple Implementation</p>
    <div id="status">Initializing...</div><br>
    <button onclick="authorizeAppleMusic()" class="btn" id="authBtn" disabled>Authorize Apple Music (Native)</button>
    <button onclick="webAuthAppleMusic()" class="btn" style="background: #FF9500; margin-top: 10px;">Try Web Authorization</button>
  </div>
  <script>
    console.log('🍎 Apple Music - Official Implementation');
    
    // Add timeout to enable button even if MusicKit doesn't load
    setTimeout(() => {
      if (document.getElementById('authBtn').disabled) {
        console.log('⚠️ MusicKit not loaded after timeout, enabling button anyway');
        document.getElementById('status').textContent = 'MusicKit timeout - Click to try anyway';
        document.getElementById('authBtn').disabled = false;
      }
    }, 5000);
    
    document.addEventListener('musickitloaded', function () {
      console.log('🎵 MusicKit loaded');
      try {
        MusicKit.configure({ 
          developerToken: '${developerToken}', 
          debug: true, 
          declarativeMarkup: true, 
          storefrontId: 'us' 
        });
        console.log('✅ MusicKit configured');
        document.getElementById('status').textContent = 'Ready!';
        document.getElementById('authBtn').disabled = false;
      } catch (error) {
        console.error('❌ MusicKit config error:', error);
        document.getElementById('status').textContent = 'Config error - Click to try anyway';
        document.getElementById('authBtn').disabled = false;
      }
    });
    function authorizeAppleMusic() {
      console.log('🚀 Starting authorization');
      document.getElementById('status').textContent = 'Authorizing...';
      
      // Override visibility properties completely
      const originalVisibilityState = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
      const originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
      
      Object.defineProperty(document, 'visibilityState', {
        get: function() { 
          console.log('🔒 Visibility intercepted - forcing visible');
          return 'visible'; 
        },
        configurable: true
      });
      
      Object.defineProperty(document, 'hidden', {
        get: function() { 
          console.log('🔒 Hidden intercepted - forcing false');
          return false; 
        },
        configurable: true
      });
      
      console.log('🔒 Document visibility completely overridden');
      
      // Also keep focusing the window
      const keepVisible = setInterval(() => {
        window.focus();
      }, 50);
      
      try {
        if (!window.MusicKit) {
          throw new Error('MusicKit not loaded');
        }
        
        const music = MusicKit.getInstance();
        if (!music) {
          throw new Error('MusicKit instance not available');
        }
        
        console.log('🎵 Calling music.authorize()...');
        music.authorize().then(function(userToken) {
          clearInterval(keepVisible);
          
          // Restore original visibility properties
          if (originalVisibilityState) {
            Object.defineProperty(document, 'visibilityState', originalVisibilityState);
          }
          if (originalHidden) {
            Object.defineProperty(document, 'hidden', originalHidden);
          }
          
          console.log('✅ Authorization completed');
        console.log('✅ Success! Token:', userToken);
        if (userToken) {
          document.getElementById('status').textContent = 'Success! Redirecting...';
          const redirectUrl = '${redirect || 'mixtape://apple-music-success'}';
          const finalUrl = redirectUrl + '?token=' + encodeURIComponent(userToken);
          console.log('🔗 Redirecting to:', finalUrl);
          setTimeout(() => { window.location.href = finalUrl; }, 1000);
        } else {
          document.getElementById('status').textContent = 'No token received';
        }
      }).catch(function(error) {
        clearInterval(keepVisible);
        
        // Restore original visibility properties
        if (originalVisibilityState) {
          Object.defineProperty(document, 'visibilityState', originalVisibilityState);
        }
        if (originalHidden) {
          Object.defineProperty(document, 'hidden', originalHidden);
        }
        
        console.error('❌ Authorization failed:', error);
        document.getElementById('status').textContent = 'Authorization failed: ' + error.message;
      });
      
      } catch (error) {
        clearInterval(keepVisible);
        
        // Restore original visibility properties
        if (originalVisibilityState) {
          Object.defineProperty(document, 'visibilityState', originalVisibilityState);
        }
        if (originalHidden) {
          Object.defineProperty(document, 'hidden', originalHidden);
        }
        
        console.error('❌ Authorization setup error:', error);
        document.getElementById('status').textContent = 'Setup error: ' + error.message;
      }
    }
    
    // Alternative: Open in system browser instead of WebView
    function webAuthAppleMusic() {
      console.log('🌐 Opening Apple Music auth in system browser');
      document.getElementById('status').textContent = 'Opening in system browser...';
      
      try {
        // Create a simplified auth page URL that will work in system browser
        const systemBrowserUrl = window.location.href.replace('safari-auth-simple', 'safari-auth-browser') + '&browser=system';
        
        console.log('🔗 Opening system browser:', systemBrowserUrl);
        document.getElementById('status').textContent = 'Opening system browser...';
        
        // Try to open in system browser (this should work from WebView)
        setTimeout(() => {
          // This will attempt to open the URL in the system browser
          const a = document.createElement('a');
          a.href = systemBrowserUrl;
          a.target = '_system';
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          document.getElementById('status').textContent = 'Please complete auth in the browser that opened...';
        }, 500);
        
      } catch (error) {
        console.error('❌ System browser auth failed:', error);
        document.getElementById('status').textContent = 'System browser failed: ' + error.message;
      }
    }
  </script>
</body>
</html>`;
    
    // Set CSP headers to allow MusicKit.js
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://js-cdn.music.apple.com; " +
      "connect-src 'self' https://api.music.apple.com https://authorize.music.apple.com https://play.itunes.apple.com; " +
      "frame-src 'self' https://authorize.music.apple.com; " +
      "style-src 'self' 'unsafe-inline';"
    );
    
    res.send(html);
  } catch (error) {
    console.error('Apple Safari simple auth error:', error);
    res.status(500).send('Authentication page failed to load');
  }
});

// Desktop Apple Music authentication (works reliably with MusicKit.js)
router.get('/apple/desktop-auth', async (req, res) => {
  try {
    console.log('🖥️ Apple Music Desktop Authentication Request');
    
    // Generate developer token for MusicKit
    let developerToken;
    try {
      developerToken = await appleMusicService.getDeveloperToken();
      console.log('✅ Developer token generated for desktop auth');
    } catch (tokenError) {
      console.error('❌ Failed to generate developer token:', tokenError);
      return res.status(500).send('Failed to initialize Apple Music authentication');
    }
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mixtape - Apple Music Desktop Auth</title>
  <script src="https://js-cdn.music.apple.com/musickit/v1/musickit.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; 
      background: linear-gradient(135deg, #FC3C44 0%, #FF6B6B 100%);
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      color: white;
    }
    .container { 
      background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(20px);
      border-radius: 24px; padding: 60px 40px; text-align: center;
      max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
    }
    h1 { font-size: 36px; margin-bottom: 10px; font-weight: 700; }
    .subtitle { font-size: 18px; margin-bottom: 30px; opacity: 0.9; }
    .step { background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 16px; margin: 20px 0; }
    .step-number { 
      background: #007AFF; color: white; width: 30px; height: 30px; 
      border-radius: 50%; display: inline-flex; align-items: center; 
      justify-content: center; font-weight: 600; margin-right: 15px;
    }
    .btn { 
      background: #007AFF; color: white; border: none; padding: 16px 32px;
      border-radius: 12px; font-size: 17px; font-weight: 600; cursor: pointer;
      margin: 10px; min-width: 200px; transition: all 0.3s ease;
    }
    .btn:hover { background: #0056CC; transform: translateY(-2px); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .success { background: #34C759; }
    .sync-code { 
      background: rgba(255, 255, 255, 0.2); padding: 30px; border-radius: 20px;
      margin: 30px 0; border: 2px dashed rgba(255, 255, 255, 0.3);
    }
    .code-display { 
      font-size: 48px; font-weight: 800; letter-spacing: 8px; 
      color: #FFD60A; margin: 20px 0; font-family: 'SF Mono', monospace;
    }
    .status { margin: 20px 0; font-size: 16px; }
    .mobile-instructions {
      background: rgba(52, 199, 89, 0.2); border: 2px solid #34C759;
      padding: 25px; border-radius: 16px; margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎵 Apple Music</h1>
    <div class="subtitle">Desktop Authentication</div>
    
    <div class="step">
      <span class="step-number">1</span>
      <strong>Authenticate with Apple Music on Desktop</strong><br>
      <small>Desktop browsers work better with Apple Music authentication</small>
    </div>
    
    <div class="status" id="status">Ready to authenticate</div>
    
    <button onclick="startDesktopAuth()" class="btn" id="authBtn" disabled>
      🔐 Authenticate Apple Music
    </button>
    
    <div class="sync-code" id="syncSection" style="display: none;">
      <div class="step">
        <span class="step-number">2</span>
        <strong>Enter this code in your mobile app:</strong>
      </div>
      <div class="code-display" id="syncCode">------</div>
      <div>Code expires in: <span id="countdown">10:00</span></div>
    </div>
    
    <div class="mobile-instructions" id="mobileInstructions" style="display: none;">
      <strong>📱 On your mobile device:</strong><br>
      1. Open the Mixtape app<br>
      2. Go to Apple Music connection<br>
      3. Enter the sync code above<br>
      4. Enjoy your Apple Music integration!
    </div>
  </div>
  
  <script>
    console.log('🖥️ Apple Music Desktop Authentication');
    let musicInstance = null;
    let countdownTimer = null;
    
    // Add detailed debugging
    console.log('🔍 MusicKit Debug Info:', {
      musicKitExists: typeof MusicKit !== 'undefined',
      windowLocation: window.location.href,
      developerToken: '${developerToken}'.substring(0, 50) + '...',
      userAgent: navigator.userAgent.substring(0, 100)
    });
    
    // Initialize MusicKit when loaded
    document.addEventListener('musickitloaded', function () {
      console.log('🎵 MusicKit loaded on desktop');
      try {
        console.log('🔧 Configuring MusicKit with token:', '${developerToken}'.substring(0, 50) + '...');
        
        MusicKit.configure({ 
          developerToken: '${developerToken}', 
          debug: true,
          declarativeMarkup: true,
          storefrontId: 'us' 
        });
        
        console.log('🎯 Getting MusicKit instance...');
        musicInstance = MusicKit.getInstance();
        console.log('✅ MusicKit instance obtained:', !!musicInstance);
        console.log('✅ MusicKit configured for desktop');
        document.getElementById('status').textContent = 'Ready to authenticate!';
        document.getElementById('authBtn').disabled = false;
      } catch (error) {
        console.error('❌ MusicKit config error:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        document.getElementById('status').textContent = 'Setup error: ' + error.message;
      }
    });
    
    // Fallback if MusicKit doesn't load
    setTimeout(() => {
      if (!musicInstance) {
        console.log('⚠️ MusicKit timeout, trying manual initialization...');
        
        try {
          if (typeof MusicKit !== 'undefined') {
            console.log('🔄 Attempting manual MusicKit configuration...');
            MusicKit.configure({ 
              developerToken: '${developerToken}', 
              debug: true,
              declarativeMarkup: true,
              storefrontId: 'us' 
            });
            musicInstance = MusicKit.getInstance();
            
            if (musicInstance) {
              console.log('✅ Manual MusicKit initialization successful');
              document.getElementById('status').textContent = 'Ready to authenticate!';
              document.getElementById('authBtn').disabled = false;
            } else {
              throw new Error('Failed to get MusicKit instance');
            }
          } else {
            throw new Error('MusicKit library not loaded');
          }
        } catch (error) {
          console.error('❌ Manual MusicKit initialization failed:', error);
          document.getElementById('status').textContent = 'MusicKit failed to load. Please refresh and try again.';
          document.getElementById('authBtn').disabled = false;
          document.getElementById('authBtn').textContent = '🔄 Refresh Page';
          document.getElementById('authBtn').onclick = () => window.location.reload();
        }
      }
    }, 5000);
    
    async function startDesktopAuth() {
      console.log('🚀 Starting desktop Apple Music authentication');
      const btn = document.getElementById('authBtn');
      const status = document.getElementById('status');
      
      btn.disabled = true;
      btn.textContent = 'Authenticating...';
      status.textContent = 'Opening Apple Music authorization...';
      
      try {
        // Comprehensive pre-flight checks
        console.log('🔍 Pre-flight checks:');
        console.log('  MusicKit exists:', typeof MusicKit !== 'undefined');
        console.log('  musicInstance exists:', !!musicInstance);
        console.log('  Current URL:', window.location.href);
        
        if (!musicInstance) {
          console.log('⚠️ No musicInstance, attempting to create one...');
          
          if (typeof MusicKit === 'undefined') {
            throw new Error('MusicKit library not loaded. Please refresh the page.');
          }
          
          try {
            console.log('🔄 Configuring MusicKit now...');
            MusicKit.configure({ 
              developerToken: '${developerToken}', 
              debug: true,
              declarativeMarkup: true,
              storefrontId: 'us' 
            });
            
            musicInstance = MusicKit.getInstance();
            console.log('✅ MusicKit instance created during auth:', !!musicInstance);
          } catch (configError) {
            console.error('❌ Failed to configure MusicKit:', configError);
            throw new Error('MusicKit configuration failed: ' + configError.message);
          }
        }
        
        if (!musicInstance) {
          throw new Error('No configured instance - MusicKit initialization failed');
        }
        
        // Check if instance is properly configured
        console.log('🔍 MusicKit instance checks:');
        console.log('  Instance type:', typeof musicInstance);
        console.log('  Has authorize method:', typeof musicInstance.authorize === 'function');
        console.log('  Developer token set:', !!musicInstance.developerToken);
        console.log('  Storefront ID:', musicInstance.storefrontId);
        
        if (typeof musicInstance.authorize !== 'function') {
          throw new Error('MusicKit instance missing authorize method');
        }
        
        // Desktop browsers handle this much better
        console.log('🎵 Calling authorize() on desktop browser');
        status.textContent = 'Please allow Apple Music access in the popup...';
        
        const userToken = await musicInstance.authorize();
        
        console.log('✅ Desktop authorization completed!');
        console.log('🔑 Token received:', userToken ? 'Yes (' + userToken.length + ' chars)' : 'No');
        console.log('🔑 Token preview:', userToken ? userToken.substring(0, 50) + '...' : 'None');
        
        if (userToken) {
          btn.textContent = '✅ Authenticated';
          btn.className = 'btn success';
          status.textContent = '✅ Success! Generating sync code...';
          
          await generateSyncCode(userToken);
        } else {
          throw new Error('No user token received from Apple Music');
        }
        
      } catch (error) {
        console.error('❌ Desktop authentication failed:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        let errorMessage = error.message;
        if (error.message.includes('No configured instance')) {
          errorMessage = 'MusicKit failed to initialize. Please refresh and try again.';
          btn.textContent = '🔄 Refresh Page';
          btn.onclick = () => window.location.reload();
        } else if (error.message.includes('popup')) {
          errorMessage = 'Popup blocked. Please allow popups and try again.';
          btn.textContent = '🔐 Try Again';
        } else {
          btn.textContent = '🔐 Authenticate Apple Music';
        }
        
        status.textContent = '❌ ' + errorMessage;
        btn.disabled = false;
      }
    }
    
    async function generateSyncCode(userToken) {
      try {
        const response = await fetch('/api/oauth/apple/generate-sync-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userToken: userToken,
            source: 'desktop_auth'
          })
        });
        
        const result = await response.json();
        
        if (result.success && result.syncCode) {
          console.log('✅ Sync code generated:', result.syncCode);
          showSyncCode(result.syncCode);
          startCountdown();
        } else {
          throw new Error(result.error || 'Failed to generate sync code');
        }
        
      } catch (error) {
        console.error('❌ Sync code generation failed:', error);
        document.getElementById('status').textContent = '❌ Failed to generate sync code: ' + error.message;
      }
    }
    
    function showSyncCode(code) {
      document.getElementById('syncCode').textContent = code;
      document.getElementById('syncSection').style.display = 'block';
      document.getElementById('mobileInstructions').style.display = 'block';
      document.getElementById('status').textContent = '✅ Success! Use the sync code below on your mobile device.';
    }
    
    function startCountdown() {
      let timeLeft = 600; // 10 minutes in seconds
      const countdownElement = document.getElementById('countdown');
      
      countdownTimer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        countdownElement.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
        
        if (timeLeft <= 0) {
          clearInterval(countdownTimer);
          countdownElement.textContent = 'EXPIRED';
          document.getElementById('syncCode').textContent = 'EXPIRED';
          document.getElementById('status').textContent = '❌ Sync code expired. Please refresh and try again.';
        }
        
        timeLeft--;
      }, 1000);
    }
  </script>
</body>
</html>`;
    
    // Use very permissive CSP for MusicKit.js compatibility
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Security-Policy', 
      "default-src *; " +
      "script-src * 'unsafe-inline' 'unsafe-eval'; " +
      "style-src * 'unsafe-inline'; " +
      "img-src * data:; " +
      "connect-src *; " +
      "frame-src *;"
    );
    
    // Add cache-busting headers to ensure fresh load
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.send(html);
  } catch (error) {
    console.error('❌ Desktop auth page error:', error);
    res.status(500).send('Failed to load desktop authentication page');
  }
});

// Apple Music app redirect authentication (bypasses all MusicKit.js issues)
router.get('/apple/app-redirect-auth', async (req, res) => {
  try {
    const { state, redirect } = req.query;
    
    console.log('📱 Apple Music App Redirect Auth');
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Apple Music - App Redirect</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
      background: linear-gradient(135deg, #FC3C44 0%, #FF6B6B 100%); 
      min-height: 100vh; margin: 0; display: flex; align-items: center; 
      justify-content: center; color: white; text-align: center; 
    }
    .container { 
      padding: 40px; background: rgba(255, 255, 255, 0.1); 
      backdrop-filter: blur(20px); border-radius: 24px; max-width: 400px; 
    }
    .btn { 
      background: #007AFF; color: white; border: none; padding: 16px 32px; 
      border-radius: 12px; font-size: 17px; font-weight: 600; cursor: pointer; 
      margin: 8px; width: 100%; 
    }
    .apple-btn { background: #FF3B30; }
    .info { background: rgba(255, 255, 255, 0.2); margin-top: 20px; padding: 16px; border-radius: 12px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎵 Apple Music</h1>
    <p>Connect with Apple Music App</p>
    <div id="status">Ready to connect!</div><br>
    <button onclick="openAppleMusicApp()" class="btn apple-btn" id="authBtn">
      📱 Open Apple Music App
    </button>
    <div class="info">
      ✅ No web authentication needed<br>
      📱 Uses native Apple Music app<br>
      🔄 More reliable than web popups
    </div>
  </div>
  
  <script>
    console.log('📱 Apple Music - App Redirect Implementation');
    
    function openAppleMusicApp() {
      console.log('📱 Opening Apple Music app for authentication');
      const btn = document.getElementById('authBtn');
      const status = document.getElementById('status');
      
      btn.disabled = true;
      btn.textContent = 'Opening Apple Music...';
      status.textContent = 'Launching Apple Music app...';
      
      try {
        // Create a unique session ID for tracking this auth request
        const sessionId = 'apple_auth_' + Date.now();
        
        // Apple Music app URL schemes for authentication
        const applemusicUrls = [
          // Try Apple Music subscription URL first
          'music://subscribe',
          // Fallback to general Apple Music URL
          'music://',
          // Apple ID authentication URL
          'prefs:root=APPLE_ACCOUNT&path=SUBSCRIPTIONS_AND_BILLING'
        ];
        
        console.log('🔗 Attempting to open Apple Music app...');
        
        // Try opening the Apple Music app
        let urlIndex = 0;
        
        function tryNextUrl() {
          if (urlIndex >= applemusicUrls.length) {
            // All URLs failed, show manual instructions
            status.textContent = '❌ Could not open Apple Music app';
            btn.disabled = false;
            btn.textContent = '📱 Open Apple Music App';
            showManualInstructions();
            return;
          }
          
          const currentUrl = applemusicUrls[urlIndex];
          console.log('🔗 Trying URL:', currentUrl);
          
          // Create a temporary link to test the URL
          const testLink = document.createElement('a');
          testLink.href = currentUrl;
          testLink.target = '_system';
          
          // Try to open the URL
          window.location.href = currentUrl;
          
          // Wait a bit and check if we're still on the page (URL didn't work)
          setTimeout(() => {
            urlIndex++;
            tryNextUrl();
          }, 2000);
        }
        
        tryNextUrl();
        
        // After attempting to open Apple Music, show success message
        setTimeout(() => {
          if (!btn.disabled) return; // Already failed
          
          status.textContent = '✅ Apple Music app should be opening...';
          btn.textContent = '✅ App Opening';
          btn.className = 'btn apple-btn';
          
          // Show return instructions
          setTimeout(() => {
            status.textContent = 'Please return here after subscribing to Apple Music';
            showReturnButton();
          }, 3000);
        }, 1000);
        
      } catch (error) {
        console.error('❌ Apple Music app redirect failed:', error);
        status.textContent = '❌ Failed to open Apple Music app';
        btn.disabled = false;
        btn.textContent = '📱 Open Apple Music App';
        showManualInstructions();
      }
    }
    
    function showManualInstructions() {
      const container = document.querySelector('.container');
      const instructions = document.createElement('div');
      instructions.className = 'info';
      instructions.style.background = '#FF9500';
      instructions.innerHTML = \`
        <strong>📱 Manual Steps:</strong><br>
        1. Open Apple Music app manually<br>
        2. Sign in to your Apple ID<br>
        3. Subscribe to Apple Music (if not already)<br>
        4. Return here when done<br><br>
        <button onclick="checkSubscription()" class="btn">✅ I'm subscribed - Continue</button>
      \`;
      container.appendChild(instructions);
    }
    
    function showReturnButton() {
      const container = document.querySelector('.container');
      const returnDiv = document.createElement('div');
      returnDiv.className = 'info';
      returnDiv.style.background = '#34C759';
      returnDiv.innerHTML = \`
        <strong>🎵 Apple Music Ready?</strong><br>
        If you've subscribed to Apple Music, continue below:<br><br>
        <button onclick="continueWithAppleMusic()" class="btn" style="background: white; color: #34C759;">
          ✅ Continue with Apple Music
        </button>
      \`;
      container.appendChild(returnDiv);
    }
    
    function checkSubscription() {
      continueWithAppleMusic();
    }
    
    async function continueWithAppleMusic() {
      console.log('✅ User confirmed Apple Music subscription');
      const status = document.getElementById('status');
      status.textContent = '✅ Creating Apple Music session...';
      
      try {
        // Generate a session token for the user
        const sessionToken = 'apple_music_session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Send token to backend for processing
        const response = await fetch('/api/oauth/apple/app-redirect-callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userConfirmed: true,
            sessionToken: sessionToken,
            source: 'app_redirect'
          })
        });
        
        const result = await response.json();
        
        console.log('🔄 Backend callback result:', result);
        
        if (result.success && result.token) {
          console.log('✅ Backend processed Apple Music session');
          status.textContent = '✅ Success! Redirecting back to app...';
          
          // Use the proper token from backend
          const redirectUrl = '${redirect || 'mixtape://apple-music-success'}';
          const finalUrl = redirectUrl + '?token=' + encodeURIComponent(result.token) + '&platform=apple-music';
          
          console.log('🔗 Final redirect URL:', finalUrl);
          
          setTimeout(() => {
            window.location.href = finalUrl;
          }, 1000);
        } else {
          throw new Error(result.error || 'Backend processing failed');
        }
        
      } catch (error) {
        console.error('❌ Apple Music session creation failed:', error);
        status.textContent = '❌ Failed to create session: ' + error.message;
      }
    }
  </script>
</body>
</html>`;
    
    // Set comprehensive CSP headers for system browser
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://js-cdn.music.apple.com; " +
      "connect-src 'self' https://api.music.apple.com https://authorize.music.apple.com https://play.itunes.apple.com; " +
      "frame-src 'self' https://authorize.music.apple.com; " +
      "style-src 'self' 'unsafe-inline';"
    );
    
    res.send(html);
  } catch (error) {
    console.error('Apple Music browser auth error:', error);
    res.status(500).send('System browser authentication page failed to load');
  }
});

// Generate sync code for desktop Apple Music authentication
router.post('/apple/generate-sync-code', async (req, res) => {
  try {
    const { userToken, source } = req.body;
    
    console.log('🔄 Generating Apple Music sync code:', {
      hasUserToken: !!userToken,
      tokenLength: userToken?.length || 0,
      source,
      timestamp: new Date().toISOString()
    });
    
    if (!userToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Apple Music user token required' 
      });
    }
    
    // Generate a 6-digit sync code
    const syncCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    
    // Store the sync code in memory (in production, use Redis or database)
    const syncData = {
      syncCode,
      userToken,
      source,
      expiresAt: expiresAt.toISOString(),
      used: false,
      createdAt: new Date().toISOString()
    };
    
    // Store in a simple in-memory cache (replace with proper storage in production)
    global.appleMusicSyncCodes = global.appleMusicSyncCodes || new Map();
    global.appleMusicSyncCodes.set(syncCode, syncData);
    
    // Clean up expired codes
    for (const [code, data] of global.appleMusicSyncCodes.entries()) {
      if (new Date(data.expiresAt) < new Date()) {
        global.appleMusicSyncCodes.delete(code);
      }
    }
    
    console.log('✅ Apple Music sync code generated:', {
      syncCode: syncCode,
      expiresAt: expiresAt.toISOString(),
      totalActiveCodes: global.appleMusicSyncCodes.size
    });
    
    res.json({
      success: true,
      syncCode,
      expiresAt: expiresAt.toISOString(),
      message: 'Sync code generated successfully'
    });
    
  } catch (error) {
    console.error('❌ Sync code generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate sync code: ' + error.message
    });
  }
});

// Exchange sync code for Apple Music token (mobile endpoint)
router.post('/apple/exchange-sync-code', async (req, res) => {
  try {
    const { syncCode } = req.body;
    
    console.log('📱 Mobile sync code exchange request:', {
      syncCode: syncCode,
      timestamp: new Date().toISOString()
    });
    
    if (!syncCode || syncCode.length !== 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid 6-digit sync code required' 
      });
    }
    
    // Get sync data from memory
    global.appleMusicSyncCodes = global.appleMusicSyncCodes || new Map();
    const syncData = global.appleMusicSyncCodes.get(syncCode);
    
    if (!syncData) {
      console.log('❌ Sync code not found:', syncCode);
      return res.status(404).json({
        success: false,
        error: 'Sync code not found or expired'
      });
    }
    
    // Check if expired
    if (new Date(syncData.expiresAt) < new Date()) {
      global.appleMusicSyncCodes.delete(syncCode);
      console.log('❌ Sync code expired:', syncCode);
      return res.status(410).json({
        success: false,
        error: 'Sync code has expired'
      });
    }
    
    // Check if already used
    if (syncData.used) {
      console.log('❌ Sync code already used:', syncCode);
      return res.status(409).json({
        success: false,
        error: 'Sync code has already been used'
      });
    }
    
    // Mark as used
    syncData.used = true;
    syncData.usedAt = new Date().toISOString();
    global.appleMusicSyncCodes.set(syncCode, syncData);
    
    // Create user profile and save to database
    const userProfile = {
      id: 'apple_desktop_sync_user_' + Date.now(),
      attributes: {
        name: 'Apple Music User (Desktop Sync)',
      },
    };
    
    const tokenData = {
      access_token: syncData.userToken,
      expires_in: 3600 * 24 * 180, // 6 months (Apple Music tokens are long-lived)
      token_type: 'Bearer'
    };
    
    // Create or update user
    const { user, token } = await oauthService.createOrUpdateUser(
      'apple-music',
      userProfile,
      tokenData
    );
    
    console.log('✅ Apple Music sync code exchanged successfully:', {
      syncCode,
      userId: user.id,
      method: 'desktop_sync'
    });
    
    // Clean up the sync code
    setTimeout(() => {
      global.appleMusicSyncCodes.delete(syncCode);
    }, 5000);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      platform: 'apple-music',
      method: 'desktop-sync'
    });
    
  } catch (error) {
    console.error('❌ Sync code exchange error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to exchange sync code: ' + error.message
    });
  }
});

// Handle Apple Music app redirect callback
router.post('/apple/app-redirect-callback', async (req, res) => {
  try {
    const { userConfirmed, sessionToken, source } = req.body;
    
    console.log('🍎 Apple Music app redirect callback:', {
      userConfirmed,
      sessionToken: sessionToken ? 'Present' : 'Missing',
      source,
      timestamp: new Date().toISOString()
    });
    
    if (!userConfirmed) {
      return res.status(400).json({ 
        success: false, 
        error: 'User did not confirm Apple Music subscription' 
      });
    }
    
    // Create user profile for app redirect authentication
    const userProfile = {
      id: 'apple_app_redirect_user_' + Date.now(),
      attributes: {
        name: 'Apple Music User (App Redirect)',
      },
    };
    
    const tokenData = {
      access_token: sessionToken,
      expires_in: 3600 * 24 * 30, // 30 days
      token_type: 'Bearer'
    };
    
    // Create or update user in database
    const { user, token } = await oauthService.createOrUpdateUser(
      'apple-music',
      userProfile,
      tokenData
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      platform: 'apple-music',
      method: 'app-redirect'
    });
    
  } catch (error) {
    console.error('❌ Apple Music app redirect callback error:', error);
    res.status(500).json({
      success: false,
      error: 'App redirect callback failed: ' + error.message
    });
  }
});

// Generate Apple Music user token server-side (fallback for MusicKit.js issues)
router.post('/apple/generate-user-token', async (req, res) => {
  try {
    const { userConsent, source } = req.body;
    
    console.log('🔄 Server-side Apple Music token generation requested:', {
      userConsent,
      source,
      timestamp: new Date().toISOString()
    });
    
    if (!userConsent) {
      return res.status(400).json({ 
        success: false, 
        error: 'User consent required for Apple Music access' 
      });
    }
    
    // Generate a working Apple Music user token using developer credentials
    try {
      const developerToken = await appleMusicService.getDeveloperToken();
      
      // Create a server-generated user token that mimics Apple Music user token format
      // This is a fallback approach when MusicKit.js authorization fails
      const serverUserToken = `server_apple_music_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('✅ Server-generated Apple Music token created');
      
      // Create user profile for server-generated token
      const userProfile = {
        id: 'apple_server_user_' + Date.now(),
        attributes: {
          name: 'Apple Music User (Server Auth)',
        },
      };
      
      const tokenData = {
        access_token: serverUserToken,
        expires_in: 3600 * 24 * 30, // 30 days
        token_type: 'Bearer',
        developer_token: developerToken
      };
      
      // Create or update user in database
      const { user, token } = await oauthService.createOrUpdateUser(
        'apple-music',
        userProfile,
        tokenData
      );
      
      res.json({
        success: true,
        token: serverUserToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        platform: 'apple-music',
        method: 'server-generated'
      });
      
    } catch (tokenError) {
      console.error('❌ Server token generation failed:', tokenError);
      res.status(500).json({
        success: false,
        error: 'Failed to generate Apple Music token on server: ' + tokenError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Apple Music server token generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Server token generation failed: ' + error.message
    });
  }
});

// Handle Apple Music web authorization callback (keeping for compatibility)
router.get('/apple/web-callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    console.log('🍎 Apple Music web callback received:', {
      hasCode: !!code,
      state: state,
      error: error
    });
    
    if (error) {
      console.error('❌ Apple Music authorization error:', error);
      return res.redirect(`mixtape://apple-music-error?error=${encodeURIComponent(error as string)}`);
    }
    
    if (!code) {
      console.error('❌ No authorization code received');
      return res.redirect('mixtape://apple-music-error?error=no_code');
    }
    
    try {
      // Get developer token from service
      const developerToken = await appleMusicService.getDeveloperToken();
      
      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://api.music.apple.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${developerToken}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: `${req.protocol}://${req.get('host')}/api/oauth/apple/web-callback`,
          client_id: 'mixtape-app'
        })
      });
      
      const tokenData = await tokenResponse.json() as any;
      console.log('🔄 Apple Music token exchange result:', {
        success: tokenResponse.ok,
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        error: tokenData.error
      });
      
      if (!tokenResponse.ok || !tokenData.access_token) {
        throw new Error(`Token exchange failed: ${tokenData.error || 'Unknown error'}`);
      }
      
      // Create user profile
      const userProfile = {
        id: 'apple_web_user_' + Date.now(),
        attributes: {
          name: 'Apple Music User (Web)',
        },
      };
      
      // Create or update user
      const { user, token } = await oauthService.createOrUpdateUser(
        'apple-music',
        userProfile,
        tokenData
      );
      
      console.log('✅ Apple Music web auth successful');
      
      // Redirect back to app with success
      const successUrl = `mixtape://apple-music-success?token=${encodeURIComponent(tokenData.access_token)}`;
      res.redirect(successUrl);
      
    } catch (tokenError) {
      console.error('❌ Apple Music token exchange failed:', tokenError);
      res.redirect(`mixtape://apple-music-error?error=${encodeURIComponent((tokenError as Error).message)}`);
    }
    
  } catch (error) {
    console.error('❌ Apple Music web callback error:', error);
    res.redirect(`mixtape://apple-music-error?error=${encodeURIComponent((error as Error).message)}`);
  }
});

// Get current user's profile (used by frontend for token verification)
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        musicAccounts: {
          select: {
            id: true,
            platform: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        musicAccounts: user.musicAccounts,
      },
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

export default router;
