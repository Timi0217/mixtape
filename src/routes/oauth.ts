import express from 'express';
import { query, body } from 'express-validator';
import { validateRequest } from '../utils/validation';
import { oauthService } from '../services/oauthService';
import { OAuthSessionService } from '../services/oauthSessionService';
import { prisma } from '../config/database';
import * as he from 'he';

const router = express.Router();

// Start Spotify OAuth flow
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
      

      // Check for OAuth error
      if (error) {
        return res.redirect(`${process.env.FRONTEND_URL}auth/error?error=${error}`);
      }
      
      if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL}auth/error?error=missing_code`);
      }
      
      if (!state) {
        return res.redirect(`${process.env.FRONTEND_URL}auth/error?error=missing_state`);
      }

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

// Start Apple Music OAuth flow
router.get('/apple/login', async (req, res) => {
  try {
    
    // Check if Apple Music is configured
    if (!process.env.APPLE_MUSIC_KEY_ID || !process.env.APPLE_MUSIC_TEAM_ID || !process.env.APPLE_MUSIC_PRIVATE_KEY_PATH) {
      return res.status(503).json({ 
        error: 'Apple Music authentication is currently unavailable. Please contact support.' 
      });
    }
    
    const state = oauthService.generateState();
    await OAuthSessionService.storeState(state, 'apple-music');
    
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.API_BASE_URL || 'https://amiable-upliftment-production.up.railway.app'
      : `http://localhost:8080`;
      
    res.json({
      authUrl: `${baseUrl}/api/oauth/apple/auth-page?state=${state}`,
      state,
    });
  } catch (error) {
    console.error('Apple Music OAuth initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate Apple Music authentication' });
  }
});

// Serve Apple Music auth page
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
        <script src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"></script>
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
          document.addEventListener('DOMContentLoaded', function() {
            // Configure MusicKit
            MusicKit.configure({
              developerToken: '${developerToken}',
              app: {
                name: 'Mixtape',
                build: '1.0.0'
              }
            });
          });
          
          async function authorizeMusic() {
            const btn = document.getElementById('loginBtn');
            const status = document.getElementById('status');
            
            try {
              btn.disabled = true;
              btn.textContent = 'Connecting...';
              status.textContent = 'Requesting Apple Music permission...';
              
              const music = MusicKit.getInstance();
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

export default router;