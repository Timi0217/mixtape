import { prisma } from '../config/database';

export interface CreateSubmissionData {
  roundId: string;
  userId: string;
  songId: string;
  comment?: string;
}

export interface DailyRoundStatus {
  id: string;
  date: Date;
  deadlineAt: Date;
  status: string;
  totalMembers: number;
  submissionCount: number;
  submissions: {
    user: {
      id: string;
      displayName: string;
    };
    song: {
      title: string;
      artist: string;
    };
    submittedAt: Date;
    comment?: string;
  }[];
  missingSubmissions: {
    id: string;
    displayName: string;
  }[];
}

export class SubmissionService {
  static async getCurrentRound(groupId: string): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let round = await prisma.dailyRound.findUnique({
      where: {
        groupId_date: {
          groupId,
          date: today,
        },
      },
    });

    if (!round) {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            include: {
              user: {
                select: { timezone: true },
              },
            },
          },
        },
      });

      if (!group) {
        throw new Error('Group not found');
      }

      const deadlineAt = new Date(today);
      deadlineAt.setHours(23, 0, 0, 0);

      round = await prisma.dailyRound.create({
        data: {
          groupId,
          date: today,
          deadlineAt,
          status: 'active',
        },
      });
    }

    return round;
  }

  static async getRoundStatus(roundId: string): Promise<DailyRoundStatus> {
    const round = await prisma.dailyRound.findUnique({
      where: { id: roundId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
        submissions: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
              },
            },
            song: {
              select: {
                title: true,
                artist: true,
                album: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!round) {
      throw new Error('Round not found');
    }

    const totalMembers = round.group.members.length;
    const submissionCount = round.submissions.length;

    const submittedUserIds = new Set(round.submissions.map(s => s.userId));
    const missingSubmissions = round.group.members
      .filter(member => !submittedUserIds.has(member.userId))
      .map(member => ({
        id: member.user.id,
        displayName: member.user.displayName,
      }));

    return {
      id: round.id,
      date: round.date,
      deadlineAt: round.deadlineAt,
      status: round.status,
      totalMembers,
      submissionCount,
      submissions: round.submissions.map(s => ({
        user: s.user,
        song: s.song,
        submittedAt: s.submittedAt,
        comment: s.comment || undefined,
      })),
      missingSubmissions,
    };
  }

  static async submitSong(submissionData: CreateSubmissionData) {
    const round = await prisma.dailyRound.findUnique({
      where: { id: submissionData.roundId },
    });

    if (!round) {
      throw new Error('Round not found');
    }

    if (new Date() > round.deadlineAt) {
      throw new Error('Submission deadline has passed');
    }

    if (round.status !== 'active') {
      throw new Error('Round is not active');
    }

    const existingSubmission = await prisma.submission.findUnique({
      where: {
        roundId_userId: {
          roundId: submissionData.roundId,
          userId: submissionData.userId,
        },
      },
    });

    if (existingSubmission) {
      return prisma.submission.update({
        where: { id: existingSubmission.id },
        data: {
          songId: submissionData.songId,
          comment: submissionData.comment,
          submittedAt: new Date(),
        },
        include: {
          song: true,
          user: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });
    }

    return prisma.submission.create({
      data: submissionData,
      include: {
        song: true,
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
  }

  static async checkDeadlineAndUpdateStatus() {
    const now = new Date();
    
    const activeRounds = await prisma.dailyRound.findMany({
      where: {
        status: 'active',
        deadlineAt: {
          lte: now,
        },
      },
      include: {
        group: {
          include: {
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    const updates = await Promise.all(
      activeRounds.map(async (round) => {
        const allSubmitted = round._count.submissions === round.group._count.members;
        const newStatus = allSubmitted ? 'completed' : 'failed';

        return prisma.dailyRound.update({
          where: { id: round.id },
          data: { status: newStatus },
        });
      })
    );

    return updates;
  }

  static async getUserSubmissionHistory(userId: string, limit = 10) {
    return prisma.submission.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      take: limit,
      include: {
        song: true,
        round: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  static async getGroupSubmissionHistory(groupId: string, limit = 10) {
    const rounds = await prisma.dailyRound.findMany({
      where: { 
        groupId,
        status: { in: ['completed', 'failed'] },
      },
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        submissions: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
              },
            },
            song: true,
            _count: {
              select: {
                votes: true,
              },
            },
          },
        },
        playlist: {
          select: {
            id: true,
            status: true,
            generatedAt: true,
          },
        },
      },
    });

    // Add vote counts to submissions
    const roundsWithVoteCounts = rounds.map(round => ({
      ...round,
      submissions: round.submissions.map(submission => ({
        ...submission,
        voteCount: submission._count.votes,
      })),
    }));

    return roundsWithVoteCounts;
  }
}