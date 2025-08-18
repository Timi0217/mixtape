// OAuth polling service to check for completed authentications
import api from './api';

class OAuthPolling {
  constructor() {
    this.isPolling = false;
    this.pollInterval = null;
  }

  startPolling(state, onSuccess, onError) {
    if (this.isPolling) {
      this.stopPolling();
    }

    this.isPolling = true;
    console.log('Starting OAuth polling for state:', state);

    // Poll every 2 seconds for 5 minutes max
    let attempts = 0;
    const maxAttempts = 150; // 5 minutes

    this.pollInterval = setInterval(async () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        console.log('OAuth polling timeout');
        this.stopPolling();
        onError('OAuth timeout - please try again');
        return;
      }

      try {
        // Check if OAuth completed by polling the backend
        const tokenResponse = await api.get(`/oauth/check-token/${state}`);
        
        if (tokenResponse.data.success) {
          console.log('OAuth completed successfully!', tokenResponse.data);
          this.stopPolling();
          
          // For linking flows, we don't need to return a new token
          // Just indicate success
          if (tokenResponse.data.message && tokenResponse.data.message.includes('linked')) {
            onSuccess(null, { platform: tokenResponse.data.platform, linked: true });
          } else {
            onSuccess(tokenResponse.data.token, { platform: tokenResponse.data.platform });
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Continue polling on network errors
      }
    }, 2000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log('OAuth polling stopped');
  }
}

export default new OAuthPolling();