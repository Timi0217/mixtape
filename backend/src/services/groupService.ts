import { prisma } from '../config/database';
import { customAlphabet } from '../utils/nanoid';

const generateInviteCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

export interface CreateGroupData {
  name: string;
  adminUserId: string;
  maxMembers?: number;
  isPublic?: boolean;
  emoji?: string;
  backgroundColor?: string;
}

export interface UpdateGroupData {
  name?: string;
  emoji?: string;
  backgroundColor?: string;
  maxMembers?: number;
  isPublic?: boolean;
}

export class GroupService {
  static async createGroup(groupData: CreateGroupData) {
    const inviteCode = generateInviteCode();
    
    return prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: groupData.name,
          adminUserId: groupData.adminUserId,
          inviteCode,
          maxMembers: groupData.maxMembers || 8,
          isPublic: groupData.isPublic || false,
          emoji: groupData.emoji || '👥',
          backgroundColor: groupData.backgroundColor || '#8B5CF6',
        },
        include: {
          admin: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId: groupData.adminUserId,
        },
      });

      // Create today's daily round immediately for the new group
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const deadlineAt = new Date(today);
      deadlineAt.setHours(23, 0, 0, 0); // 11 PM deadline

      await tx.dailyRound.create({
        data: {
          groupId: group.id,
          date: today,
          deadlineAt,
          status: 'active',
        },
      });

      console.log(`✅ Created daily round for new group: ${group.name}`);

      // Get the full group with members after creating the membership
      return tx.group.findUnique({
        where: { id: group.id },
        include: {
          admin: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
      });
    });
  }

  static async getGroupById(id: string) {
    return prisma.group.findUnique({
      where: { id },
      include: {
        admin: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });
  }

  static async getGroupByInviteCode(inviteCode: string) {
    return prisma.group.findUnique({
      where: { inviteCode },
      include: {
        admin: {
          select: {
            id: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });
  }

  static async joinGroup(inviteCode: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { inviteCode },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });

      if (!group) {
        throw new Error('Invalid invite code');
      }

      if (group._count.members >= group.maxMembers) {
        throw new Error('Group is full');
      }

      const existingMember = await tx.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: group.id,
            userId,
          },
        },
      });

      if (existingMember) {
        throw new Error('User is already a member of this group');
      }

      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId,
        },
      });

      return this.getGroupById(group.id);
    });
  }

  static async leaveGroup(groupId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { id: groupId },
        select: { adminUserId: true },
      });

      if (!group) {
        throw new Error('Group not found');
      }

      if (group.adminUserId === userId) {
        const memberCount = await tx.groupMember.count({
          where: { groupId },
        });

        if (memberCount > 1) {
          throw new Error('Cannot leave group as admin. Transfer ownership first.');
        }
        
        // Delete all group playlists from Spotify/Apple Music before deleting the group
        try {
          const { GroupPlaylistService } = await import('./groupPlaylistService');
          await GroupPlaylistService.deleteAllGroupPlaylists(groupId);
        } catch (playlistError) {
          console.error('❌ Failed to delete group playlists:', playlistError);
          // Continue with group deletion even if playlist deletion fails
        }
        
        await tx.group.delete({
          where: { id: groupId },
        });
        
        return { deleted: true };
      } else {
        await tx.groupMember.delete({
          where: {
            groupId_userId: {
              groupId,
              userId,
            },
          },
        });
        
        return this.getGroupById(groupId);
      }
    });
  }

  static async updateGroup(id: string, updateData: UpdateGroupData, adminUserId: string) {
    const group = await prisma.group.findUnique({
      where: { id },
      select: { adminUserId: true },
    });

    if (!group || group.adminUserId !== adminUserId) {
      throw new Error('Only group admin can update group');
    }

    console.log('Updating group with data:', updateData);

    const updatedGroup = await prisma.group.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        emoji: true,
        backgroundColor: true,
        adminUserId: true,
        inviteCode: true,
        maxMembers: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('Updated group result:', updatedGroup);

    // Return the full updated group data
    const fullGroup = await this.getGroupById(id);
    console.log('Full group after update:', { id: fullGroup?.id, name: fullGroup?.name, emoji: fullGroup?.emoji });
    return fullGroup;
  }

  static async removeGroupMember(groupId: string, memberUserId: string, adminUserId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { adminUserId: true },
    });

    if (!group || group.adminUserId !== adminUserId) {
      throw new Error('Only group admin can remove members');
    }

    if (memberUserId === adminUserId) {
      throw new Error('Admin cannot remove themselves');
    }

    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: memberUserId,
        },
      },
    });

    return this.getGroupById(groupId);
  }

  static async getUserGroups(userId: string) {
    return prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            admin: {
              select: {
                id: true,
                displayName: true,
              },
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    email: true,
                  },
                },
              },
            },
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
      },
    });
  }

  static async generateNewInviteCode(groupId: string, adminUserId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { adminUserId: true },
    });

    if (!group || group.adminUserId !== adminUserId) {
      throw new Error('Only group admin can generate new invite code');
    }

    const newInviteCode = generateInviteCode();

    return prisma.group.update({
      where: { id: groupId },
      data: { inviteCode: newInviteCode },
      select: { inviteCode: true },
    });
  }

  static async searchPublicGroups(searchQuery: string, userId: string) {
    return prisma.group.findMany({
      where: {
        AND: [
          {
            name: {
              contains: searchQuery,
              mode: 'insensitive',
            },
          },
          {
            isPublic: true, // Only show public groups
          },
          {
            NOT: {
              members: {
                some: {
                  userId: userId, // Don't show groups user is already in
                },
              },
            },
          },
        ],
      },
      include: {
        admin: {
          select: {
            id: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: [
        { name: 'asc' },
      ],
      take: 20, // Limit results
    });
  }

  static async joinGroupById(groupId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { id: groupId },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });

      if (!group) {
        throw new Error('Group not found');
      }

      if (!group.isPublic) {
        throw new Error('This group is not public and requires an invite');
      }

      if (group._count.members >= group.maxMembers) {
        throw new Error('Group is full');
      }

      const existingMember = await tx.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: group.id,
            userId,
          },
        },
      });

      if (existingMember) {
        throw new Error('User is already a member of this group');
      }

      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId,
        },
      });

      return this.getGroupById(group.id);
    });
  }
}