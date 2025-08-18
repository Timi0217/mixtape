import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken, API_BASE_URL } from '../services/api';
import config from '../config/env';

const AuthContext = createContext(undefined);

const AUTH_TOKEN_KEY = '@mixtape:auth_token';
const USER_DATA_KEY = '@mixtape:user_data';

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load stored authentication data on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedToken, storedUserData] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(USER_DATA_KEY),
      ]);

      if (storedToken && storedUserData) {
        const userData = JSON.parse(storedUserData);
        
        // Check if token looks like a mock token (contains 'mock_jwt_token')
        if (storedToken.includes('mock_jwt_token')) {
          console.log('Found mock token, clearing stored auth');
          await clearStoredAuth();
          setLoading(false);
          return;
        }
        
        // Set token in API client
        setAuthToken(storedToken);
        
        // Update state
        setToken(storedToken);
        setUser(userData);
        setIsAuthenticated(true);
        
        // Verify token is still valid
        await verifyToken(storedToken);
      }
    } catch (error) {
      console.error('Failed to load stored auth:', error);
      // If there's an error loading auth, clear stored data
      await clearStoredAuth();
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async (tokenToVerify) => {
    try {
      const baseUrl = API_BASE_URL.replace('/api', '');
      if (config.ENABLE_DEBUG_LOGS) {
        console.log('🔐 AuthContext using baseUrl:', baseUrl);
      }
      
      const response = await fetch(`${baseUrl}/api/oauth/me`, {
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      } else {
        // Token is invalid, clear stored auth and log out
        console.log('Token verification failed, clearing stored auth');
        await clearStoredAuth();
        setAuthToken(null);
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      // On network error or invalid token, clear stored auth
      console.log('Network error during token verification, clearing stored auth');
      await clearStoredAuth();
      setAuthToken(null);
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const login = async (newToken, userData) => {
    try {
      console.log('🔐 AuthContext.login called with:');
      console.log('  Token:', newToken ? `${newToken.substring(0, 20)}...` : 'null');
      console.log('  User data:', userData);
      
      console.log('💾 Storing auth data in AsyncStorage...');
      // Store in AsyncStorage
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData)),
      ]);

      console.log('🔑 Setting token in API client...');
      // Set token in API client
      setAuthToken(newToken);

      console.log('📱 Updating auth state...');
      // Update state
      setToken(newToken);
      setUser(userData);
      setIsAuthenticated(true);
      
      console.log('✅ Login completed successfully! isAuthenticated:', true);
    } catch (error) {
      console.error('❌ Failed to store auth data:', error);
      throw new Error('Failed to complete login');
    }
  };

  const logout = async () => {
    try {
      // Clear stored data
      await clearStoredAuth();
      
      // Clear API client token
      setAuthToken(null);
      
      // Clear state
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const clearStoredAuth = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(AUTH_TOKEN_KEY),
        AsyncStorage.removeItem(USER_DATA_KEY),
      ]);
    } catch (error) {
      console.error('Failed to clear stored auth:', error);
    }
  };

  const refreshUser = async () => {
    if (token) {
      await verifyToken(token);
    }
  };

  const value = {
    isAuthenticated,
    user,
    token,
    login,
    logout,
    loading,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};