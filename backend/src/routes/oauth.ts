import express from 'express';
import crypto from 'crypto';
import { config } from '../config/env';
import { OAuthSessionService } from '../services/oauthSessionService';
import { oauthService } from '../services/oauthService';

const router = express.Router();

// Basic health check
router.get('/health', (req, res) => {
  res.json({ status: 'oauth router active' });
});

// Spotify OAuth routes
router.get('/spotify/login', async (req, res) => {
  try {
    console.log('🎵 Spotify login initiated');
    
    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    const tokenId = crypto.randomBytes(16).toString('hex');
    
    // Store state for verification
    await OAuthSessionService.storeState(state, 'spotify');
    
    // Build Spotify authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.spotify.clientId,
      scope: 'user-read-email user-read-private playlist-modify-public playlist-modify-private user-library-read user-library-modify',
      redirect_uri: config.spotify.redirectUri,
      state: state,
      show_dialog: 'true'
    });
    
    const authUrl = `https://accounts.spotify.com/authorize?${params}`;
    
    console.log('🔗 Spotify auth URL generated');
    res.json({
      success: true,
      authUrl,
      state,
      tokenId
    });
    
  } catch (error) {
    console.error('❌ Spotify login error:', error);
    res.status(500).json({ error: 'Failed to initiate Spotify login' });
  }
});

// Spotify OAuth callback
router.get('/spotify/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    console.log('🎵 Spotify callback received:', { code: !!code, state, error });
    
    if (error) {
      console.error('❌ Spotify OAuth error:', error);
      return res.redirect(`${config.frontendUrl}auth/error?error=${error}`);
    }
    
    if (!code || !state) {
      console.error('❌ Missing code or state parameter');
      return res.redirect(`${config.frontendUrl}auth/error?error=missing_parameters`);
    }
    
    // Verify state parameter
    const isValidState = await OAuthSessionService.verifyState(state as string, 'spotify');
    if (!isValidState) {
      console.error('❌ Invalid state parameter');
      return res.redirect(`${config.frontendUrl}auth/error?error=invalid_state`);
    }
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: config.spotify.redirectUri
      })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('❌ Spotify token exchange failed:', errorData);
      return res.redirect(`${config.frontendUrl}auth/error?error=token_exchange_failed`);
    }
    
    const tokenData: any = await tokenResponse.json();
    console.log('✅ Spotify tokens obtained');
    
    // Get user profile
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    if (!userResponse.ok) {
      console.error('❌ Failed to get Spotify user profile');
      return res.redirect(`${config.frontendUrl}auth/error?error=user_profile_failed`);
    }
    
    const userData: any = await userResponse.json();
    console.log('✅ Spotify user profile obtained:', userData.display_name);
    
    // Create or update user
    const { user, token } = await oauthService.createOrUpdateUser(
      'spotify',
      {
        id: userData.id,
        email: userData.email,
        display_name: userData.display_name || userData.id,
        images: userData.images || []
      } as any,
      tokenData
    );
    
    // Store token data for polling
    await OAuthSessionService.storeTokenData(state as string, { token, platform: 'spotify' }, 'spotify');
    
    // Success page
    const html = `<!DOCTYPE html>
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
      margin: 0;
    }
    .container {
      max-width: 400px;
      margin: 0 auto;
    }
    h1 { margin-bottom: 20px; }
    p { font-size: 18px; margin-bottom: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎵 Success!</h1>
    <p>Spotify connected successfully!</p>
    <p>You can now close this window and return to the app.</p>
  </div>
  
  <script>
    // Auto-redirect to app after 3 seconds
    setTimeout(() => {
      window.location.href = '${config.frontendUrl}auth/success?platform=spotify';
    }, 3000);
  </script>
</body>
</html>`;
    
    res.send(html);
    
  } catch (error) {
    console.error('❌ Spotify OAuth callback error:', error);
    res.redirect(`${config.frontendUrl}auth/error?error=authentication_failed`);
  }
});

// Check token status (for polling)
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
      res.json({ success: false });
    }
  } catch (error) {
    console.error('❌ Check token error:', error);
    res.json({ success: false });
  }
});

// Get user info
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const user = await oauthService.validateToken(token);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('❌ Get user info error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export default router;