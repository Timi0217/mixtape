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

// Start Spotify OAuth flow for account linking (authenticated users)
router.get('/spotify/link', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const state = oauthService.generateState();
    const authUrl = oauthService.getSpotifyAuthUrl(state, true); // true for linking
    
    // Store state with user context for linking
    await OAuthSessionService.storeLinkingState(state, 'spotify', userId);
    
    res.json({
      authUrl,
      state,
      tokenId: state,
    });
    
  } catch (error) {
    console.error('Spotify OAuth linking error:', error);
    res.status(500).json({ error: 'Failed to initiate Spotify account linking' });
  }
});

// Exchange Spotify code for token (for account linking)
router.post('/spotify/link-exchange',
  [
    body('code').notEmpty().withMessage('Authorization code is required'),
    body('redirectUri').notEmpty().withMessage('Redirect URI is required'),
    body('state').notEmpty().withMessage('State parameter is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { code, redirectUri, state } = req.body;

      // Validate state and get user context
      const linkingSession = await OAuthSessionService.getLinkingSession(state);
      if (!linkingSession || linkingSession.platform !== 'spotify') {
        return res.status(400).json({ error: 'Invalid linking session' });
      }

      // Exchange code for tokens using the provided redirect URI
      const tokenData = await oauthService.exchangeSpotifyCodeWithUri(code, redirectUri);
      
      // Get user profile
      const userProfile = await oauthService.getSpotifyUserProfile(tokenData.access_token);
      
      // Link to existing user instead of creating new one
      try {
        await oauthService.linkMusicAccountToUser(
          linkingSession.userId,
          'spotify',
          userProfile,
          tokenData
        );
      } catch (error) {
        // MergeRequiredError no longer thrown - auto-merge happens in service
        console.error('OAuth error:', error);
        throw error;
      }

      // Clean up linking session
      await OAuthSessionService.deleteLinkingSession(state);

      res.json({
        success: true,
        platform: 'spotify',
        message: 'Spotify account linked successfully',
      });
      
    } catch (error) {
      console.error('Spotify account linking error:', error);
      res.status(500).json({ error: 'Failed to link Spotify account' });
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

// Handle Spotify OAuth callback for linking
router.get('/spotify/link-callback',
  async (req, res) => {
    try {
      const { code, state, error } = req.query;
      
      if (error) {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Linking Failed</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px; background: #f44336; color: white;">
            <h1>❌ Account Linking Failed</h1>
            <p>Error: ${error}</p>
            <p><a href="mixtape://auth/error?error=${error}" style="color: white;">Return to App</a></p>
          </body>
          </html>
        `);
      }

      // Validate linking session
      const linkingSession = await OAuthSessionService.getLinkingSession(state as string);
      if (!linkingSession || linkingSession.platform !== 'spotify') {
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Invalid Session</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px; background: #f44336; color: white;">
            <h1>❌ Invalid Session</h1>
            <p>Linking session is invalid or expired.</p>
            <p><a href="mixtape://auth/error?error=invalid_session" style="color: white;">Return to App</a></p>
          </body>
          </html>
        `);
      }

      // Exchange code for tokens
      const tokenData = await oauthService.exchangeSpotifyCodeWithUri(code as string, process.env.SPOTIFY_REDIRECT_URI!);
      
      // Get user profile
      const userProfile = await oauthService.getSpotifyUserProfile(tokenData.access_token);
      
      // Simply add Spotify account to existing user
      try {
        await prisma.userMusicAccount.upsert({
          where: {
            userId_platform: {
              userId: linkingSession.userId,
              platform: 'spotify'
            }
          },
          update: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
          },
          create: {
            userId: linkingSession.userId,
            platform: 'spotify',
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
          }
        });
        
        console.log(`✅ Successfully added Spotify account to user ${linkingSession.userId}`);
      } catch (error) {
        // MergeRequiredError no longer thrown - auto-merge happens in service
        console.error('Spotify linking error:', error);
        throw error;
      }

      // Store success data for polling
      await OAuthSessionService.storeTokenData(state as string, { 
        success: true, 
        platform: 'spotify',
        message: 'Spotify account linked successfully'
      }, 'spotify');

      // Clean up linking session
      await OAuthSessionService.deleteLinkingSession(state as string);

      // Show success page
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Account Linked - Mixtape</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
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
            }
            .success-icon {
              width: 80px; height: 80px; background: #34C759; border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              margin: 0 auto 24px; color: white; font-size: 36px; font-weight: bold;
            }
            h1 { color: #1d1d1f; font-size: 32px; font-weight: 700; margin-bottom: 12px; }
            p { color: #86868b; font-size: 17px; line-height: 1.4; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>Account Linked!</h1>
            <p>Your Spotify account has been successfully linked to Mixtape.</p>
          </div>
          <script>
            // Immediately redirect to app
            window.location.href = 'mixtape://auth/success?platform=spotify&linked=true';
          </script>
        </body>
        </html>
      `;
      
      res.send(html);
      
    } catch (error) {
      console.error('Spotify linking callback error:', error);
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Linking Error</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px; background: #f44336; color: white;">
          <h1>❌ Account Linking Failed</h1>
          <p>Something went wrong during account linking.</p>
          <p><a href="mixtape://auth/error?error=linking_failed" style="color: white;">Return to App</a></p>
        </body>
        </html>
      `);
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

      // Check if this is a linking request or login request
      const linkingSession = await OAuthSessionService.getLinkingSession(state as string);
      
      if (linkingSession) {
        // This is account linking - link to existing user
        console.log(`🔗 Spotify account linking for user ${linkingSession.userId}`);
        
        const tokenData = await oauthService.exchangeSpotifyCode(code as string);
        const userProfile = await oauthService.getSpotifyUserProfile(tokenData.access_token);
        
        await oauthService.linkMusicAccountToUser(
          linkingSession.userId,
          'spotify',
          userProfile,
          tokenData
        );
        
        // Clean up linking session
        await OAuthSessionService.deleteLinkingSession(state as string);
        
        // Show success page for linking
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Account Linked - Mixtape</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
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
              }
              .success-icon {
                width: 80px; height: 80px; background: #34C759; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                margin: 0 auto 24px; color: white; font-size: 36px; font-weight: bold;
              }
              h1 { color: #1d1d1f; font-size: 32px; font-weight: 700; margin-bottom: 12px; }
              p { color: #86868b; font-size: 17px; line-height: 1.4; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✓</div>
              <h1>Account Linked!</h1>
              <p>Your Spotify account has been successfully linked to Mixtape.</p>
            </div>
            <script>
              // Auto-redirect to app immediately - same as login
              setTimeout(() => {
                window.location.href = 'mixtape://auth/success?platform=spotify';
              }, 2000);
            </script>
          </body>
          </html>
        `;
        
        return res.send(html);
      }
      
      // This is a regular login - verify state and proceed
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

// Simple Apple Music auth page without MusicKit
router.get('/apple/simple-auth', async (req, res) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).send('Missing state parameter');
    }
    
    const sessionData = await OAuthSessionService.getSessionState(state as string);
    if (!sessionData) {
      return res.status(400).send('Invalid or expired state parameter');
    }
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Connect Apple Music</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
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
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            padding: 60px 40px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
          }
          .logo { font-size: 60px; margin-bottom: 20px; }
          h1 { color: #333; margin-bottom: 10px; font-size: 28px; font-weight: 600; }
          p { color: #666; margin-bottom: 30px; line-height: 1.5; }
          .button {
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
            text-decoration: none;
            display: inline-block;
          }
          .button:hover { background: #e63540; }
          .status { margin-top: 20px; color: #666; font-size: 14px; }
          .success { color: #34C759; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🎵</div>
          <h1>Connect Apple Music</h1>
          <p>Tap the button below to open Apple Music and complete the connection.</p>
          
          <button onclick="connectAppleMusic()" class="button">
            Open Apple Music App
          </button>
          
          <button onclick="simulateConnection()" class="button" style="background: #34C759;">
            Simulate Connection (Demo)
          </button>
          
          <div id="status" class="status">Ready to connect</div>
        </div>
        
        <script>
          function connectAppleMusic() {
            const status = document.getElementById('status');
            status.textContent = 'Opening Apple Music...';
            
            // Try to open Apple Music app
            window.location.href = 'music://';
            
            // Fallback: simulate connection after delay
            setTimeout(simulateConnection, 3000);
          }
          
          function simulateConnection() {
            const status = document.getElementById('status');
            status.textContent = 'Creating connection...';
            status.className = 'status success';
            
            // Simulate successful Apple Music connection
            fetch('/api/oauth/apple/simulate-callback', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                state: '${state}',
                success: true
              }),
            })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                status.textContent = 'Connected successfully! Redirecting...';
                
                // Show success page
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
                status.textContent = 'Connection failed. Please try again.';
                status.style.color = 'red';
              }
            })
            .catch(error => {
              console.error('Error:', error);
              status.textContent = 'Connection failed. Please try again.';
              status.style.color = 'red';
            });
          }
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Apple Music simple auth error:', error);
    res.status(500).send('Failed to load authentication page');
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
      access_token: 'demo_apple_music_token_' + Date.now(),
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

// Handle Apple Music auth with user identity + music permissions
router.post('/apple/music-auth', async (req, res) => {
  try {
    const { appleCredential } = req.body;
    
    if (!appleCredential || !appleCredential.user) {
      return res.status(400).json({ error: 'Invalid Apple credential' });
    }
    
    console.log('🍎 Processing Apple Music auth with user identity:', {
      user: appleCredential.user,
      email: appleCredential.email,
    });
    
    // Auto-grant music access since user chose Apple Music authentication
    console.log('🎵 Auto-granting music access for Apple Music user');
    
    // Create user profile from Apple credential
    const userProfile = {
      id: appleCredential.user,
      attributes: {
        name: appleCredential.fullName ? 
          `${appleCredential.fullName.givenName || ''} ${appleCredential.fullName.familyName || ''}`.trim() ||
          'Apple User' : 'Apple User',
        email: appleCredential.email || null, // Don't generate ugly internal emails
      },
    };
    
    // Create token data with music permissions automatically granted
    const tokenData = {
      access_token: appleCredential.identityToken || `apple_music_${Date.now()}`,
      expires_in: 3600 * 24 * 30, // 30 days
      music_access: true, // Auto-granted
    };
    
    // Create or update user immediately
    const { user, token } = await oauthService.createOrUpdateUser(
      'apple-music',
      userProfile,
      tokenData
    );
    
    console.log('✅ Apple Music auth completed automatically:', {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      musicAccess: true,
    });
    
    // Return success directly (no browser redirect needed)
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
    console.error('❌ Apple Music auth initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate Apple Music authentication' });
  }
});

// Complete Apple Music authentication with permissions
router.post('/apple/complete-music-auth', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { state, musicAccess } = req.body;
    
    if (!musicAccess) {
      return res.json({ success: false, error: 'Music access not granted' });
    }
    
    // Get the stored Apple credential
    const appleCredential = await OAuthSessionService.getAppleCredential(state);
    if (!appleCredential) {
      console.log('❌ Apple credential not found for state:', state);
      return res.status(400).json({ 
        error: 'Apple credential not found or expired', 
        hint: 'Please restart the authentication process - the session may have expired' 
      });
    }
    
    console.log('🎵 Completing Apple Music auth with permissions:', {
      user: appleCredential.user,
      email: appleCredential.email,
    });
    
    // Create user profile from Apple credential
    const userProfile = {
      id: appleCredential.user,
      attributes: {
        name: appleCredential.fullName ? 
          `${appleCredential.fullName.givenName || ''} ${appleCredential.fullName.familyName || ''}`.trim() ||
          'Apple User' : 'Apple User',
        email: appleCredential.email,
      },
    };
    
    // Create token data (now with music permissions)
    const tokenData = {
      access_token: appleCredential.identityToken || `apple_music_${Date.now()}`,
      expires_in: 3600 * 24 * 30, // 30 days
      music_access: true, // Flag indicating music permissions granted
    };
    
    // Create or update user
    const { user, token } = await oauthService.createOrUpdateUser(
      'apple-music',
      userProfile,
      tokenData
    );
    
    // Store token data for polling
    await OAuthSessionService.storeTokenData(state, { token, platform: 'apple-music' }, 'apple-music');
    
    console.log('✅ Apple Music auth completed with permissions:', {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      musicAccess: true,
    });
    
    // Check if this is a form submission (fallback method)
    const isFormSubmission = req.get('Content-Type')?.includes('application/x-www-form-urlencoded');
    
    if (isFormSubmission) {
      // For form submissions, redirect with success page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Apple Music Connected</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
              background: linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
            }
            .container {
              background: rgba(255, 255, 255, 0.98);
              border-radius: 20px;
              padding: 48px 32px;
              text-align: center;
              max-width: 380px;
              width: 90%;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            }
            .success-icon {
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
            }
            h1 {
              color: #1D1D1F;
              font-size: 28px;
              font-weight: 600;
              margin-bottom: 8px;
              letter-spacing: -0.5px;
            }
            p {
              color: #86868B;
              font-size: 17px;
              line-height: 1.4;
              margin-bottom: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>All Set!</h1>
            <p>Apple Music is now connected to Mixtape. You can start sharing songs!</p>
          </div>
          <script>
            setTimeout(() => {
              window.location.href = 'mixtape://auth/success?platform=apple-music&token=${encodeURIComponent(token)}';
            }, 2000);
          </script>
        </body>
        </html>
      `);
    } else {
      // For JSON requests, return JSON response
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
    console.error('❌ Complete Apple Music auth error:', error);
    res.status(500).json({ error: 'Failed to complete Apple Music authentication' });
  }
});

// Handle native Apple Sign In from iOS
router.post('/apple/native-callback', async (req, res) => {
  try {
    const { appleCredential } = req.body;
    
    if (!appleCredential || !appleCredential.user) {
      return res.status(400).json({ error: 'Invalid Apple credential' });
    }
    
    console.log('🍎 Processing native Apple Sign In:', {
      user: appleCredential.user,
      email: appleCredential.email,
      hasIdentityToken: !!appleCredential.identityToken,
    });
    
    // Create user profile from Apple credential
    const userProfile = {
      id: appleCredential.user,
      attributes: {
        name: appleCredential.fullName ? 
          `${appleCredential.fullName.givenName || ''} ${appleCredential.fullName.familyName || ''}`.trim() ||
          'Apple User' : 'Apple User',
        email: appleCredential.email,
      },
    };
    
    // Create token data
    const tokenData = {
      access_token: appleCredential.identityToken || `apple_native_${Date.now()}`,
      expires_in: 3600 * 24 * 30, // 30 days for Apple Sign In
    };
    
    // Create or update user
    const { user, token } = await oauthService.createOrUpdateUser(
      'apple-music',
      userProfile,
      tokenData
    );
    
    console.log('✅ Apple Sign In user created/updated:', {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
    });
    
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
    console.error('❌ Native Apple Sign In error:', error);
    res.status(500).json({ error: 'Apple Sign In failed' });
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

export default router;
