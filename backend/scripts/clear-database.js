const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearDatabase() {
  try {
    console.log('🗑️ Starting database cleanup...');
    
    // Delete in order to respect foreign key constraints
    console.log('Deleting votes...');
    await prisma.vote.deleteMany();
    
    console.log('Deleting submissions...');
    await prisma.submission.deleteMany();
    
    console.log('Deleting playlist tracks...');
    await prisma.playlistTrack.deleteMany();
    
    console.log('Deleting playlists...');
    await prisma.playlist.deleteMany();
    
    console.log('Deleting group playlists...');
    await prisma.groupPlaylist.deleteMany();
    
    console.log('Deleting daily rounds...');
    await prisma.dailyRound.deleteMany();
    
    console.log('Deleting group members...');
    await prisma.groupMember.deleteMany();
    
    console.log('Deleting groups...');
    await prisma.group.deleteMany();
    
    console.log('Deleting songs...');
    await prisma.song.deleteMany();
    
    console.log('Deleting user music accounts...');
    await prisma.userMusicAccount.deleteMany();
    
    console.log('Deleting user email aliases...');
    await prisma.userEmailAlias.deleteMany();
    
    console.log('Deleting user notification settings...');
    await prisma.userNotificationSettings.deleteMany();
    
    console.log('Deleting user music preferences...');
    await prisma.userMusicPreferences.deleteMany();
    
    console.log('Deleting OAuth sessions...');
    await prisma.oAuthSession.deleteMany();
    
    console.log('Deleting users...');
    await prisma.user.deleteMany();
    
    console.log('✅ Database cleared successfully!');
    console.log('🎯 All users will now need to re-register with proper Apple Music authentication');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  clearDatabase()
    .then(() => {
      console.log('🎉 Database cleanup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { clearDatabase };