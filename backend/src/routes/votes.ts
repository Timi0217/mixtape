import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../utils/validation';
import { prisma } from '../config/database';

const router = express.Router();

// Submit a vote for a submission in a round
router.post('/', authenticateToken, [
  body('roundId').isString().notEmpty(),
  body('submissionId').isString().notEmpty(),
], validateRequest, async (req: AuthRequest, res) => {
  try {
    const { roundId, submissionId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }


    // Verify the round exists and is completed
    const round = await prisma.dailyRound.findUnique({
      where: { id: roundId },
      include: {
        group: {
          include: {
            members: true
          }
        },
        submissions: {
          include: {
            user: true,
            song: true
          }
        }
      }
    });

    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    if (round.status !== 'completed') {
      return res.status(400).json({ error: 'Can only vote on completed rounds' });
    }

    // Check if this is the most recent completed round (only allow voting on latest)
    const mostRecentCompletedRound = await prisma.dailyRound.findFirst({
      where: {
        groupId: round.groupId,
        status: 'completed'
      },
      orderBy: { date: 'desc' }
    });

    if (!mostRecentCompletedRound || mostRecentCompletedRound.id !== roundId) {
      return res.status(400).json({ 
        error: 'Voting is only allowed on the most recent completed mixtape' 
      });
    }

    // Verify user is a member of the group
    const isMember = round.group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'You must be a member of this group to vote' });
    }

    // Verify the submission exists and belongs to this round
    const submission = round.submissions.find(s => s.id === submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found in this round' });
    }

    // Prevent users from voting for their own submission
    if (submission.userId === userId) {
      return res.status(400).json({ error: 'You cannot vote for your own submission' });
    }

    // Check if user already voted in this round
    const existingVote = await prisma.vote.findUnique({
      where: {
        roundId_userId: {
          roundId,
          userId
        }
      }
    });

    if (existingVote) {
      return res.status(400).json({ error: 'You have already voted in this round' });
    }

    // Create the vote
    const vote = await prisma.vote.create({
      data: {
        roundId,
        userId,
        submissionId
      },
      include: {
        submission: {
          include: {
            user: true,
            song: true
          }
        }
      }
    });


    res.status(201).json({ vote });
  } catch (error) {
    console.error('❌ VOTE SUBMISSION ERROR:', error);
    res.status(500).json({
      error: 'Failed to submit vote',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user's vote for a specific round
router.get('/rounds/:roundId/user', authenticateToken, [
  param('roundId').isString().notEmpty(),
], validateRequest, async (req: AuthRequest, res) => {
  try {
    const { roundId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }


    // Verify the round exists
    const round = await prisma.dailyRound.findUnique({
      where: { id: roundId },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // Verify user is a member of the group
    const isMember = round.group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'You must be a member of this group to view votes' });
    }

    // Get the user's vote
    const vote = await prisma.vote.findUnique({
      where: {
        roundId_userId: {
          roundId,
          userId
        }
      },
      include: {
        submission: {
          include: {
            user: true,
            song: true
          }
        }
      }
    });

    if (!vote) {
      return res.status(404).json({ error: 'No vote found for this round' });
    }


    res.json({ vote });
  } catch (error) {
    console.error('❌ GET USER VOTE ERROR:', error);
    res.status(500).json({
      error: 'Failed to get user vote',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get vote counts for a round (only visible to users who voted, and only after voting ends)
router.get('/rounds/:roundId/counts', authenticateToken, [
  param('roundId').isString().notEmpty(),
], validateRequest, async (req: AuthRequest, res) => {
  try {
    const { roundId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }


    // Verify the round exists
    const round = await prisma.dailyRound.findUnique({
      where: { id: roundId },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // Verify user is a member of the group
    const isMember = round.group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'You must be a member of this group to view votes' });
    }

    // Check if user has voted (required to see results)
    const userVote = await prisma.vote.findUnique({
      where: {
        roundId_userId: {
          roundId,
          userId
        }
      }
    });

    if (!userVote) {
      return res.status(403).json({ error: 'You must vote to see results' });
    }

    // Check if voting period has ended
    const now = new Date();
    const votingEnded = !round.votingEndsAt || now >= round.votingEndsAt;

    if (!votingEnded) {
      return res.json({ 
        voteCounts: [], 
        votingInProgress: true,
        votingEndsAt: round.votingEndsAt 
      });
    }

    // Get vote counts grouped by submission
    const voteCounts = await prisma.vote.groupBy({
      by: ['submissionId'],
      where: {
        roundId
      },
      _count: {
        submissionId: true
      }
    });


    res.json({ 
      voteCounts, 
      votingInProgress: false,
      votingEndsAt: round.votingEndsAt 
    });
  } catch (error) {
    console.error('❌ GET VOTE COUNTS ERROR:', error);
    res.status(500).json({
      error: 'Failed to get vote counts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get voting status for a round (whether voting is still active)
router.get('/rounds/:roundId/status', authenticateToken, [
  param('roundId').isString().notEmpty(),
], validateRequest, async (req: AuthRequest, res) => {
  try {
    const { roundId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify the round exists
    const round = await prisma.dailyRound.findUnique({
      where: { id: roundId },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // Verify user is a member of the group
    const isMember = round.group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'You must be a member of this group to view voting status' });
    }

    const now = new Date();
    const votingEnded = !round.votingEndsAt || now >= round.votingEndsAt;

    // Check if user has voted
    const userVote = await prisma.vote.findUnique({
      where: {
        roundId_userId: {
          roundId,
          userId
        }
      }
    });

    res.json({ 
      votingEnded,
      votingEndsAt: round.votingEndsAt,
      userHasVoted: !!userVote,
      canVote: round.status === 'completed' && !votingEnded && !userVote
    });
  } catch (error) {
    console.error('❌ GET VOTING STATUS ERROR:', error);
    res.status(500).json({
      error: 'Failed to get voting status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;