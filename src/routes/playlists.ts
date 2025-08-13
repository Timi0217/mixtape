import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../utils/validation';
import { PlaylistService } from '../services/playlistService';

const router = express.Router();

router.post('/create',
  authenticateToken,
  [
    body('name').isString().isLength({ min: 1, max: 100 }).trim(),
    body('description').optional().isString().isLength({ max: 500 }).trim(),
    body('platforms').isArray().custom((platforms) => {
      const validPlatforms = ['spotify', 'apple-music', 'youtube-music'];
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

router.get('/',
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      // TODO: Implement getUserPlaylists method
      const playlists = []; // Placeholder

      res.json({
        playlists,
        total: playlists.length,
      });
    } catch (error) {
      console.error('Get user playlists error:', error);
      res.status(500).json({ error: 'Failed to get user playlists' });
    }
  }
);

export default router;