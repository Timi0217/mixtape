import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../utils/validation';
import { playlistService } from '../services/playlistService';

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

      const result = await playlistService.createCrossPlatformPlaylist(
        req.user!.id,
        {
          name,
          description,
          platforms,
          songs,
          isPublic,
        }
      );

      res.json({
        success: true,
        playlistId: result.playlistId,
        results: result.results,
        successfulPlatforms: result.results.filter(r => r.success).length,
        totalPlatforms: platforms.length,
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

      const playlist = await playlistService.getPlaylistById(id);

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
      const playlists = await playlistService.getUserPlaylists(req.user!.id);

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