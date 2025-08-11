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

export default router;