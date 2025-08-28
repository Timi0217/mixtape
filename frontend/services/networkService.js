import { useEffect, useState } from 'react';

class NetworkService {
  constructor() {
    this.isConnected = true;
    this.listeners = new Set();
  }

  // Subscribe to network changes
  subscribe(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Initialize network monitoring
  initialize() {
    // For now, assume always connected in development
    // In production, you can add proper network detection
    this.isConnected = true;
    
    // Optionally test connectivity by making a simple request
    this.testConnectivity();
  }

  // Test connectivity by making a simple request
  async testConnectivity() {
    try {
      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        timeout: 5000,
      });
      const wasConnected = this.isConnected;
      this.isConnected = response.ok;
      
      if (wasConnected !== this.isConnected) {
        this.listeners.forEach(callback => {
          callback(this.isConnected);
        });
      }
    } catch (error) {
      const wasConnected = this.isConnected;
      this.isConnected = false;
      
      if (wasConnected !== this.isConnected) {
        this.listeners.forEach(callback => {
          callback(this.isConnected);
        });
      }
    }
  }

  // Get current connection status
  getConnectionStatus() {
    return this.isConnected;
  }

  // Check if connected and throw error if not
  requireConnection() {
    if (!this.isConnected) {
      throw new Error('No internet connection available');
    }
  }
}

// React hook for using network status
export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(networkService.getConnectionStatus());

  useEffect(() => {
    const unsubscribe = networkService.subscribe(setIsConnected);
    return unsubscribe;
  }, []);

  return isConnected;
};

// React hook for network-dependent operations
export const useNetworkOperation = () => {
  const isConnected = useNetworkStatus();

  const executeWithConnection = async (operation, options = {}) => {
    const { showOfflineMessage = true, fallback = null } = options;

    if (!isConnected) {
      if (showOfflineMessage) {
        // You could show a toast or alert here
        console.warn('Operation requires internet connection');
      }
      
      if (fallback) {
        return fallback();
      }
      
      throw new Error('No internet connection');
    }

    return await operation();
  };

  return { executeWithConnection, isConnected };
};

const networkService = new NetworkService();

export default networkService;