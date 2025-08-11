// Test script for Apple Music integration
const axios = require('axios');

async function testAppleMusicAPI() {
  console.log('🎵 Testing Apple Music API Integration...\n');

  try {
    // Test developer token generation by making a search request
    const response = await axios.post('http://localhost:3000/test-apple-music-search', {
      query: 'bohemian rhapsody',
      limit: 3
    });

    console.log('✅ Apple Music API Test Results:');
    console.log(`Found ${response.data.results?.length || 0} songs`);
    
    if (response.data.results && response.data.results.length > 0) {
      response.data.results.forEach((song, index) => {
        console.log(`${index + 1}. ${song.title} by ${song.artist}`);
        console.log(`   Platform: ${song.platform}, ID: ${song.platformId}`);
      });
    }

    console.log('\n🎉 Apple Music integration is working!');
    
  } catch (error) {
    console.error('❌ Apple Music API test failed:');
    console.error('Error:', error.response?.data || error.message);
    console.log('\n💡 Make sure:');
    console.log('- Your Apple Music credentials are correct in .env');
    console.log('- The private key file is in the right location');
    console.log('- You have an active Apple Developer account');
  }
}

testAppleMusicAPI();