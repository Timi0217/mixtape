const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function testEmptyPlaylistsScenario() {
  const prisma = new PrismaClient();
  const baseUrl = 'http://localhost:3000/api';
  
  try {
    console.log('🧪 Testing empty playlists scenario...\n');
    
    await prisma.$connect();
    
    // Get test data
    const testUser = await prisma.user.findFirst();
    const testGroup = await prisma.group.findFirst();
    
    if (!testUser || !testGroup) {
      console.log('❌ No test data found');
      return;
    }
    
    console.log(`✅ Test user: ${testUser.displayName} (${testUser.id})`);
    console.log(`✅ Test group: ${testGroup.name} (${testGroup.id})`);
    
    // Delete all existing playlists to simulate empty state
    await prisma.groupPlaylist.deleteMany({
      where: { groupId: testGroup.id }
    });
    console.log('🗑️ Deleted all existing playlists to simulate empty state');
    
    // Create JWT token
    const jwt = require('jsonwebtoken');
    const validToken = jwt.sign(
      { userId: testUser.id },
      'dfdce629da003f530e35086a17fe3826cea6f5db2988e16bb5d33f8168b1c81e84eab7b169b8f4b51fa912ff6104ce453f4c05214b05f6e5a576cd334a664189',
      { expiresIn: '1h' }
    );
    
    const headers = {
      'Authorization': `Bearer ${validToken}`,
      'Content-Type': 'application/json',
    };
    
    console.log('\n🔍 Testing GET /playlists/group/{id} with NO playlists:');
    try {
      const response = await axios.get(`${baseUrl}/playlists/group/${testGroup.id}`, { headers });
      console.log('✅ SUCCESS:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ ERROR:', error.response?.status, error.response?.data);
      console.log('This is the 500 error the user is seeing!');
    }
    
    console.log('\n🔍 Testing GET /playlists with NO playlists:');
    try {
      const response = await axios.get(`${baseUrl}/playlists`, { headers });
      console.log('✅ SUCCESS:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ ERROR:', error.response?.status, error.response?.data);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEmptyPlaylistsScenario();