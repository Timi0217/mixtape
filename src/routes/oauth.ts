import express from 'express';
import { query, body } from 'express-validator';
import { validateRequest } from '../utils/validation';
import { oauthService } from '../services/oauthService';
import { prisma } from '../config/database';

const router = express.Router();

// Store OAuth states temporarily (in production, use Redis)
const oauthStates = new Map<string, { platform: string; timestamp: number }>();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > 600000) { // 10 minutes
      oauthStates.delete(state);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired OAuth states. Remaining: ${oauthStates.size}`);
  }
}, 600000);

// Start Spotify OAuth flow
router.get('/spotify/login', async (req, res) => {
  try {
    console.log('🚀 === SPOTIFY OAUTH LOGIN DEBUG ===');
    console.log('Request details:');
    console.log('  - URL:', req.url);
    console.log('  - Method:', req.method);
    console.log('  - IP:', req.ip);
    console.log('  - User-Agent:', req.get('User-Agent'));
    
    console.log('Environment variables:');
    console.log('  - SPOTIFY_CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID);
    console.log('  - SPOTIFY_CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET ? '[SET]' : '[MISSING]');
    console.log('  - SPOTIFY_REDIRECT_URI:', process.env.SPOTIFY_REDIRECT_URI);
    console.log('  - FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('  - NODE_ENV:', process.env.NODE_ENV);
    
    console.log('🎲 Generating OAuth state...');
    const state = oauthService.generateState();
    console.log('Generated state:', state);
    
    console.log('💾 Storing state in memory...');
    const stateData = { platform: 'spotify', timestamp: Date.now() };
    oauthStates.set(state, stateData);
    console.log('Stored state data:', stateData);
    console.log('Total states in memory:', oauthStates.size);
    
    console.log('🔗 Generating Spotify auth URL...');
    const authUrl = oauthService.getSpotifyAuthUrl(state);
    console.log('Generated auth URL:', authUrl);
    console.log('Auth URL length:', authUrl.length);
    
    // Manually construct URL for comparison
    const manualUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.SPOTIFY_CLIENT_ID}&scope=user-read-email%20user-read-private%20playlist-read-private%20playlist-read-collaborative%20playlist-modify-public%20playlist-modify-private&redirect_uri=${encodeURIComponent(process.env.SPOTIFY_REDIRECT_URI!)}&state=${state}`;
    console.log('Manual auth URL (for comparison):', manualUrl);
    console.log('URLs match:', authUrl === manualUrl);
    
    const response = {
      authUrl,
      state,
    };
    
    console.log('📤 Sending response:', JSON.stringify(response, null, 2));
    res.json(response);
    console.log('✅ Response sent successfully');
    console.log('🚀 === END SPOTIFY OAUTH LOGIN DEBUG ===\n');
    
  } catch (error) {
    console.log('💥 === OAUTH LOGIN ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    console.error('Stack trace:', error.stack);
    
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

      console.log('Exchanging code:', code);
      console.log('With redirect URI:', redirectUri);

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
      console.log('=== WEBHOOK CALLBACK RECEIVED ===');
      console.log('Query params:', req.query);
      console.log('Body:', req.body);
      
      const { code, state, error } = req.query;
      
      if (error) {
        console.error('OAuth error:', error);
        return res.json({ error: error });
      }
      
      if (code && state) {
        // Process the callback
        console.log('Processing OAuth callback...');
        
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
          
          console.log('✅ OAuth successful! Token:', token);
          
          // Return success
          res.json({ 
            success: true, 
            token,
            user: userProfile,
            message: 'Login successful! Copy this token to complete login.'
          });
          
        } catch (exchangeError) {
          console.error('Token exchange failed:', exchangeError);
          res.json({ error: 'Token exchange failed', details: exchangeError.message });
        }
      } else {
        res.json({ error: 'Missing code or state parameter' });
      }
      
    } catch (error) {
      console.error('Webhook error:', error);
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
      console.log('=== WEB CALLBACK RECEIVED ===');
      console.log('Full URL:', req.url);
      console.log('Query params:', req.query);
      
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
      const storedState = oauthStates.get(state as string);
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
      oauthStates.delete(state as string);

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

      // Direct redirect to app with deep link
      const deepLinkUrl = `${process.env.FRONTEND_URL}auth/success?token=${token}&platform=spotify`;
      
      console.log('Redirecting to app:', deepLinkUrl);
      res.redirect(deepLinkUrl);
      
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
      console.log('=== LOCALHOST CALLBACK RECEIVED ===');
      console.log('Full URL:', req.url);
      console.log('Query params:', req.query);
      
      const { code, state, error } = req.query;

      // Check for OAuth error
      if (error) {
        return res.redirect(`${process.env.FRONTEND_URL}auth/error?error=${error}`);
      }

      // Validate state parameter
      const storedState = oauthStates.get(state as string);
      if (!storedState || storedState.platform !== 'spotify') {
        return res.redirect(`${process.env.FRONTEND_URL}auth/error?error=invalid_state`);
      }

      // Clean up used state
      oauthStates.delete(state as string);

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
    console.log('🎵 === SPOTIFY OAUTH CALLBACK DEBUG ===');
    console.log('Full URL:', req.url);
    console.log('Query params:', JSON.stringify(req.query, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Method:', req.method);
    console.log('IP:', req.ip);
    console.log('User-Agent:', req.get('User-Agent'));
    
    try {
      const { code, state, error } = req.query;
      
      console.log('🔍 Extracted params:');
      console.log('  - code:', code ? `${String(code).substring(0, 20)}...` : 'MISSING');
      console.log('  - state:', state || 'MISSING');
      console.log('  - error:', error || 'None');

      // Check for OAuth error
      if (error) {
        console.log('❌ OAuth error received:', error);
        const errorUrl = `${process.env.FRONTEND_URL}auth/error?error=${error}`;
        console.log('🔄 Redirecting to error URL:', errorUrl);
        return res.redirect(errorUrl);
      }
      
      // Check if code is missing
      if (!code) {
        console.log('❌ Missing authorization code');
        const errorUrl = `${process.env.FRONTEND_URL}auth/error?error=missing_code`;
        console.log('🔄 Redirecting to error URL:', errorUrl);
        return res.redirect(errorUrl);
      }
      
      // Check if state is missing
      if (!state) {
        console.log('❌ Missing state parameter');
        const errorUrl = `${process.env.FRONTEND_URL}auth/error?error=missing_state`;
        console.log('🔄 Redirecting to error URL:', errorUrl);
        return res.redirect(errorUrl);
      }

      // Validate state parameter
      console.log('🔐 Validating state parameter...');
      console.log('Available states in memory:', Array.from(oauthStates.keys()));
      const storedState = oauthStates.get(state as string);
      console.log('Stored state data:', storedState);
      
      if (!storedState || storedState.platform !== 'spotify') {
        console.log('❌ Invalid state parameter');
        const errorUrl = `${process.env.FRONTEND_URL}auth/error?error=invalid_state`;
        console.log('🔄 Redirecting to error URL:', errorUrl);
        return res.redirect(errorUrl);
      }
      
      console.log('✅ State validation passed');

      // Clean up used state
      oauthStates.delete(state as string);
      console.log('🧹 Cleaned up state from memory');

      // Exchange code for tokens
      console.log('🔄 Exchanging authorization code for tokens...');
      const tokenData = await oauthService.exchangeSpotifyCode(code as string);
      console.log('✅ Token exchange successful');
      console.log('Token data keys:', Object.keys(tokenData));
      
      // Get user profile
      console.log('👤 Fetching user profile...');
      const userProfile = await oauthService.getSpotifyUserProfile(tokenData.access_token);
      console.log('✅ User profile fetched');
      console.log('User profile keys:', Object.keys(userProfile));
      console.log('User display name:', userProfile.display_name);
      
      // Create or update user
      console.log('💾 Creating/updating user in database...');
      const { user, token } = await oauthService.createOrUpdateUser(
        'spotify',
        userProfile,
        tokenData
      );
      console.log('✅ User created/updated successfully');
      console.log('Generated JWT token length:', token.length);
      console.log('User ID:', user.id);

      // Generate deep link
      console.log('🔗 Generating deep link...');
      console.log('FRONTEND_URL env var:', process.env.FRONTEND_URL);
      const deepLinkUrl = `${process.env.FRONTEND_URL}auth/success?token=${token}&platform=spotify`;
      console.log('Generated deep link URL:', deepLinkUrl);
      console.log('Deep link URL length:', deepLinkUrl.length);
      
      console.log('🚀 Attempting redirect to app...');
      res.redirect(deepLinkUrl);
      console.log('✅ Redirect response sent');
      
    } catch (error) {
      console.log('💥 === OAUTH CALLBACK ERROR ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      console.error('Stack trace:', error.stack);
      
      const errorUrl = `${process.env.FRONTEND_URL}auth/error?error=authentication_failed`;
      console.log('🔄 Redirecting to error URL:', errorUrl);
      res.redirect(errorUrl);
    }
    
    console.log('🎵 === END SPOTIFY OAUTH CALLBACK DEBUG ===\n');
  }
);

// Start Apple Music OAuth flow
router.get('/apple/login', async (req, res) => {
  try {
    const state = oauthService.generateState();
    oauthStates.set(state, { platform: 'apple-music', timestamp: Date.now() });
    
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.API_BASE_URL || 'https://api.yourdomain.com'
      : `http://localhost:3000`;
      
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
    
    if (!state || !oauthStates.has(state as string)) {
      return res.status(400).send('Invalid or expired state parameter');
    }
    
    // Get Apple Music developer token
    const { appleMusicService } = await import('../services/appleMusicService');
    const developerToken = await appleMusicService.getDeveloperToken();
    
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
                const response = await fetch('/api/oauth/apple/callback', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    musicUserToken: userToken,
                    state: '${state}',
                    userInfo: {
                      id: 'apple_user_' + Date.now(),
                      name: 'Apple Music User'
                    }
                  }),
                });
                
                const data = await response.json();
                
                if (data.success) {
                  // Redirect back to the app
                  window.location.href = 'mixtape://auth/success?token=' + data.token + '&platform=apple-music';
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
    res.status(500).send('Failed to load authentication page');
  }
});

// Handle Apple Music OAuth callback
router.post('/apple/callback',
  async (req, res) => {
    try {
      const { musicUserToken, state, userInfo } = req.body;

      // Validate state parameter
      const storedState = oauthStates.get(state);
      if (!storedState || storedState.platform !== 'apple-music') {
        return res.status(400).json({ error: 'Invalid state parameter' });
      }

      // Clean up used state
      oauthStates.delete(state);

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