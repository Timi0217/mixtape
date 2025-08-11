import { prisma } from '../config/database';
import { customAlphabet } from '../utils/nanoid';

const generateInviteCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

export interface CreateGroupData {
  name: string;
  adminUserId: string;
  maxMembers?: number;
}

export interface UpdateGroupData {
  name?: string;
  maxMembers?: number;
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

    return prisma.group.update({
      where: { id },
      data: updateData,
    });
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
}