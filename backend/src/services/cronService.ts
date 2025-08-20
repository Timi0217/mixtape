import * as cron from 'node-cron';
import { prisma } from '../config/database';
import { GroupPlaylistService } from './groupPlaylistService';
import { musicService } from './musicService';

export class CronService {
  
  /**
   * Create daily rounds for all groups at midnight UTC
   * This ensures rounds are created proactively, not on-demand
   */
  static async createDailyRounds() {
    console.log('🕛 Creating daily rounds for all groups...');
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all active groups
      const groups = await prisma.group.findMany({
        include: {
          members: true,
        },
      });

      let createdCount = 0;
      let skippedCount = 0;

      for (const group of groups) {
        // Check if round already exists for today
        const existingRound = await prisma.dailyRound.findUnique({
          where: {
            groupId_date: {
              groupId: group.id,
              date: today,
            },
          },
        });

        if (existingRound) {
          skippedCount++;
          continue;
        }

        // Create new round with 11 PM deadline
        const deadlineAt = new Date(today);
        deadlineAt.setHours(23, 0, 0, 0);

        await prisma.dailyRound.create({
          data: {
            groupId: group.id,
            date: today,
            deadlineAt,
            status: 'active',
          },
        });

        createdCount++;
      }

      console.log(`✅ Daily round creation completed: ${createdCount} created, ${skippedCount} skipped`);
    } catch (error) {
      console.error('❌ Error creating daily rounds:', error);
    }
  }

  /**
   * Process completed rounds and update group playlists
   * This runs at 8 AM UTC to update persistent group playlists with today's submissions
   */
  static async processCompletedRounds() {
    console.log('🎵 Processing completed rounds...');
    
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Find all completed rounds from yesterday that haven't been processed
      const completedRounds = await prisma.dailyRound.findMany({
        where: {
          date: yesterday,
          status: 'active', // Still marked as active, need to check completion
        },
        include: {
          group: {
            include: {
              members: true,
            },
          },
          submissions: {
            include: {
              user: true,
              song: true,
            },
          },
        },
      });

      let processedCount = 0;
      let failedCount = 0;

      for (const round of completedRounds) {
        try {
          const totalMembers = round.group.members.length;
          const submissionCount = round.submissions.length;

          // Process round regardless of completion status
          // This creates/updates the persistent group playlists
          try {
            // Ensure group playlists exist
            await GroupPlaylistService.ensureGroupPlaylists(round.group.id);
            
            // Update group playlists with today's submissions (or clear if no submissions)
            await GroupPlaylistService.updateGroupPlaylistsForRound(round.id);
            
            // Update round status based on completion
            const newStatus = submissionCount === totalMembers ? 'completed' : 'partial';
            await prisma.dailyRound.update({
              where: { id: round.id },
              data: { status: newStatus },
            });

            if (submissionCount === totalMembers) {
              console.log(`✅ Round ${round.id} completed: Group playlists updated with ${submissionCount} songs`);
            } else {
              console.log(`⚠️ Round ${round.id} partial: Group playlists updated with ${submissionCount}/${totalMembers} songs`);
            }
            processedCount++;
          } catch (playlistError) {
            console.error(`❌ Error updating group playlists for round ${round.id}:`, playlistError);
            // Mark round as failed if playlist update fails
            await prisma.dailyRound.update({
              where: { id: round.id },
              data: { status: 'failed' },
            });
            failedCount++;
          }
        } catch (roundError) {
          console.error(`Error processing round ${round.id}:`, roundError);
          failedCount++;
        }
      }

      console.log(`✅ Round processing completed: ${processedCount} successful, ${failedCount} failed`);
    } catch (error) {
      console.error('❌ Error processing completed rounds:', error);
    }
  }

  /**
   * Refresh expired music tokens to maintain account connectivity
   * Runs every 4 hours to check and refresh tokens that are about to expire
   */
  static async refreshExpiredTokens() {
    console.log('🔄 Refreshing expired music tokens...');
    
    try {
      await musicService.refreshAllExpiredTokens();
      console.log('✅ Token refresh job completed');
    } catch (error) {
      console.error('❌ Error refreshing expired tokens:', error);
    }
  }

  /**
   * Clean up old rounds and submissions to manage database size
   * Runs weekly to clean up data older than 30 days
   */
  static async cleanupOldData() {
    console.log('🧹 Cleaning up old data...');
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Delete old rounds (cascade will delete submissions)
      const deleteResult = await prisma.dailyRound.deleteMany({
        where: {
          date: {
            lt: thirtyDaysAgo,
          },
        },
      });

      console.log(`✅ Cleaned up ${deleteResult.count} old rounds`);
    } catch (error) {
      console.error('❌ Error cleaning up old data:', error);
    }
  }

  /**
   * Start all scheduled tasks
   */
  static startScheduledTasks() {
    console.log('🚀 Starting scheduled tasks...');

    // Create daily rounds at midnight UTC
    cron.schedule('0 0 * * *', () => {
      console.log('⏰ Running daily round creation job');
      this.createDailyRounds();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    // Process completed rounds at 8 AM UTC  
    cron.schedule('0 8 * * *', () => {
      console.log('⏰ Running group playlist update job');
      this.processCompletedRounds();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    // Refresh expired tokens every 4 hours
    cron.schedule('0 */4 * * *', () => {
      console.log('⏰ Running token refresh job');
      this.refreshExpiredTokens();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    // Clean up old data weekly on Sundays at 2 AM UTC
    cron.schedule('0 2 * * 0', () => {
      console.log('⏰ Running weekly cleanup job');
      this.cleanupOldData();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    console.log('✅ All scheduled tasks started');
  }

  /**
   * Stop all scheduled tasks (for graceful shutdown)
   */
  static stopScheduledTasks() {
    console.log('🛑 Stopping scheduled tasks...');
    cron.getTasks().forEach((task) => {
      task.stop();
    });
    console.log('✅ All scheduled tasks stopped');
  }
}

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('📳 Received SIGINT, stopping scheduled tasks...');
  CronService.stopScheduledTasks();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('📳 Received SIGTERM, stopping scheduled tasks...');
  CronService.stopScheduledTasks();
  process.exit(0);
});