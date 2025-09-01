import express from 'express';
import { body, param, query } from 'express-validator';
import { SubmissionService } from '../services/submissionService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../utils/validation';
import { checkUsageLimit, trackUsage } from '../middleware/subscription';

const router = express.Router();

router.get('/groups/:groupId/current',
  authenticateToken,
  [
    param('groupId').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { groupId } = req.params;
      console.log(`Attempting to get current round for group: ${groupId}`);

      const round = await SubmissionService.getCurrentRound(groupId);
      console.log(`Successfully got round:`, round);
      
      const status = await SubmissionService.getRoundStatus(round.id);
      console.log(`Successfully got status:`, status);
      
      res.json({ round: status });
    } catch (error) {
      console.error('Get current round error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to get current round', details: error.message });
    }
  }
);

router.post('/',
  authenticateToken,
  checkUsageLimit('songShared'),
  [
    body('roundId').isString().notEmpty(),
    body('songId').isString().notEmpty(),
    body('comment').optional().trim().isLength({ max: 200 }),
  ],
  validateRequest,
  trackUsage('songShared'),
  async (req: AuthRequest, res) => {
    try {
      const { roundId, songId, comment } = req.body;

      const submission = await SubmissionService.submitSong({
        roundId,
        userId: req.user!.id,
        songId,
        comment,
      });

      res.json({ submission });
    } catch (error) {
      console.error('Submit song error:', error);
      
      if (error instanceof Error) {
        const status = error.message.includes('not found') ? 404 :
                      error.message.includes('deadline') ? 400 :
                      error.message.includes('not active') ? 400 : 500;
        
        return res.status(status).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to submit song' });
    }
  }
);

router.get('/rounds/:roundId/status',
  authenticateToken,
  [
    param('roundId').isString().notEmpty(),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { roundId } = req.params;

      const status = await SubmissionService.getRoundStatus(roundId);
      
      res.json({ round: status });
    } catch (error) {
      console.error('Get round status error:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Failed to get round status' });
    }
  }
);

router.get('/history',
  authenticateToken,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const history = await SubmissionService.getUserSubmissionHistory(req.user!.id, limit);
      
      res.json({ submissions: history });
    } catch (error) {
      console.error('Get submission history error:', error);
      res.status(500).json({ error: 'Failed to get submission history' });
    }
  }
);

router.get('/groups/:groupId/history',
  authenticateToken,
  [
    param('groupId').isString().notEmpty(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validateRequest,
  async (req: AuthRequest, res) => {
    try {
      const { groupId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      console.log(`Getting group submission history for group: ${groupId}, limit: ${limit}`);

      const history = await SubmissionService.getGroupSubmissionHistory(groupId, limit);
      console.log(`Successfully got history:`, history?.length, 'rounds');
      
      res.json({ rounds: history });
    } catch (error) {
      console.error('Get group submission history error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', error.message);
      res.status(500).json({ error: 'Failed to get group submission history', details: error.message });
    }
  }
);

export default router;