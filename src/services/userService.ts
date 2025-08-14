import { prisma } from '../config/database';

export interface CreateUserData {
  email: string;
  displayName: string;
  timezone?: string;
}

export interface UpdateUserData {
  displayName?: string;
  timezone?: string;
}

export class UserService {
  static async createUser(userData: CreateUserData) {
    return prisma.user.create({
      data: {
        email: userData.email,
        displayName: userData.displayName,
        timezone: userData.timezone || 'UTC',
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        timezone: true,
        createdAt: true,
      },
    });
  }

  static async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        timezone: true,
        createdAt: true,
        groupMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                adminUserId: true,
              },
            },
          },
        },
      },
    });
  }

  static async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        displayName: true,
        timezone: true,
        createdAt: true,
      },
    });
  }

  static async updateUser(id: string, updateData: UpdateUserData) {
    return prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        displayName: true,
        timezone: true,
        updatedAt: true,
      },
    });
  }

  static async deleteUser(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  static async getUserMusicAccounts(userId: string) {
    return prisma.userMusicAccount.findMany({
      where: { userId },
      select: {
        platform: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  static async addMusicAccount(userId: string, platform: string, accessToken: string, refreshToken?: string, expiresAt?: Date) {
    return prisma.userMusicAccount.upsert({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
      update: {
        accessToken,
        refreshToken,
        expiresAt,
        updatedAt: new Date(),
      },
      create: {
        userId,
        platform,
        accessToken,
        refreshToken,
        expiresAt,
      },
    });
  }

  static async removeMusicAccount(userId: string, platform: string) {
    return prisma.userMusicAccount.delete({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
    });
  }
}