import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../utils/validation';
import { GroupPlaylistService } from '../services/groupPlaylistService';
import { prisma } from '../config/database';

const router = express.Router();

router.post('/create',
  authenticateToken,
  [
    body('name').isString().isLength({ min: 1, max: 100 }).trim(),
    body('description').optional().isString().isLength({ max: 500 }).trim(),
    body('platforms').isArray().custom((platforms) => {
      const validPlatforms = ['spotify', 'apple-music'];
      return platforms.every((p: string) => validPlatforms.includes(p));
    }),
    body('songs').isArray().isLength({ min: 1 }),
    body('songs.*').isString(),
    body('isPublic').optional().isBoolean(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { name, description, platforms, songs, isPublic } = req.body;

      // TODO: Implement createCrossPlatformPlaylist method
      throw new Error('Cross-platform playlist creation not yet implemented');

      res.json({
        success: false,
        error: 'Cross-platform playlist creation not yet implemented',
      });
    } catch (error) {
      console.error('Playlist creation error:', error);
      res.status(500).json({ error: 'Failed to create cross-platform playlist' });
    }
  }
);

router.get('/:id',
  authenticateToken,
  [
    param('id').isString(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      // TODO: Implement getPlaylistById method
      const playlist = null; // Placeholder

      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }

      res.json(playlist);
    } catch (error) {
      console.error('Get playlist error:', error);
      res.status(500).json({ error: 'Failed to get playlist' });
    }
  }
);

// Test Apple Music authentication status
router.get('/test-apple-music/:userId',
  authenticateToken,
  [
    param('userId').isString(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { musicAccounts: true }
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const appleMusicAccount = user.musicAccounts.find(acc => acc.platform === 'apple-music');
      
      res.json({
        userId: user.id,
        displayName: user.displayName,
        hasAppleMusicAccount: !!appleMusicAccount,
        appleMusicToken: appleMusicAccount ? {
          exists: !!appleMusicAccount.accessToken,
          isDemo: appleMusicAccount.accessToken?.startsWith('demo_'),
          tokenPreview: appleMusicAccount.accessToken?.substring(0, 20) + '...'
        } : null
      });
    } catch (error) {
      console.error('Test Apple Music error:', error);
      res.status(500).json({ error: 'Test failed' });
    }
  }
);

// Create group playlists for a group (admin only)
router.post('/group/:groupId/create',
  authenticateToken,
  [
    param('groupId').isString(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user?.id;

      console.log(`🎵 Starting playlist creation for group ${groupId} by user ${userId}`);

      if (!userId) {
        console.log('❌ No user ID provided');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!groupId || !groupId.trim()) {
        console.log('❌ No group ID provided');
        return res.status(400).json({ error: 'Group ID is required' });
      }

      // Verify user is admin OR has playlist creation permissions
      console.log(`🔍 Checking if user ${userId} can create playlists for group ${groupId}`);
      const group = await prisma.group.findFirst({
        where: {
          id: groupId,
        },
        include: {
          members: {
            include: {
              user: {
                include: {
                  musicAccounts: true,
                },
              },
            },
          },
        },
      });

      if (!group) {
        console.log(`❌ Group ${groupId} doesn't exist`);
        return res.status(404).json({ 
          error: 'Group not found',
          message: 'The requested group does not exist'
        });
      }

      // Check if user is admin or has playlist permissions
      const isAdmin = group.adminUserId === userId;
      let hasPlaylistPermission = false;
      
      if (!isAdmin) {
        const permission = await prisma.playlistPermission.findFirst({
          where: {
            groupId,
            userId,
            canCreatePlaylists: true,
          },
        });
        hasPlaylistPermission = !!permission;
      }

      if (!isAdmin && !hasPlaylistPermission) {
        console.log(`❌ User ${userId} is not admin and doesn't have playlist creation permissions for group ${groupId}`);
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You must be the admin or have playlist creation permissions to create playlists'
        });
      }

      const userRole = isAdmin ? 'admin' : 'delegated user with permissions';
      console.log(`✅ User ${userId} is ${userRole} of group "${group.name}" with ${group.members.length} members`);

      // Check if any members have music accounts
      const membersWithMusic = group.members.filter(member => 
        member.user.musicAccounts && member.user.musicAccounts.length > 0
      );

      console.log(`🎼 ${membersWithMusic.length} out of ${group.members.length} members have music accounts`);

      if (membersWithMusic.length === 0) {
        console.log('❌ No group members have connected music accounts');
        return res.status(400).json({
          error: 'No music accounts found',
          message: 'No group members have connected music accounts. Please connect Spotify or Apple Music accounts before creating playlists.'
        });
      }

      // Check if current user has any music accounts (since they're creating the playlist)
      const currentUserMember = group.members.find(member => member.user.id === userId);
      if (!currentUserMember || !currentUserMember.user.musicAccounts || currentUserMember.user.musicAccounts.length === 0) {
        console.log('❌ Current user has no connected music accounts');
        return res.status(400).json({
          error: 'No music accounts connected',
          message: 'You need to have connected music accounts (Spotify or Apple Music) to create playlists.'
        });
      }

      // Create individual playlists for all group members
      console.log(`🚀 Creating individual playlists for all group members in group ${groupId}`);
      const groupPlaylists = await GroupPlaylistService.createIndividualGroupPlaylists(groupId);

      console.log(`✅ Successfully created/ensured ${groupPlaylists.length} group playlists`);

      res.json({
        success: true,
        groupPlaylists,
        message: 'Group playlists created successfully',
      });
    } catch (error) {
      console.error('❌ CREATE GROUP PLAYLISTS ERROR - FULL DETAILS:');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error code:', error.code);
      console.error('Error name:', error.name);
      console.error('Request details:', {
        method: req.method,
        url: req.url,
        params: req.params,
        headers: {
          authorization: req.headers.authorization ? 'Present' : 'Missing',
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
        },
        body: req.body,
        user: req.user,
      });
      
      // Check for Apple ID token error (shouldn't happen with new auth flow)
      if (error.message?.includes('APPLE_ID_TOKEN_ERROR')) {
        return res.status(400).json({
          error: 'Invalid Apple Music token',
          message: 'Your Apple Music authentication is invalid. Please log out and sign in again with Apple Music.',
          platform: 'apple-music'
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to create group playlists',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
          code: error.code,
          name: error.name
        } : undefined
      });
    }
  }
);

// Get group playlists for a specific group
router.get('/group/:groupId',
  authenticateToken,
  [
    param('groupId').isString(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!groupId || !groupId.trim()) {
        return res.status(400).json({ error: 'Group ID is required' });
      }

      // First check if the group exists
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { id: true, name: true },
      });

      if (!group) {
        return res.status(404).json({ 
          error: 'Group not found',
          message: 'The requested group does not exist or has been deleted'
        });
      }

      // Verify user is a member of this group
      const groupMember = await prisma.groupMember.findFirst({
        where: {
          groupId,
          userId,
        },
      });

      if (!groupMember) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You are not a member of this group'
        });
      }

      // Get group playlists
      const groupPlaylists = await prisma.groupPlaylist.findMany({
        where: {
          groupId,
          isActive: true,
        },
        include: {
          group: {
            select: {
              name: true,
              emoji: true,
            },
          },
        },
        orderBy: {
          platform: 'asc',
        },
      });

      // Log playlist URLs for debugging
      groupPlaylists.forEach(playlist => {
        console.log(`📋 Playlist Debug - ID: ${playlist.id}, Platform: ${playlist.platform}, URL: ${playlist.playlistUrl}`);
      });

      const responseData = {
        groupPlaylists: groupPlaylists.map(playlist => ({
          id: playlist.id,
          platform: playlist.platform,
          playlistName: playlist.playlistName,
          playlistUrl: playlist.playlistUrl,
          lastUpdated: playlist.lastUpdated,
          groupName: playlist.group.name,
          groupEmoji: playlist.group.emoji,
        })),
        total: groupPlaylists.length,
        message: groupPlaylists.length === 0 ? 
          'No playlists found for this group. Ask your group admin to create playlists.' : 
          undefined
      };

      console.log(`📤 Sending ${groupPlaylists.length} playlists to frontend`);
      res.json(responseData);
    } catch (error) {
      console.error('❌ GET GROUP PLAYLISTS ERROR - FULL DETAILS:');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error code:', error.code);
      console.error('Error name:', error.name);
      console.error('Request details:', {
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query,
        headers: {
          authorization: req.headers.authorization ? 'Present' : 'Missing',
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
        },
        user: req.user,
      });
      
      res.status(500).json({ 
        error: 'Failed to get group playlists',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
          code: error.code,
          name: error.name
        } : undefined
      });
    }
  }
);

// Update playlist name
router.put('/:playlistId/name',
  authenticateToken,
  [
    param('playlistId').isString(),
    body('name').isString().isLength({ min: 1, max: 100 }).trim(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { playlistId } = req.params;
      const { name } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get the playlist and verify user has permission
      const playlist = await prisma.groupPlaylist.findFirst({
        where: {
          id: playlistId,
          isActive: true,
        },
        include: {
          group: {
            include: {
              members: true,
            },
          },
        },
      });

      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }

      // Check if user is admin of the group
      if (playlist.group.adminUserId !== userId) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only group admins can edit playlist names'
        });
      }

      // Update playlist name in database
      const updatedPlaylist = await prisma.groupPlaylist.update({
        where: { id: playlistId },
        data: { playlistName: name.trim() },
      });

      // Update playlist name on platform
      try {
        const playlistManager = await GroupPlaylistService.findPlaylistManager(playlist.group, playlist.platform);
        if (playlistManager) {
          const { musicService } = await import('../services/musicService');
          const freshToken = await musicService.getValidUserToken(playlistManager.id, playlist.platform);
          
          if (freshToken && playlist.platform === 'spotify') {
            await GroupPlaylistService.updateSpotifyPlaylistName(
              freshToken, 
              playlist.platformPlaylistId, 
              name.trim()
            );
          }
        }
      } catch (platformError) {
        console.warn('⚠️ Failed to update playlist name on platform:', platformError);
        // Continue anyway - database is updated
      }

      res.json({
        success: true,
        playlist: updatedPlaylist,
        message: 'Playlist name updated successfully',
      });
    } catch (error) {
      console.error('❌ UPDATE PLAYLIST NAME ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to update playlist name',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);


// Get all playlists for user's groups
router.get('/',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get all groups the user is a member of
      const userGroups = await prisma.groupMember.findMany({
        where: { userId },
        include: {
          group: {
            include: {
              groupPlaylists: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      const allPlaylists = userGroups.flatMap(membership => 
        membership.group.groupPlaylists.map(playlist => ({
          id: playlist.id,
          platform: playlist.platform,
          playlistName: playlist.playlistName,
          playlistUrl: playlist.playlistUrl,
          lastUpdated: playlist.lastUpdated,
          groupId: playlist.groupId,
          groupName: membership.group.name,
          groupEmoji: membership.group.emoji,
        }))
      );

      res.json({
        playlists: allPlaylists,
        total: allPlaylists.length,
        message: allPlaylists.length === 0 ? 
          'No playlists found. Join a group and ask the admin to create playlists.' : 
          undefined
      });
    } catch (error) {
      console.error('❌ GET USER PLAYLISTS ERROR - FULL DETAILS:');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error code:', error.code);
      console.error('Error name:', error.name);
      console.error('Request details:', {
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query,
        headers: {
          authorization: req.headers.authorization ? 'Present' : 'Missing',
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
        },
        user: req.user,
      });
      
      res.status(500).json({ 
        error: 'Failed to get user playlists',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
          code: error.code,
          name: error.name
        } : undefined
      });
    }
  }
);

// TEMPORARY: Public test endpoint to show existing data for UI preview (NO AUTH)
router.get('/test-ui-status',
  async (req, res) => {
    try {
      // Get info about existing data
      const groups = await prisma.group.findMany({
        include: { 
          members: { include: { user: true } },
          rounds: { 
            include: { 
              submissions: { 
                include: { user: true, song: true } 
              } 
            } 
          },
          groupPlaylists: true
        }
      });

      const users = await prisma.user.findMany();
      const songs = await prisma.song.findMany();
      const submissions = await prisma.submission.findMany({
        include: { user: true, song: true, round: true }
      });

      res.json({
        success: true,
        message: 'Here\'s what data exists for UI testing',
        stats: {
          groups: groups.length,
          users: users.length,
          songs: songs.length,
          submissions: submissions.length,
        },
        groups: groups.map(g => ({
          id: g.id,
          name: g.name,
          members: g.members.length,
          rounds: g.rounds.length,
          playlists: g.groupPlaylists.length,
          hasSubmissions: g.rounds.some(r => r.submissions.length > 0)
        })),
        recentSubmissions: submissions.slice(0, 5).map(s => ({
          song: `${s.song.title} - ${s.song.artist}`,
          user: s.user.displayName,
          submittedAt: s.submittedAt
        }))
      });

    } catch (error) {
      console.error('Test status error:', error);
      res.status(500).json({ 
        error: 'Failed to get test status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// TEMPORARY: Mark a round as completed to test UI (NO AUTH)
router.post('/complete-round-for-ui',
  async (req, res) => {
    try {
      // Find the most recent active round
      const activeRound = await prisma.dailyRound.findFirst({
        where: { status: 'active' },
        include: { 
          group: true,
          submissions: { 
            include: { user: true, song: true } 
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!activeRound) {
        return res.status(404).json({ error: 'No active rounds found' });
      }

      if (activeRound.submissions.length === 0) {
        return res.status(400).json({ error: 'Round has no submissions. Submit a song first.' });
      }

      // Mark it as completed
      const completedRound = await prisma.dailyRound.update({
        where: { id: activeRound.id },
        data: { status: 'completed' }
      });

      // Create real playlist using GroupPlaylistService instead of fake test playlist
      try {
        const groupPlaylists = await import('../services/groupPlaylistService');
        await groupPlaylists.GroupPlaylistService.ensureGroupPlaylists(activeRound.groupId);
        await groupPlaylists.GroupPlaylistService.updateGroupPlaylistsForRound(activeRound.id);
        
        console.log('✅ Created real group playlists instead of fake test playlist');
      } catch (error) {
        console.error('❌ Failed to create real playlist, falling back to no playlist:', error);
        // Don't create fake playlists - better to have no playlist than broken links
      }

      res.json({
        success: true,
        message: `Round completed! Real group playlists created. Submit a song to the NEW round to see the UI.`,
        completedRound: {
          id: completedRound.id,
          submissions: activeRound.submissions.length,
          group: activeRound.group.name
        },
        instructions: [
          '1. This round is now marked as completed',
          '2. A new round should be created automatically', 
          '3. Submit a song to the NEW round',
          '4. You should now see the playlist banner with both buttons!'
        ]
      });

    } catch (error) {
      console.error('Complete round error:', error);
      res.status(500).json({ 
        error: 'Failed to complete round',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Delegate playlist creation to another user
router.post('/group/:groupId/delegate',
  authenticateToken,
  [
    param('groupId').isString().notEmpty(),
    body('delegateUserId').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { groupId } = req.params;
      const { delegateUserId } = req.body;
      const adminUserId = req.user!.id;

      console.log(`🎵 Delegating playlist creation for group ${groupId} from admin ${adminUserId} to user ${delegateUserId}`);

      // Verify admin is admin of this group
      const group = await prisma.group.findFirst({
        where: {
          id: groupId,
          adminUserId,
        },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!group) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only group admins can delegate playlist creation'
        });
      }

      // Verify delegate user is a member of this group
      const delegateMember = group.members.find(member => member.userId === delegateUserId);
      if (!delegateMember) {
        return res.status(400).json({ 
          error: 'Delegate not found',
          message: 'Delegate user is not a member of this group'
        });
      }

      // Check if delegate has playlist permissions
      const permission = await prisma.playlistPermission.findFirst({
        where: {
          groupId,
          userId: delegateUserId,
          canCreatePlaylists: true,
        },
      });

      if (!permission) {
        return res.status(400).json({ 
          error: 'No permission',
          message: 'Delegate user does not have playlist creation permissions'
        });
      }

      // Create delegation request record (for future notification system)
      // For now, we'll just return success - in the future this could trigger push notifications
      const delegationRequest = await prisma.playlistDelegationRequest.create({
        data: {
          groupId,
          adminUserId,
          delegateUserId,
          status: 'pending',
          requestedAt: new Date(),
        },
      });

      console.log(`✅ Created delegation request ${delegationRequest.id}`);

      // TODO: Send push notification to delegate user
      // await NotificationService.sendPlaylistDelegationRequest(delegateUserId, group.name);

      res.json({
        success: true,
        delegationRequestId: delegationRequest.id,
        message: `Playlist creation delegated to ${delegateMember.user.displayName}`,
      });
    } catch (error) {
      console.error('Delegate playlist creation error:', error);
      res.status(500).json({ error: 'Failed to delegate playlist creation' });
    }
  }
);

export default router;