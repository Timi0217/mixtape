import express from 'express';
import { appleMusicService } from '../services/appleMusicService';

const router = express.Router();

// Clean Apple Music Desktop Authentication Route - NO CSP RESTRICTIONS
router.get('/apple-music-clean', async (req, res) => {
  try {
    console.log('🖥️ Clean Apple Music Desktop Authentication Request');
    
    // Generate developer token for MusicKit
    let developerToken;
    try {
      developerToken = await appleMusicService.getDeveloperToken();
      console.log('✅ Developer token generated for clean auth');
    } catch (tokenError) {
      console.error('❌ Failed to generate developer token:', tokenError);
      return res.status(500).send('Failed to initialize Apple Music authentication');
    }

    // Create HTML with NO CSP restrictions whatsoever
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-eval' 'unsafe-inline'; script-src * 'unsafe-eval' 'unsafe-inline';">
  <title>Apple Music - Clean Auth</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #FC3C44; color: white; text-align: center; padding: 40px;">
  <h1>🎵 Apple Music Authentication</h1>
  <p>Connecting to Apple Music...</p>
  <div id="status">Loading MusicKit...</div>
  
  <script>
    console.log('=== CLEAN AUTH DEBUG ===');
    
    // Check current CSP
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    console.log('CSP Meta found:', cspMeta ? cspMeta.content : 'none');
    
    // Check if eval is in a different context
    console.log('Location:', window.location.href);
    console.log('User Agent:', navigator.userAgent.substring(0, 50));
    
    // Test 1: Basic eval
    try {
      eval('console.log("✅ eval() works!")');
    } catch(e) {
      console.log('❌ eval() blocked:', e.message);
      console.log('❌ eval() error type:', e.name);
      console.log('❌ eval() stack:', e.stack);
    }
    
    // Test 2: Function constructor  
    try {
      new Function('console.log("✅ Function constructor works!")')();
    } catch(e) {
      console.log('❌ Function constructor blocked:', e.message);
    }
    
    // Test 3: setTimeout with string
    try {
      setTimeout('console.log("✅ setTimeout string works!")', 100);
    } catch(e) {
      console.log('❌ setTimeout string blocked:', e.message);
    }
    
    console.log('=== END DEBUG ===');
    
    // Load MusicKit dynamically to bypass any restrictions
    const script = document.createElement('script');
    script.src = 'https://js-cdn.music.apple.com/musickit/v1/musickit.js';
    script.onload = function() {
      console.log('MusicKit loaded!');
      
      try {
        MusicKit.configure({
          developerToken: '${developerToken}',
          app: {
            name: 'Mixtape',
            build: '1.0.0'
          }
        });
        
        document.getElementById('status').textContent = 'MusicKit configured! Click to authorize.';
        
        // Add authorize button
        const btn = document.createElement('button');
        btn.textContent = 'Authorize Apple Music';
        btn.style.cssText = 'background: white; color: #FC3C44; border: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 20px;';
        btn.onclick = function() {
          console.log('Starting authorization...');
          MusicKit.getInstance().authorize()
            .then(function(userToken) {
              console.log('Authorization successful!', userToken);
              document.getElementById('status').innerHTML = '<h2>✅ Success!</h2><p>Apple Music connected!</p>';
            })
            .catch(function(error) {
              console.error('Authorization failed:', error);
              document.getElementById('status').innerHTML = '<h2>❌ Failed</h2><p>' + error.message + '</p>';
            });
        };
        document.body.appendChild(btn);
        
      } catch(error) {
        console.error('MusicKit configuration failed:', error);
        document.getElementById('status').textContent = 'MusicKit configuration failed: ' + error.message;
      }
    };
    
    script.onerror = function() {
      console.error('Failed to load MusicKit script');
      document.getElementById('status').textContent = 'Failed to load MusicKit script';
    };
    
    document.head.appendChild(script);
  </script>
</body>
</html>`;

    // Send response with absolutely NO CSP headers and explicitly disable CSP
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    // Remove any possible CSP headers
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('content-security-policy');
    res.removeHeader('X-Content-Security-Policy');
    res.removeHeader('X-WebKit-CSP');
    
    // Set permissive CSP as fallback
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-eval' 'unsafe-inline'; script-src * 'unsafe-eval' 'unsafe-inline'");
    
    res.send(html);
    
  } catch (error) {
    console.error('Clean Apple Music auth error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Super simple CSP test route
router.get('/csp-test', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  // Completely remove any CSP
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('content-security-policy'); 
  
  const html = `<!DOCTYPE html>
<html>
<head><title>CSP Test</title></head>
<body>
  <h1>CSP Test Page</h1>
  <script>
    console.log('Testing eval...');
    try {
      eval('console.log("SUCCESS: eval() works!");');
      document.body.innerHTML += '<p style="color: green;">✅ SUCCESS: eval() works!</p>';
    } catch(e) {
      console.error('FAILED: eval() blocked:', e);
      document.body.innerHTML += '<p style="color: red;">❌ FAILED: eval() blocked - ' + e.message + '</p>';
    }
  </script>
</body>
</html>`;
  
  res.send(html);
});

export default router;