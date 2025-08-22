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
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              background: linear-gradient(135deg, #FC3C44 0%, #FF6B6B 100%);
              min-height: 100vh;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              text-align: center;
            }
            .container {
              padding: 40px;
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(20px);
              border-radius: 24px;
              max-width: 400px;
            }
            .btn {
              background: #007AFF;
              color: white;
              border: none;
              padding: 16px 32px;
              border-radius: 12px;
              font-size: 17px;
              font-weight: 600;
              cursor: pointer;
              margin: 8px;
            }
            .btn:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎵 Apple Music</h1>
            <p>Connect your Apple Music account</p>
            <div id="status">Initializing...</div>
            <br>
            <button onclick="authorizeAppleMusic()" class="btn" id="authBtn" disabled>
              Authorize Apple Music
            </button>
          </div>

          <script>
            // Apple's Official MusicKit.js Implementation
            console.log('🍎 Apple Music - Official Implementation');
            
            document.addEventListener('musickitloaded', function () {
              console.log('🎵 MusicKit loaded');
              
              // Configure MusicKit (Apple's recommended approach)
              MusicKit.configure({
                developerToken: '${developerToken}',
                debug: true,
                declarativeMarkup: true,
                storefrontId: 'us'
              });
              
              console.log('✅ MusicKit configured');
              document.getElementById('status').textContent = 'Ready!';
              document.getElementById('authBtn').disabled = false;
            });
            
            // Apple's Official Authorization Function
            function authorizeAppleMusic() {
              console.log('🚀 Starting authorization');
              const music = MusicKit.getInstance();
              
              document.getElementById('status').textContent = 'Authorizing...';
              
              music.authorize().then(function(userToken) {
                console.log('✅ Success! Token:', userToken);
                
                if (userToken) {
                  document.getElementById('status').textContent = 'Success! Redirecting...';
                  
                  const redirectUrl = '${redirect || 'mixtape://apple-music-success'}';
                  const finalUrl = redirectUrl + '?token=' + encodeURIComponent(userToken);
                  
                  console.log('🔗 Redirecting to:', finalUrl);
                  
                  setTimeout(() => {
                    window.location.href = finalUrl;
                  }, 1000);
                } else {
                  document.getElementById('status').textContent = 'No token received';
                }
              }).catch(function(error) {
                console.error('❌ Authorization failed:', error);
                document.getElementById('status').textContent = 'Authorization failed: ' + error.message;
              });
            }
          </script>
        </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Apple Safari auth error:', error);
    res.status(500).send('Authentication page failed to load');
  }
});