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
    
    // Generate state for CSRF protection (use as both state and tokenId)
    const state = crypto.randomBytes(16).toString('hex');
    
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
      tokenId: state  // Use state as tokenId for polling consistency
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
  <title>Login Success - Mixtape</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%);
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="40" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="40" cy="80" r="1.5" fill="rgba(255,255,255,0.1)"/><circle cx="90" cy="80" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="10" cy="60" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="60" cy="10" r="1" fill="rgba(255,255,255,0.1)"/></svg>') repeat;
      animation: float 20s linear infinite;
      pointer-events: none;
    }
    
    @keyframes float {
      0% { transform: translateY(0px); }
      100% { transform: translateY(-100px); }
    }
    
    .container {
      max-width: 400px;
      padding: 40px 20px;
      position: relative;
      z-index: 1;
    }
    
    .success-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
      display: block;
      animation: bounce 1s ease-out;
    }
    
    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-10px); }
      60% { transform: translateY(-5px); }
    }
    
    h1 { 
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1rem;
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    .subtitle {
      font-size: 1.1rem;
      margin-bottom: 2rem;
      opacity: 0.9;
      font-weight: 500;
    }
    
    .status {
      background: rgba(255,255,255,0.15);
      border-radius: 12px;
      padding: 1rem;
      margin: 1.5rem 0;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
    }
    
    .loader {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s ease-in-out infinite;
      margin-right: 0.5rem;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .close-btn {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 1rem;
      backdrop-filter: blur(10px);
    }
    
    .close-btn:hover {
      background: rgba(255,255,255,0.3);
      transform: translateY(-1px);
    }
    
    .countdown {
      font-size: 0.9rem;
      opacity: 0.8;
      margin-top: 1rem;
    }
    
    @media (max-width: 480px) {
      .container { padding: 20px; }
      h1 { font-size: 1.5rem; }
      .subtitle { font-size: 1rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <span class="success-icon">🎉</span>
    <h1>Connected Successfully!</h1>
    <p class="subtitle">Your Spotify account is now linked to Mixtape</p>
    
    <div class="status">
      <div class="loader"></div>
      <span id="status-text">Returning to app...</span>
    </div>
    
    <button class="close-btn" onclick="closeWindow()">
      Close Window
    </button>
    
    <p class="countdown">
      Redirecting in <span id="countdown">2</span> seconds
    </p>
  </div>
  
  <script>
    let countdownValue = 2;
    const countdownElement = document.getElementById('countdown');
    const statusText = document.getElementById('status-text');
    
    function updateCountdown() {
      countdownElement.textContent = countdownValue;
      countdownValue--;
      
      if (countdownValue < 0) {
        statusText.textContent = 'Redirecting now...';
        setTimeout(() => {
          // Try to redirect to the app first
          window.location.href = '${config.frontendUrl}auth/success?platform=spotify&token=${state}';
          
          // Fallback: close the window after a short delay
          setTimeout(() => {
            window.close();
          }, 1000);
        }, 500);
      } else {
        setTimeout(updateCountdown, 1000);
      }
    }
    
    function closeWindow() {
      // Try to redirect to app first
      try {
        window.location.href = '${config.frontendUrl}auth/success?platform=spotify&token=${state}';
      } catch (e) {
        console.log('Deep link failed, trying to close window');
      }
      
      // Try to close the window
      setTimeout(() => {
        if (window.opener) {
          window.opener.focus();
          window.close();
        } else {
          window.close();
        }
      }, 500);
    }
    
    // Start countdown
    setTimeout(updateCountdown, 1000);
    
    // Try to notify the parent window if opened in a popup
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'SPOTIFY_AUTH_SUCCESS',
          platform: 'spotify',
          token: '${state}'
        }, '*');
      }
    } catch (e) {
      console.log('Parent window notification failed:', e);
    }
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