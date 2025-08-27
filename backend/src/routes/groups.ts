import express from 'express';
import { body, param, query } from 'express-validator';
import { GroupService } from '../services/groupService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../utils/validation';
import { prisma } from '../config/database';

const router = express.Router();

router.post('/',
  authenticateToken,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('maxMembers').optional().isInt({ min: 3, max: 20 }),
    body('isPublic').optional().isBoolean(),
    body('emoji').optional().isString().isLength({ min: 1, max: 10 }),
    body('backgroundColor').optional().isString().matches(/^#[0-9A-Fa-f]{6}$/),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { name, maxMembers, isPublic, emoji, backgroundColor } = req.body;

      const group = await GroupService.createGroup({
        name,
        adminUserId: req.user!.id,
        maxMembers,
        isPublic,
        emoji,
        backgroundColor,
      });

      res.status(201).json({ group });
    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({ error: 'Failed to create group' });
    }
  }
);

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const groups = await GroupService.getUserGroups(req.user!.id);
    res.json({ groups });
  } catch (error) {
    console.error('Get user groups error:', error);
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

router.get('/search',
  authenticateToken,
  [
    query('q').isString().isLength({ min: 1 }),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { q } = req.query;
      const groups = await GroupService.searchPublicGroups(q as string, req.user!.id);
      res.json({ groups });
    } catch (error) {
      console.error('Search groups error:', error);
      res.status(500).json({ error: 'Failed to search groups' });
    }
  }
);

router.get('/:id',
  authenticateToken,
  [
    param('id').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const group = await GroupService.getGroupById(id);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      const isMember = group.members.some(member => member.userId === req.user!.id);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({ group });
    } catch (error) {
      console.error('Get group error:', error);
      res.status(500).json({ error: 'Failed to get group' });
    }
  }
);

router.post('/join',
  authenticateToken,
  [
    body('inviteCode').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { inviteCode } = req.body;

      const group = await GroupService.joinGroup(inviteCode, req.user!.id);
      
      res.json({ group });
    } catch (error) {
      console.error('Join group error:', error);
      
      if (error instanceof Error) {
        const status = error.message.includes('Invalid invite code') ? 404 :
                      error.message.includes('full') ? 400 :
                      error.message.includes('already a member') ? 400 : 500;
        
        return res.status(status).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to join group' });
    }
  }
);

router.post('/:id/join',
  authenticateToken,
  [
    param('id').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const group = await GroupService.joinGroupById(id, req.user!.id);
      
      res.json({ group });
    } catch (error) {
      console.error('Join group by ID error:', error);
      
      if (error instanceof Error) {
        const status = error.message.includes('not found') ? 404 :
                      error.message.includes('not public') ? 403 :
                      error.message.includes('full') ? 400 :
                      error.message.includes('already a member') ? 400 : 500;
        
        return res.status(status).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to join group' });
    }
  }
);

// Simple in-memory cache to prevent duplicate requests
const playlistUpdateCache = new Map();

// Test endpoint to debug request reception
router.post('/:id/debug-update',
  authenticateToken,
  [
    param('id').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    console.log(`🔍 DEBUG: Request received for group ${req.params.id} from user ${req.user?.id}`);
    res.json({ debug: true, message: 'Request received successfully' });
  }
);

// Force update playlist names to match current group name
router.post('/:id/update-playlist-names',
  authenticateToken,
  [
    param('id').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🔍 UPDATE NAMES: Request received for group ${id} from user ${userId}`);

      // Check if there's already a request in progress for this group
      const cacheKey = `${id}-${userId}`;
      if (playlistUpdateCache.has(cacheKey)) {
        console.log(`⚠️ Duplicate playlist update request for group ${id}, returning cached response`);
        return res.status(429).json({ 
          error: 'Request already in progress',
          message: 'Please wait for the current update to complete'
        });
      }

      // Mark request as in progress
      playlistUpdateCache.set(cacheKey, Date.now());

      // Verify user is admin of this group
      const group = await prisma.group.findFirst({
        where: {
          id,
          adminUserId: userId,
        },
      });

      if (!group) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You must be the admin of this group to update playlist names'
        });
      }

      // Force update playlist names to match current group name
      console.log(`🔄 Manual force update requested for group: ${group.name} (ID: ${id})`);
      console.log(`📊 Group details:`, {
        name: group.name,
        id: group.id,
        adminUserId: group.adminUserId,
        createdAt: group.createdAt
      });
      
      const { GroupPlaylistService } = await import('../services/groupPlaylistService');
      await GroupPlaylistService.updateAllPlaylistNames(id, group.name);
      console.log(`✅ Manual force update completed for group: ${group.name}`);

      res.json({
        success: true,
        message: `Playlist names updated to match group name: ${group.name}`,
      });
    } catch (error) {
      console.error('❌ FORCE UPDATE PLAYLIST NAMES ERROR:', error);
      res.status(500).json({ 
        error: 'Failed to update playlist names',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      // Clean up cache entry
      const cacheKey = `${req.params.id}-${req.user?.id}`;
      playlistUpdateCache.delete(cacheKey);
      
      // Also clean up old cache entries (older than 5 minutes)
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      for (const [key, timestamp] of playlistUpdateCache.entries()) {
        if (timestamp < fiveMinutesAgo) {
          playlistUpdateCache.delete(key);
        }
      }
    }
  }
);

router.post('/:id/leave',
  authenticateToken,
  [
    param('id').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const result = await GroupService.leaveGroup(id, req.user!.id);
      
      if ('deleted' in result && result.deleted) {
        res.json({ message: 'Group deleted successfully' });
      } else {
        res.json({ group: result });
      }
    } catch (error) {
      console.error('Leave group error:', error);
      
      if (error instanceof Error) {
        const status = error.message.includes('not found') ? 404 :
                      error.message.includes('Transfer ownership') ? 400 : 500;
        
        return res.status(status).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to leave group' });
    }
  }
);

router.put('/:id',
  authenticateToken,
  [
    param('id').isString().notEmpty(),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('emoji').optional().isString().isLength({ min: 1, max: 10 }),
    body('backgroundColor').optional().isString().matches(/^#[0-9A-Fa-f]{6}$/),
    body('maxMembers').optional().isInt({ min: 3, max: 20 }),
    body('isPublic').optional().isBoolean(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { name, emoji, backgroundColor, maxMembers, isPublic } = req.body;

      // Get original group data first to compare names
      const originalGroup = await prisma.group.findUnique({
        where: { id },
        select: { name: true }
      });


      const group = await GroupService.updateGroup(id, { name, emoji, backgroundColor, maxMembers, isPublic }, req.user!.id);
      
      // Note: Playlist names are NOT automatically updated when group name changes
      // Users must manually use the "Update Names" button in the playlist section
      if (name && originalGroup && name !== originalGroup.name) {
        console.log(`ℹ️ Group name changed from "${originalGroup.name}" to "${name}". Playlist names will need to be updated manually.`);
      }
      
      res.json({ group });
    } catch (error) {
      console.error('Update group error:', error);
      
      if (error instanceof Error && error.message.includes('Only group admin')) {
        return res.status(403).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to update group' });
    }
  }
);

router.delete('/:id/members/:memberId',
  authenticateToken,
  [
    param('id').isString().notEmpty(),
    param('memberId').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { id, memberId } = req.params;

      const group = await GroupService.removeGroupMember(id, memberId, req.user!.id);
      
      res.json({ group });
    } catch (error) {
      console.error('Remove member error:', error);
      
      if (error instanceof Error) {
        const status = error.message.includes('Only group admin') ? 403 :
                      error.message.includes('cannot remove themselves') ? 400 : 500;
        
        return res.status(status).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

router.post('/:id/invite-code',
  authenticateToken,
  [
    param('id').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const result = await GroupService.generateNewInviteCode(id, req.user!.id);
      
      res.json({ inviteCode: result.inviteCode });
    } catch (error) {
      console.error('Generate invite code error:', error);
      
      if (error instanceof Error && error.message.includes('Only group admin')) {
        return res.status(403).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to generate new invite code' });
    }
  }
);

router.get('/invite/:inviteCode',
  [
    param('inviteCode').isString().notEmpty(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { inviteCode } = req.params;

      const group = await GroupService.getGroupByInviteCode(inviteCode);
      if (!group) {
        return res.status(404).json({ error: 'Invalid invite code' });
      }

      res.json({
        group: {
          id: group.id,
          name: group.name,
          admin: group.admin,
          memberCount: group._count.members,
          maxMembers: group.maxMembers,
        },
      });
    } catch (error) {
      console.error('Get group by invite code error:', error);
      res.status(500).json({ error: 'Failed to get group information' });
    }
  }
);

// Get playlist permissions for a group
router.get('/:id/playlist-permissions',
  authenticateToken,
  [
    param('id').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Verify user is admin of this group
      const group = await prisma.group.findFirst({
        where: {
          id,
          adminUserId: userId,
        },
      });

      if (!group) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only group admins can view playlist permissions'
        });
      }

      // Get playlist permissions from database
      const permissions = await prisma.playlistPermission.findMany({
        where: {
          groupId: id,
        },
        select: {
          userId: true,
          canCreatePlaylists: true,
        },
      });

      // Convert to object format expected by frontend
      const permissionsObj = permissions.reduce((acc, perm) => {
        acc[perm.userId] = perm.canCreatePlaylists;
        return acc;
      }, {} as Record<string, boolean>);

      res.json({ permissions: permissionsObj });
    } catch (error) {
      console.error('Get playlist permissions error:', error);
      res.status(500).json({ error: 'Failed to get playlist permissions' });
    }
  }
);

// Set playlist permission for a user in a group
router.put('/:id/playlist-permissions',
  authenticateToken,
  [
    param('id').isString().notEmpty(),
    body('userId').isString().notEmpty(),
    body('canCreatePlaylists').isBoolean(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { userId, canCreatePlaylists } = req.body;
      const adminUserId = req.user!.id;

      // Verify admin is admin of this group
      const group = await prisma.group.findFirst({
        where: {
          id,
          adminUserId,
        },
        include: {
          members: {
            select: {
              userId: true,
            },
          },
        },
      });

      if (!group) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Only group admins can modify playlist permissions'
        });
      }

      // Verify target user is a member of this group
      const isMember = group.members.some(member => member.userId === userId);
      if (!isMember) {
        return res.status(400).json({ 
          error: 'User not found',
          message: 'User is not a member of this group'
        });
      }

      // Upsert playlist permission
      await prisma.playlistPermission.upsert({
        where: {
          groupId_userId: {
            groupId: id,
            userId,
          },
        },
        update: {
          canCreatePlaylists,
        },
        create: {
          groupId: id,
          userId,
          canCreatePlaylists,
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Set playlist permission error:', error);
      res.status(500).json({ error: 'Failed to set playlist permission' });
    }
  }
);

export default router;