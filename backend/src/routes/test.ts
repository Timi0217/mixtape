import express from 'express';
import { appleMusicService } from '../services/appleMusicService';

const router = express.Router();

// Test Apple Music API
router.post('/apple-music-search', async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    console.log(`🔍 Testing Apple Music search for: "${query}"`);
    
    // Test developer token generation
    const developerToken = await appleMusicService.getDeveloperToken();
    console.log('✅ Developer token generated successfully');
    
    // Test search functionality
    const songs = await appleMusicService.searchMusic(query, limit);
    console.log(`📱 Found ${songs.length} songs from Apple Music`);
    
    // Format results
    const formattedResults = appleMusicService.formatSearchResults(songs);
    
    res.json({
      success: true,
      message: 'Apple Music API working correctly',
      query,
      count: formattedResults.length,
      results: formattedResults,
    });
    
  } catch (error) {
    console.error('❌ Apple Music test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Check your Apple Music credentials and private key file',
    });
  }
});

// Test developer token generation only
router.get('/apple-music-token', async (req, res) => {
  try {
    const token = await appleMusicService.getDeveloperToken();
    res.json({
      success: true,
      message: 'Apple Music developer token generated successfully',
      tokenLength: token.length,
      tokenPreview: token.substring(0, 50) + '...',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test detailed Apple Music API connectivity
router.get('/apple-music-debug', async (req, res) => {
  try {
    console.log('🔍 Starting Apple Music debug test...');
    
    // Test developer token generation with detailed logging
    const developerToken = await appleMusicService.getDeveloperToken();
    console.log('✅ Developer token generated, length:', developerToken.length);
    
    // Test a simple API call manually
    const axios = require('axios');
    const testUrl = 'https://api.music.apple.com/v1/catalog/us/songs/203709340';
    
    console.log('🌐 Testing direct Apple Music API call...');
    console.log('- URL:', testUrl);
    console.log('- Auth header preview:', `Bearer ${developerToken.substring(0, 50)}...`);
    
    const response = await axios.get(testUrl, {
      headers: {
        'Authorization': `Bearer ${developerToken}`,
        'Music-User-Token': 'test_user_token' // This will fail but we can see the error
      },
      timeout: 10000
    });
    
    res.json({
      success: true,
      message: 'Apple Music API test successful',
      response: {
        status: response.status,
        dataKeys: Object.keys(response.data || {}),
        data: response.data
      }
    });
    
  } catch (error) {
    console.error('❌ Apple Music debug test failed:', error);
    
    let errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      headers: error.response?.headers
    };
    
    res.status(500).json({
      success: false,
      error: 'Apple Music API debug test failed',
      details: errorDetails,
      analysis: {
        likely_causes: {
          401: 'Invalid developer token or JWT signing issue',
          403: 'MusicKit not properly enabled or permission issue',
          404: 'API endpoint not found',
          network: 'Network connectivity issue'
        }
      }
    });
  }
});

// Test Apple Music playlist creation (bypass frontend authentication)
router.post('/apple-music-playlist', async (req, res) => {
  const { name, description, musicUserToken } = req.body;
  
  try {
    console.log('🧪 Testing Apple Music playlist creation...');
    console.log('🔑 Music User Token:', musicUserToken ? 'Provided by user' : 'Using test token');
    
    // Test with provided token or simulate with test token
    const tokenToUse = musicUserToken || 'test_music_user_token_for_backend_validation';
    
    console.log('🎵 Attempting to create Apple Music playlist...');
    
    // Test playlist creation
    const playlist = await appleMusicService.createPlaylist(tokenToUse, {
      name: name || 'Mixtape Backend Test',
      description: description || 'Test playlist created directly through Mixtape backend to verify Apple Music integration is working',
      songs: []
    });
    
    console.log('✅ Apple Music playlist created successfully:', {
      id: playlist.id,
      name: playlist.attributes?.name,
      url: playlist.attributes?.url
    });
    
    res.json({
      success: true,
      playlist: {
        id: playlist.id,
        name: playlist.attributes?.name || name,
        description: playlist.attributes?.description || description,
        url: playlist.attributes?.url,
        playParams: playlist.attributes?.playParams
      },
      message: 'SUCCESS! Apple Music playlist creation works perfectly. Backend integration is fully functional.',
      note: 'This confirms your Apple Music API integration is working. The only limitation is frontend authentication with Expo.'
    });
    
  } catch (error) {
    console.error('❌ Apple Music playlist creation test failed:', error);
    
    // Analyze the error and provide specific guidance
    let errorAnalysis = {
      message: error.message,
      likely_cause: 'unknown',
      action_needed: 'check logs'
    };
    
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      errorAnalysis.likely_cause = 'invalid_music_user_token';
      errorAnalysis.action_needed = 'Need a real Music User Token from Apple Music authorization';
    } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      errorAnalysis.likely_cause = 'musickit_not_enabled';
      errorAnalysis.action_needed = 'Verify MusicKit is enabled in Apple Developer Console';
    } else if (error.message?.includes('developer_token') || error.message?.includes('JWT')) {
      errorAnalysis.likely_cause = 'invalid_developer_token';
      errorAnalysis.action_needed = 'Check Apple Music API key configuration';
    } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
      errorAnalysis.likely_cause = 'network_connectivity';
      errorAnalysis.action_needed = 'Check network connection to Apple Music API';
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      analysis: errorAnalysis,
      testing_info: {
        developer_token: 'Generated successfully (see /test/apple-music-token)',
        music_user_token: musicUserToken ? 'User provided' : 'Test token used',
        next_steps: {
          if_401: 'Try with a real Music User Token from web browser MusicKit.js',
          if_403: 'Check MusicKit is enabled in Apple Developer Console',
          if_developer_token_error: 'Verify Apple Music API key environment variables'
        }
      }
    });
  }
});

export default router;