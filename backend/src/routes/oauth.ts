import express from 'express';
import { query, body } from 'express-validator';
import { validateRequest } from '../utils/validation';
import { oauthService, MergeRequiredError } from '../services/oauthService';
import { OAuthSessionService } from '../services/oauthSessionService';
import { prisma } from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
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
        if (error instanceof MergeRequiredError) {
          // Store merge data and redirect to confirmation page
          await OAuthSessionService.storeMergeData(state, {
            ...error.mergeData,
            linkingSession
          });
          
          return res.json({
            success: false,
            requiresMerge: true,
            mergeUrl: `/api/oauth/account-merge?state=${state}`,
            message: 'Account merge required'
          });
        }
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
      
      // Link to existing user (may throw MergeRequiredError)
      try {
        await oauthService.linkMusicAccountToUser(
          linkingSession.userId,
          'spotify',
          userProfile,
          tokenData
        );
      } catch (error) {
        if (error instanceof MergeRequiredError) {
          // Store merge data and redirect to confirmation page
          await OAuthSessionService.storeMergeData(state as string, {
            ...error.mergeData,
            linkingSession
          });
          
          return res.redirect(`/api/oauth/account-merge?state=${state}`);
        }
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
      
      // Check if this is a linking session first
      console.log(`🔍 Checking for linking session with state: ${state}`);
      const linkingSession = await OAuthSessionService.getLinkingSession(state as string);
      console.log(`🔍 Linking session result:`, linkingSession);
      
      if (linkingSession && linkingSession.platform === 'spotify') {
        console.log('🔗 Detected linking session, processing account link...');
        return await handleSpotifyLinking(req, res, code as string, state as string, linkingSession);
      } else {
        console.log('🚫 No linking session found, proceeding with regular OAuth flow');
      }
      

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
    
    const mergeData = await OAuthSessionService.getMergeData(state as string);
    if (!mergeData) {
      return res.status(400).send('Invalid or expired merge session');
    }
    
    const { currentUser, existingUser, platform } = mergeData;
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <title>🔴 RED TEST PAGE - Account Found - Mixtape</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; 
      background: red !important;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    
    .container {
      background: white;
      border-radius: 16px; padding: 32px 24px; max-width: 375px; width: 100%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12); text-align: center;
      pointer-events: auto;
      z-index: 5;
    }
    
    .icon { 
      width: 64px; height: 64px; margin: 0 auto 16px; 
      background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
      border-radius: 16px; display: flex; align-items: center; justify-content: center;
      font-size: 28px; box-shadow: 0 4px 16px rgba(0, 122, 255, 0.25);
    }
    
    h1 { 
      color: #1D1D1F; font-size: 22px; font-weight: 600; margin-bottom: 6px; 
      letter-spacing: -0.3px;
    }
    
    .subtitle { 
      color: #8E8E93; font-size: 15px; line-height: 1.3; margin-bottom: 32px; 
      font-weight: 400;
    }
    
    .account-option {
      background: white; border-radius: 12px; 
      padding: 16px; margin-bottom: 12px; border: 1.5px solid rgba(0, 0, 0, 0.1); 
      cursor: pointer; transition: background-color 0.2s ease;
      text-align: left; position: relative;
      pointer-events: auto !important;
      touch-action: manipulation;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: rgba(0, 122, 255, 0.3);
      z-index: 10;
    }
    
    .account-option:active { transform: scale(0.98); }
    .account-option.selected { 
      border-color: #007AFF; background: rgba(0, 122, 255, 0.06);
      box-shadow: 0 2px 12px rgba(0, 122, 255, 0.15);
    }
    
    .account-header { display: flex; align-items: center; margin-bottom: 8px; }
    
    .platform-icon {
      width: 16px; height: 16px; border-radius: 50%; margin-right: 12px;
      flex-shrink: 0;
    }
    .spotify { 
      background: #1DB954; 
      box-shadow: 0 0 12px rgba(29, 185, 84, 0.6), 0 0 24px rgba(29, 185, 84, 0.3);
    }
    .apple { 
      background: #FF3B30; 
      box-shadow: 0 0 12px rgba(255, 59, 48, 0.6), 0 0 24px rgba(255, 59, 48, 0.3);
    }
    
    .account-details { flex: 1; }
    .account-name { 
      font-size: 16px; font-weight: 600; color: #1D1D1F; 
      margin-bottom: 2px; letter-spacing: -0.2px;
    }
    .account-platform { 
      font-size: 13px; color: #8E8E93; font-weight: 400;
    }
    
    .radio { 
      position: absolute; top: 16px; right: 16px; width: 20px; height: 20px;
      border: 2px solid #D1D1D6; border-radius: 50%; background: white;
      transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;
    }
    .account-option.selected .radio { 
      border-color: #007AFF; background: #007AFF;
    }
    .account-option.selected .radio::after {
      content: '✓'; color: white; font-size: 11px; font-weight: 700;
    }
    
    .buttons { margin-top: 32px; }
    .button {
      border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer;
      padding: 16px 24px; width: 100%; margin-bottom: 12px; font-family: inherit;
      transition: background-color 0.2s ease; letter-spacing: -0.2px;
      pointer-events: auto !important;
      touch-action: manipulation;
      -webkit-tap-highlight-color: rgba(0, 122, 255, 0.3);
      z-index: 10;
    }
    .primary { 
      background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); 
      color: white; box-shadow: 0 4px 16px rgba(0, 122, 255, 0.25);
    }
    .primary:active { transform: scale(0.98); }
    .primary:disabled { 
      background: #C7C7CC; cursor: not-allowed; transform: none;
      box-shadow: none; opacity: 0.6;
    }
    .secondary { 
      background: rgba(0, 122, 255, 0.08); color: #007AFF; 
      border: 1px solid rgba(0, 122, 255, 0.2);
    }
    .secondary:active { 
      background: rgba(0, 122, 255, 0.12); transform: scale(0.98);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">👥</div>
    <h1>🔴 RED TEST - Account Found</h1>
    <p class="subtitle">Choose which should be your primary account.</p>
    
    <div class="account-option" onclick="selectAccount('current')">
      <div class="account-header">
        <div class="platform-icon ${currentUser.musicAccounts?.[0]?.platform === 'spotify' ? 'spotify' : 'apple'}"></div>
        <div class="account-details">
          <div class="account-name">${currentUser.displayName || 'Current Account'}</div>
          <div class="account-platform">Connected: ${currentUser.musicAccounts?.map(acc => acc.platform === 'spotify' ? 'Spotify' : 'Apple Music').join(', ') || 'None'}</div>
        </div>
      </div>
      <div class="radio" id="radio-current"></div>
    </div>
    
    <div class="account-option" onclick="selectAccount('existing')">
      <div class="account-header">
        <div class="platform-icon ${platform === 'spotify' ? 'spotify' : 'apple'}"></div>
        <div class="account-details">
          <div class="account-name">${existingUser.displayName || 'Existing Account'}</div>
          <div class="account-platform">Connected: ${existingUser.musicAccounts?.map(acc => acc.platform === 'spotify' ? 'Spotify' : 'Apple Music').join(', ') || 'None'}</div>
        </div>
      </div>
      <div class="radio" id="radio-existing"></div>
    </div>
    
    <div class="buttons">
      <button class="button primary" id="merge-btn" onclick="confirmMerge()" disabled>
        Merge Accounts
      </button>
      <button class="button secondary" onclick="window.location.href='mixtape://auth/cancelled'">
        Cancel
      </button>
    </div>
  </div>
  
  <script>
    console.log('🔧 SCRIPT LOADING...');
    
    var selectedAccount = null;
    
    // TEST FUNCTION - Call this from console to test
    function testClick() {
      console.log('🧪 TEST FUNCTION CALLED');
      alert('JavaScript is working!');
    }
    
    function selectAccount(account) {
      console.log('🎯 selectAccount() called with:', account);
      console.log('🔍 typeof account:', typeof account);
      console.log('🔍 account value:', account);
      
      try {
        selectedAccount = account;
        console.log('✅ selectedAccount set to:', selectedAccount);
        
        // Clear all radio buttons
        console.log('🔄 Clearing all radio buttons...');
        var radios = document.querySelectorAll('.radio');
        console.log('📍 Found', radios.length, 'radio buttons');
        
        for (var i = 0; i < radios.length; i++) {
          radios[i].style.backgroundColor = 'white';
          radios[i].style.borderColor = '#D1D1D6';
          radios[i].innerHTML = '';
          console.log('🔘 Cleared radio', i);
        }
        
        // Select the clicked account
        var radioId = account === 'current' ? 'radio-current' : 'radio-existing';
        console.log('🎯 Looking for radio with ID:', radioId);
        
        var radio = document.getElementById(radioId);
        if (radio) {
          console.log('✅ Found radio element, styling it...');
          radio.style.backgroundColor = '#007AFF';
          radio.style.borderColor = '#007AFF';
          radio.innerHTML = '✓';
          radio.style.color = 'white';
          radio.style.fontSize = '11px';
          radio.style.fontWeight = '700';
          radio.style.display = 'flex';
          radio.style.alignItems = 'center';
          radio.style.justifyContent = 'center';
          console.log('✅ Radio styled successfully');
        } else {
          console.log('❌ Radio element not found with ID:', radioId);
        }
        
        // Enable merge button
        console.log('🔄 Enabling merge button...');
        var mergeBtn = document.getElementById('merge-btn');
        if (mergeBtn) {
          mergeBtn.disabled = false;
          mergeBtn.style.opacity = '1';
          mergeBtn.style.backgroundColor = '#007AFF';
          console.log('✅ Merge button enabled');
        } else {
          console.log('❌ Merge button not found');
        }
        
        console.log('🎉 selectAccount() completed successfully');
        
      } catch (error) {
        console.error('💥 ERROR in selectAccount():', error);
        alert('Error in selectAccount: ' + error.message);
      }
    }
    
    function confirmMerge() {
      console.log('🚀 confirmMerge() called');
      console.log('🔍 selectedAccount:', selectedAccount);
      
      try {
        if (!selectedAccount) {
          console.log('❌ No account selected');
          alert('Please select an account first');
          return;
        }
        
        var url = '/api/oauth/confirm-merge?state=${state}&primaryAccount=' + selectedAccount;
        console.log('🌐 Navigating to:', url);
        window.location.href = url;
        
      } catch (error) {
        console.error('💥 ERROR in confirmMerge():', error);
        alert('Error in confirmMerge: ' + error.message);
      }
    }
    
    function cancelMerge() {
      console.log('❌ cancelMerge() called');
      try {
        window.location.href = 'mixtape://auth/cancelled';
      } catch (error) {
        console.error('💥 ERROR in cancelMerge():', error);
        alert('Error in cancelMerge: ' + error.message);
      }
    }
    
    // Make functions global
    window.selectAccount = selectAccount;
    window.confirmMerge = confirmMerge;
    window.cancelMerge = cancelMerge;
    window.testClick = testClick;
    
    console.log('✅ All functions defined and made global');
    
    // Add backup event listeners after a delay
    setTimeout(function() {
      console.log('🔧 Setting up backup event listeners...');
      
      try {
        var account1 = document.querySelector('.account-option:first-of-type');
        var account2 = document.querySelector('.account-option:last-of-type');
        var mergeBtn = document.getElementById('merge-btn');
        var cancelBtn = document.querySelector('.button.secondary');
        
        if (account1) {
          account1.addEventListener('click', function() {
            console.log('🖱️ BACKUP: First account clicked');
            selectAccount('current');
          });
          console.log('✅ Backup listener added to first account');
        }
        
        if (account2) {
          account2.addEventListener('click', function() {
            console.log('🖱️ BACKUP: Second account clicked');
            selectAccount('existing');
          });
          console.log('✅ Backup listener added to second account');
        }
        
        if (mergeBtn) {
          mergeBtn.addEventListener('click', function() {
            console.log('🖱️ BACKUP: Merge button clicked');
            confirmMerge();
          });
          console.log('✅ Backup listener added to merge button');
        }
        
        if (cancelBtn) {
          cancelBtn.addEventListener('click', function() {
            console.log('🖱️ BACKUP: Cancel button clicked');
            cancelMerge();
          });
          console.log('✅ Backup listener added to cancel button');
        }
        
        // Add universal click handler for debugging
        document.addEventListener('click', function(e) {
          console.log('🖱️ UNIVERSAL CLICK on:', e.target.tagName, e.target.className, e.target.id);
          console.log('🖱️ onclick attribute:', e.target.getAttribute('onclick'));
        });
        
        console.log('🎯 All backup listeners ready');
        
      } catch (error) {
        console.error('💥 ERROR setting up backup listeners:', error);
      }
    }, 500);
    
    console.log('🎉 SCRIPT LOADED SUCCESSFULLY');
    
    // Make functions global for debugging
    window.selectAccount = function selectAccount(account) {
      console.log('🎯 CLICK DETECTED! Selecting account:', account);
      selectedAccount = account;
      
      // Clear all selections
      document.querySelectorAll('.account-option').forEach(el => {
        el.classList.remove('selected');
      });
      
      // Select the chosen account
      const selectedEl = document.getElementById(account + '-account');
      if (selectedEl) {
        selectedEl.classList.add('selected');
        console.log('✅ Account selected');
      }
      
      // Enable merge button
      const mergeBtn = document.getElementById('merge-btn');
      if (mergeBtn) {
        mergeBtn.disabled = false;
        mergeBtn.style.cursor = 'pointer';
        console.log('✅ Merge button ENABLED');
      }
      
      console.log('🎯 Account selection COMPLETE:', account);
    }
    
    window.confirmMerge = async function confirmMerge() {
      console.log('🚀 Confirm merge clicked! Selected account:', selectedAccount);
      if (!selectedAccount) {
        console.log('❌ No account selected, aborting');
        return;
      }
      
      const btn = document.getElementById('merge-btn');
      btn.disabled = true;
      btn.textContent = 'Merging...';
      console.log('🔄 Starting merge process...');
      
      try {
        const response = await fetch('/api/oauth/confirm-merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: '${state}', primaryAccount: selectedAccount })
        });
        
        const result = await response.json();
        if (result.success) {
          document.body.innerHTML = \`
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center;">
              <div style="background: white; border-radius: 20px; padding: 40px; text-align: center; max-width: 350px;">
                <div style="width: 60px; height: 60px; background: #30D158; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: white; font-size: 24px;">✓</div>
                <h1 style="margin-bottom: 10px;">Accounts Merged!</h1>
                <p style="color: #86868B;">Your accounts have been successfully merged.</p>
              </div>
            </div>
          \`;
          setTimeout(() => window.location.href = 'mixtape://auth/success?platform=${platform}&merged=true', 2000);
        } else {
          throw new Error(result.error || 'Merge failed');
        }
      } catch (error) {
        btn.disabled = false;
        btn.textContent = 'Merge Accounts';
        alert('Failed to merge accounts. Please try again.');
      }
    }
    
    function cancel() {
      window.location.href = 'mixtape://auth/cancelled';
    }
  </script>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    console.error('Account merge page error:', error);
    res.status(500).send('Failed to load merge page');
  }
});

// Merge confirmation page
router.get('/merge-confirmation', async (req, res) => {
  try {
    const { state } = req.query;
    
    if (!state) {
      return res.status(400).send('Missing state parameter');
    }
    
    const mergeData = await OAuthSessionService.getMergeData(state as string);
    if (!mergeData) {
      return res.status(400).send('Invalid or expired merge session');
    }
    
    const { currentUser, existingUser, platform } = mergeData;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
        <title>Merge Accounts - Mixtape</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; 
            background: red !important;
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
            padding: 20px;
          }
          .container {
            background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(20px);
            border-radius: 20px; padding: 32px 28px; max-width: 420px; width: 100%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12); text-align: center;
          }
          .icon { font-size: 48px; margin-bottom: 16px; }
          h1 { color: #1D1D1F; font-size: 24px; font-weight: 600; margin-bottom: 8px; }
          .subtitle { color: #86868B; font-size: 15px; line-height: 1.4; margin-bottom: 28px; }
          
          .account-option {
            background: rgba(255, 255, 255, 0.8); border-radius: 20px; padding: 24px; margin-bottom: 20px;
            border: 2px solid rgba(0, 0, 0, 0.06); cursor: pointer; transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
            text-align: left; position: relative; backdrop-filter: blur(10px);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
          }
          .account-option:hover { 
            background: rgba(255, 255, 255, 0.95); 
            border-color: rgba(0, 122, 255, 0.3);
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          }
          .account-option.selected { 
            border-color: #007AFF; 
            background: rgba(0, 122, 255, 0.08);
            box-shadow: 0 8px 30px rgba(0, 122, 255, 0.2);
          }
          
          .account-header { display: flex; align-items: center; margin-bottom: 12px; }
          .platform-icon {
            width: 48px; height: 48px; border-radius: 14px; margin-right: 16px;
            display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;
            font-size: 18px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          }
          .spotify { background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%); }
          .apple { background: linear-gradient(135deg, #FC3C44 0%, #ff5722 100%); }
          
          .account-name { font-size: 18px; font-weight: 600; color: #1D1D1F; }
          .account-details { font-size: 14px; color: #86868B; line-height: 1.3; }
          
          .radio { 
            position: absolute; top: 24px; right: 24px; width: 24px; height: 24px;
            border: 2px solid #D1D1D6; border-radius: 50%; background: white;
            transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          .account-option:hover .radio { border-color: #007AFF; }
          .account-option.selected .radio { 
            border-color: #007AFF; background: #007AFF;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E");
            background-size: 14px; background-position: center; background-repeat: no-repeat;
            transform: scale(1.1); box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
          }
          
          .buttons { margin-top: 40px; }
          .button {
            border: none; border-radius: 16px; font-size: 17px; font-weight: 600; cursor: pointer;
            padding: 18px 24px; width: 100%; margin-bottom: 16px; font-family: inherit;
            transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
            position: relative; overflow: hidden;
          }
          .primary { 
            background: linear-gradient(135deg, #007AFF 0%, #0051D6 100%); 
            color: white; box-shadow: 0 4px 20px rgba(0, 122, 255, 0.3);
          }
          .primary:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 8px 30px rgba(0, 122, 255, 0.4);
          }
          .primary:disabled { 
            background: #C7C7CC; 
            cursor: not-allowed; 
            transform: none;
            box-shadow: none;
          }
          .secondary { 
            background: rgba(0, 122, 255, 0.1); 
            color: #007AFF; 
            border: 1px solid rgba(0, 122, 255, 0.2);
          }
          .secondary:hover { 
            background: rgba(0, 122, 255, 0.15); 
            transform: translateY(-1px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">👤</div>
          <h1>Account Found</h1>
          <p class="subtitle">We found an existing account linked to your ${platform === 'spotify' ? 'Spotify' : 'Apple Music'}. Choose which should be your primary account.</p>
          
          <div class="account-option" id="current-account">
            <div class="account-header">
              <div class="platform-icon ${currentUser.musicAccounts?.[0]?.platform === 'spotify' ? 'spotify' : 'apple'}">
                ${currentUser.musicAccounts?.[0]?.platform === 'spotify' ? '♪' : '🎵'}
              </div>
              <div>
                <div class="account-name">${currentUser.displayName || 'Current Account'}</div>
                <div class="account-details">${currentUser.email}</div>
              </div>
            </div>
            <div class="account-details">
              Connected: ${currentUser.musicAccounts?.map(acc => acc.platform === 'spotify' ? 'Spotify' : 'Apple Music').join(', ') || 'No platforms'}
            </div>
            <div class="radio"></div>
          </div>
          
          <div class="account-option" id="existing-account">
            <div class="account-header">
              <div class="platform-icon ${platform === 'spotify' ? 'spotify' : 'apple'}">
                ${platform === 'spotify' ? '♪' : '🎵'}
              </div>
              <div>
                <div class="account-name">${existingUser.displayName || 'Existing Account'}</div>
                <div class="account-details">${existingUser.email}</div>
              </div>
            </div>
            <div class="account-details">
              Connected: ${existingUser.musicAccounts?.map(acc => acc.platform === 'spotify' ? 'Spotify' : 'Apple Music').join(', ') || 'No platforms'}
            </div>
            <div class="radio"></div>
          </div>
          
          <div class="buttons">
            <button class="button primary" id="merge-btn" onclick="confirmMerge()" disabled>
              Merge Accounts
            </button>
            <button class="button secondary" onclick="cancelMerge()">
              Cancel
            </button>
          </div>
        </div>
        
        <script>
          let selectedAccount = null;
          
          function selectAccount(account) {
            console.log('🔘 Selecting account:', account);
            selectedAccount = account;
            
            // Clear all selections with explicit styling
            document.querySelectorAll('.account-option').forEach(el => {
              el.classList.remove('selected');
              el.style.backgroundColor = '#f8f9fa';
              el.style.borderColor = '#e5e7eb';
              el.style.transform = 'scale(1)';
              el.style.color = '#1D1D1F';
            });
            
            // Select the chosen account with BOLD blue styling
            const selectedEl = document.getElementById(account + '-account');
            selectedEl.classList.add('selected');
            selectedEl.style.backgroundColor = '#007AFF';
            selectedEl.style.borderColor = '#007AFF';
            selectedEl.style.color = 'white';
            selectedEl.style.transform = 'scale(1.02)';
            
            // Make all text white when selected
            const nameEl = selectedEl.querySelector('.account-name');
            const detailsEls = selectedEl.querySelectorAll('.account-details');
            if (nameEl) nameEl.style.color = 'white';
            detailsEls.forEach(el => el.style.color = '#E3F2FD');
            
            // Enable merge button with visual feedback
            const mergeBtn = document.getElementById('merge-btn');
            mergeBtn.disabled = false;
            mergeBtn.style.opacity = '1';
            mergeBtn.style.backgroundColor = '#10b981';
            
            console.log('✅ Account selected with bold blue styling');
          }
          
          // Simple click handlers
          document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('current-account').onclick = function() { selectAccount('current'); };
            document.getElementById('existing-account').onclick = function() { selectAccount('existing'); };
          });
          
          async function confirmMerge() {
            if (!selectedAccount) return;
            
            const btn = document.getElementById('merge-btn');
            btn.disabled = true;
            btn.textContent = 'Merging...';
            
            try {
              const response = await fetch('/api/oauth/confirm-merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  state: '${state}',
                  primaryAccount: selectedAccount
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                // Show success and redirect
                document.body.innerHTML = \`
                  <div style="
                    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh; display: flex; align-items: center; justify-content: center;
                  ">
                    <div style="
                      background: rgba(255, 255, 255, 0.98); border-radius: 24px; padding: 48px 32px;
                      text-align: center; max-width: 400px; width: 90%;
                      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
                    ">
                      <div style="
                        width: 72px; height: 72px; background: #30D158; border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        margin: 0 auto 20px; color: white; font-size: 32px; font-weight: bold;
                      ">✓</div>
                      <h1 style="color: #1D1D1F; font-size: 28px; font-weight: 600; margin-bottom: 8px;">
                        Accounts Merged!
                      </h1>
                      <p style="color: #86868B; font-size: 17px; line-height: 1.4;">
                        Your accounts have been successfully merged. All your groups and songs are now in one place.
                      </p>
                    </div>
                  </div>
                \`;
                
                setTimeout(() => {
                  window.location.href = 'mixtape://auth/success?platform=${platform}&merged=true';
                }, 2000);
              } else {
                throw new Error(result.error || 'Merge failed');
              }
            } catch (error) {
              btn.disabled = false;
              btn.textContent = 'Merge Accounts';
              alert('Failed to merge accounts. Please try again.');
            }
          }
          
          window.cancelMerge = function cancelMerge() {
            console.log('❌ Cancel merge called');
            window.location.href = 'mixtape://auth/cancelled';
          }
        </script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Merge confirmation page error:', error);
    res.status(500).send('Failed to load merge confirmation page');
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
    
    // Perform the merge
    await oauthService.performChosenMerge(primaryUserId, secondaryUserId, platform, tokenData);
    
    // Store success data for polling
    await OAuthSessionService.storeTokenData(state, { 
      success: true, 
      platform,
      message: 'Accounts merged successfully'
    }, platform);
    
    // Clean up merge data
    await OAuthSessionService.deleteLinkingSession(state);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Merge confirmation error:', error);
    res.status(500).json({ error: 'Failed to merge accounts' });
  }
});

// Handle Spotify linking callback
async function handleSpotifyLinking(req: any, res: any, code: string, state: string, linkingSession: any) {
  try {
    console.log(`🔗 handleSpotifyLinking called with userId: ${linkingSession.userId}`);
    
    // Exchange code for tokens
    console.log(`🔄 Exchanging Spotify code for tokens...`);
    const tokenData = await oauthService.exchangeSpotifyCodeWithUri(code, process.env.SPOTIFY_REDIRECT_URI!);
    console.log(`✅ Spotify token exchange successful`);
    
    // Get user profile
    console.log(`🔄 Fetching Spotify user profile...`);
    const userProfile = await oauthService.getSpotifyUserProfile(tokenData.access_token);
    console.log(`✅ Spotify profile fetched for email: ${userProfile.email}`);
    
    // Link to existing user instead of creating new one
    try {
      console.log(`🔄 Attempting to link Spotify account to user ${linkingSession.userId}...`);
      await oauthService.linkMusicAccountToUser(
        linkingSession.userId,
        'spotify',
        userProfile,
        tokenData
      );
      console.log(`✅ Spotify account linked successfully!`);
    } catch (error) {
      if (error instanceof MergeRequiredError) {
        console.log(`⚠️ Merge required, redirecting to confirmation page...`);
        // Store merge data and redirect to confirmation page
        await OAuthSessionService.storeMergeData(state, {
          ...error.mergeData,
          linkingSession
        });
        
        return res.redirect(`/api/oauth/account-merge?state=${state}`);
      }
      console.error(`❌ Error linking Spotify account:`, error);
      throw error;
    }

    // Clean up linking session
    console.log(`🧹 Cleaning up linking session...`);
    await OAuthSessionService.deleteLinkingSession(state);

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
          <p id="status">Your Spotify account has been successfully linked to Mixtape.</p>
          <p id="redirect-status" style="margin-top: 16px; font-size: 15px;">Returning to app...</p>
          <a href="mixtape://auth/success?platform=spotify&linked=true" id="manual-return" style="
            display: none;
            background: #007AFF;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            margin-top: 20px;
            display: inline-block;
          ">Return to App</a>
        </div>
        <script>
          function redirectToApp() {
            console.log('🔄 Attempting to redirect to app...');
            console.log('🔗 Deep link: mixtape://auth/success?platform=spotify&linked=true');
            window.location.href = 'mixtape://auth/success?platform=spotify&linked=true';
          }
          
          // Immediate redirect attempt
          redirectToApp();
          
          // Try again after a short delay
          setTimeout(redirectToApp, 500);
          setTimeout(redirectToApp, 1500);
          
          // Show manual button if automatic redirect fails
          setTimeout(() => {
            document.getElementById('redirect-status').textContent = 'If the app doesn\\'t open automatically, tap below:';
            document.getElementById('manual-return').style.display = 'inline-block';
          }, 3000);
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

// Test endpoint to verify deployment  
router.get('/test-deployment', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Railway Test - V2.2</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px;">
      <h1>🚂 Railway Test V2.2</h1>
      <p><strong>Timestamp: ${new Date().toISOString()}</strong></p>
      <p><strong>Version: 2.2-MERGE-FIXED</strong></p>
      <p>If you see V2.2 above, Railway IS working!</p>
      <div style="background: #f0f9ff; padding: 20px; border-radius: 12px; margin: 20px 0;">
        <h3>🔍 Diagnosis:</h3>
        <p>Railway deployment: <span style="color: green; font-weight: bold;">WORKING ✅</span></p>
        <p>Our merge redirect: Let's test below...</p>
      </div>
      <a href="/api/oauth/account-merge?state=test123" style="
        background: #10b981;
        color: white;
        padding: 16px 32px;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        margin: 10px;
        display: inline-block;
      ">Test New Merge Page</a>
      <br>
      <a href="/api/oauth/merge-confirmation?state=test123" style="
        background: #ef4444;
        color: white;
        padding: 16px 32px;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        margin: 10px;
        display: inline-block;
      ">Test Old Merge Page</a>
    </body>
    </html>
  `);
});

// Debug endpoint to check OAuth sessions
router.get('/debug-sessions', async (req, res) => {
  try {
    const { state } = req.query;
    if (!state) {
      return res.status(400).json({ error: 'State parameter required' });
    }
    
    // Check regular session
    const sessionState = await OAuthSessionService.getSessionState(state as string);
    
    // Check linking session
    const linkingSession = await OAuthSessionService.getLinkingSession(state as string);
    
    // Check merge data
    const mergeData = await OAuthSessionService.getMergeData(state as string);
    
    res.json({
      state,
      sessionState,
      linkingSession,
      mergeData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simulate OAuth callback to test the flow
router.get('/simulate-callback', async (req, res) => {
  try {
    const { state } = req.query;
    if (!state) {
      return res.status(400).json({ error: 'State parameter required' });
    }
    
    console.log(`🧪 Simulating OAuth callback for state: ${state}`);
    
    // Check if this is a linking session
    const linkingSession = await OAuthSessionService.getLinkingSession(state as string);
    console.log(`🔍 Linking session found:`, linkingSession);
    
    if (linkingSession && linkingSession.platform === 'spotify') {
      // Simulate successful linking
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Simulated Success</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 40px;">
          <h1>🧪 Simulation: Spotify Linked!</h1>
          <p>This simulates what should happen after OAuth success.</p>
          <p>State: ${state}</p>
          <p>User ID: ${linkingSession.userId}</p>
          <a href="mixtape://auth/success?platform=spotify&linked=true" style="
            background: #007AFF;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px;
            display: inline-block;
          ">Test Deep Link</a>
          <script>
            console.log('🔄 Testing automatic redirect...');
            setTimeout(() => {
              console.log('🔗 Redirecting to: mixtape://auth/success?platform=spotify&linked=true');
              window.location.href = 'mixtape://auth/success?platform=spotify&linked=true';
            }, 2000);
          </script>
        </body>
        </html>
      `);
    } else {
      res.json({ 
        error: 'No linking session found',
        state,
        linkingSession,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;