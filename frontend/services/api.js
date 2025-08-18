import axios from 'axios';
import { Platform } from 'react-native';
import config from '../config/env';

const API_BASE_URL = config.API_BASE_URL;

// Log API configuration
if (config.ENABLE_DEBUG_LOGS) {
  console.log('🌐 Frontend API Configuration:', {
    baseURL: API_BASE_URL,
    environment: config.APP_ENV,
    platform: Platform.OS,
  });
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Commented out localhost override to fix Spotify OAuth
// if (__DEV__) {
//   api.defaults.baseURL = 'http://localhost:3000/api';
//   console.log('🔧 Forced API baseURL to localhost:', api.defaults.baseURL);
// }

// Export the API base URL and config for use in other files
export { API_BASE_URL };
export { config as apiConfig };

// Auth token management
let authToken = null;

export const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// API functions
export const musicAPI = {
  // Search for music across platforms
  search: async (query, platform, limit) => {
    const response = await api.get('/music/search', {
      params: { q: query, platform, limit }
    });
    return response.data;
  },

  // Get song details by ID
  getSong: async (songId) => {
    const response = await api.get(`/music/song/${songId}`);
    return response.data;
  },

  // Match songs across platforms
  matchSongs: async (songs, targetPlatform) => {
    const response = await api.post('/music/songs/match', {
      songs,
      targetPlatform
    });
    return response.data;
  },

  // Get available platforms
  getPlatforms: async () => {
    const response = await api.get('/music/platforms');
    return response.data;
  }
};

export const playlistAPI = {
  // Create cross-platform playlist
  create: async (playlistData) => {
    const response = await api.post('/playlists/create', playlistData);
    return response.data;
  },

  // Get playlist by ID
  getById: async (playlistId) => {
    const response = await api.get(`/playlists/${playlistId}`);
    return response.data;
  },

  // Get user playlists
  getUserPlaylists: async () => {
    const response = await api.get('/playlists');
    return response.data;
  }
};

export const authAPI = {
  // Login (you'll need to implement this based on your auth system)
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  // Register
  register: async (email, password, displayName) => {
    const response = await api.post('/auth/register', { email, password, displayName });
    return response.data;
  }
};

export default api;