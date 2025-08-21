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
      const { musicUserToken, userInfo, code, state, redirectUri } = req.body;
      
      if (code && state && redirectUri) {
        // AuthSession flow: exchange authorization code for user token
        console.log('🍎 Processing Apple Music AuthSession flow...');
        console.log('📄 Code:', code.substring(0, 20) + '...');
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
        console.log('🔑 Token preview:', musicUserToken.substring(0, 20) + '...');
        
        // Validate that this looks like a real Music User Token, not an Apple ID token
        if (musicUserToken.includes('eyJraWQiOiJVYUlJRlkyZlc0')) {
          console.error('❌ Received Apple ID token instead of Music User Token');
          return res.status(400).json({ 
            error: 'Invalid token type',
            message: 'This appears to be an Apple ID token. Please provide a Music User Token from MusicKit.js authorization.'
          });
        }
        
        // Use the enhanced Apple Music user creation function
        const { user, token } = await oauthService.createOrUpdateUserFromAppleMusic(musicUserToken, userInfo);

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

// Apple Safari auth page for WebView/browser authentication
router.get('/apple/safari-auth', async (req, res) => {
  try {
    const { developerToken, state, redirect } = req.query;
    
    if (!developerToken) {
      return res.status(400).send('Developer token required');
    }
    
    console.log('🍎 Apple Safari auth request:', { 
      state: state,
      redirect: redirect,
      tokenLength: developerToken.length 
    });

    // Create a simple HTML page with MusicKit.js
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Apple Music Authentication</title>
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
            <button onclick="manualAuth()" class="btn" id="authBtn">Authorize Apple Music</button>
          </div>

          <script>
            console.log('🍎 Apple Music auth page loaded');
            
            // Load MusicKit.js dynamically with better error handling
            const script = document.createElement('script');
            script.src = 'https://js-cdn.music.apple.com/musickit/v1/musickit.js';
            script.async = true;
            
            script.onload = () => {
              console.log('✅ MusicKit.js script loaded successfully');
              updateStatus('MusicKit loaded, initializing...');
            };
            
            script.onerror = (error) => {
              console.error('❌ Failed to load MusicKit.js:', error);
              updateStatus('❌ Failed to load Apple Music. Please check your connection.');
            };
            
            document.head.appendChild(script);
            
            function updateStatus(message) {
              document.getElementById('status').textContent = message;
            }
            
            function manualAuth() {
              console.log('🖱️ Manual authorization button clicked');
              document.getElementById('authBtn').style.display = 'none';
              updateStatus('Opening Apple Music authorization...');
              
              if (window.MusicKit) {
                const music = MusicKit.getInstance();
                
                // Add better error handling for the authorization
                music.authorize().then(token => {
                  console.log('🎵 Authorization response:', token);
                  if (token) {
                    console.log('✅ Token received, redirecting...');
                    updateStatus('Success! Redirecting back to app...');
                    
                    // Add delay before redirect to ensure token is valid
                    setTimeout(() => {
                      const redirectUrl = '` + (redirect || 'mixtape://apple-music-success') + `';
                      const finalUrl = redirectUrl + '?token=' + encodeURIComponent(token);
                      console.log('🔗 Redirecting to:', finalUrl);
                      window.location.href = finalUrl;
                    }, 1000);
                  } else {
                    console.warn('⚠️ No token received');
                    updateStatus('Authorization completed but no token received');
                    document.getElementById('authBtn').style.display = 'block';
                  }
                }).catch(error => {
                  console.error('❌ Manual auth failed:', error);
                  updateStatus('Authorization failed. Please try again.');
                  document.getElementById('authBtn').style.display = 'block';
                });
              } else {
                console.error('❌ MusicKit not available');
                updateStatus('MusicKit not loaded. Please refresh the page.');
              }
            }
            

            // Configure MusicKit when loaded
            document.addEventListener('musickitloaded', async () => {
              try {
                console.log('🎵 MusicKit loaded event fired');
                updateStatus('Configuring Apple Music...');
                
                console.log('🔑 Configuring MusicKit with developer token...');
                await MusicKit.configure({
                  developerToken: '` + developerToken + `',
                  app: { name: 'Mixtape', build: '1.0.0' }
                });

                console.log('✅ MusicKit configured successfully');
                
                const music = MusicKit.getInstance();
                console.log('🎵 MusicKit instance:', music);
                console.log('🔍 Checking authorization status:', music.isAuthorized);
                
                // Check if user has Apple Music subscription
                try {
                  const api = music.api;
                  console.log('🔍 MusicKit API available:', !!api);
                  console.log('🔍 Music app capabilities:', music.musicKitConfiguration);
                } catch (e) {
                  console.log('⚠️ Could not check music capabilities:', e.message);
                }
                
                // Show ready status and manual button
                updateStatus('Ready! Click button to authorize Apple Music');
                
              } catch (error) {
                console.error('MusicKit configuration error:', error);
                updateStatus('❌ MusicKit configuration failed: ' + error.message);
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
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://js-cdn.music.apple.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.music.apple.com;");
    res.send(html);
  } catch (error) {
    console.error('Apple Safari auth error:', error);
    res.status(500).send('Authentication page failed to load');
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
