import express from 'express';
import { body, param, query } from 'express-validator';
import { GroupService } from '../services/groupService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../utils/validation';

const router = express.Router();

router.post('/',
  authenticateToken,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('maxMembers').optional().isInt({ min: 3, max: 20 }),
    body('isPublic').optional().isBoolean(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { name, maxMembers, isPublic } = req.body;

      const group = await GroupService.createGroup({
        name,
        adminUserId: req.user!.id,
        maxMembers,
        isPublic,
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
    body('updatePlaylistNames').optional().isBoolean(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { name, emoji, backgroundColor, maxMembers, isPublic, updatePlaylistNames } = req.body;

      const group = await GroupService.updateGroup(id, { name, emoji, backgroundColor, maxMembers, isPublic }, req.user!.id);
      
      // Update playlist names if requested and group name changed
      if (updatePlaylistNames && name && name !== group.name) {
        try {
          const { GroupPlaylistService } = await import('../services/groupPlaylistService');
          await GroupPlaylistService.updateAllPlaylistNames(id, name);
          console.log(`✅ Updated playlist names for group: ${name}`);
        } catch (playlistError) {
          console.warn('⚠️ Failed to update playlist names:', playlistError);
          // Continue anyway - group update succeeded
        }
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

export default router;