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

      // Verify user is admin of this group
      const group = await prisma.group.findFirst({
        where: {
          id: groupId,
          adminUserId: userId,
        },
      });

      if (!group) {
        return res.status(403).json({ error: 'Not admin of this group' });
      }

      // Create group playlists
      const groupPlaylists = await GroupPlaylistService.ensureGroupPlaylists(groupId);

      res.json({
        success: true,
        groupPlaylists,
        message: 'Group playlists created successfully',
      });
    } catch (error) {
      console.error('Create group playlists error:', error);
      res.status(500).json({ error: 'Failed to create group playlists' });
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

      // Verify user is a member of this group
      const groupMember = await prisma.groupMember.findFirst({
        where: {
          groupId,
          userId,
        },
      });

      if (!groupMember) {
        return res.status(403).json({ error: 'Not a member of this group' });
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

      res.json({
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
      });
    } catch (error) {
      console.error('Get group playlists error:', error);
      res.status(500).json({ error: 'Failed to get group playlists' });
    }
  }
);

// Get all playlists for user's groups
router.get('/',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;

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
      });
    } catch (error) {
      console.error('Get user playlists error:', error);
      res.status(500).json({ error: 'Failed to get user playlists' });
    }
  }
);

export default router;