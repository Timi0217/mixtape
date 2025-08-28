import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '../config/database';

class PushNotificationService {
  private expo: Expo;

  constructor() {
    this.expo = new Expo();
  }

  async sendNotificationToUser(userId: string, title: string, body: string, data?: any): Promise<boolean> {
    try {
      // Get user's push token
      const userToken = await prisma.userPushToken.findUnique({
        where: { userId },
        include: { user: true },
      });

      if (!userToken || !userToken.isActive) {
        console.log(`No active push token for user ${userId}`);
        return false;
      }

      // Check if push token is valid Expo token
      if (!Expo.isExpoPushToken(userToken.token)) {
        console.error(`Invalid Expo push token for user ${userId}:`, userToken.token);
        return false;
      }

      // Create message
      const message: ExpoPushMessage = {
        to: userToken.token,
        title,
        body,
        data: data || {},
        sound: 'default',
        badge: 1,
      };

      // Send notification
      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Error sending push notification chunk:', error);
        }
      }

      // Log results
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          console.error('Push notification error:', ticket.message);
          if (ticket.details?.error === 'DeviceNotRegistered') {
            // Deactivate invalid token
            await this.deactivateUserToken(userId);
          }
        } else {
          console.log('Push notification sent successfully:', ticket.id);
        }
      }

      return tickets.some(ticket => ticket.status === 'ok');
    } catch (error) {
      console.error('Error in sendNotificationToUser:', error);
      return false;
    }
  }

  async sendNotificationToGroup(groupId: string, title: string, body: string, data?: any): Promise<number> {
    try {
      // Get all members of the group with their push tokens
      const groupMembers = await prisma.groupMember.findMany({
        where: { groupId },
        include: {
          user: {
            include: {
              pushToken: true,
              notificationSettings: true,
            },
          },
        },
      });

      let successCount = 0;
      const messages: ExpoPushMessage[] = [];

      for (const member of groupMembers) {
        const { user } = member;
        
        // Check if user has notifications enabled
        const settings = user.notificationSettings?.settings as any;
        if (settings && !settings.pushNotifications) {
          continue;
        }

        // Check if user has a valid push token
        if (!user.pushToken || !user.pushToken.isActive) {
          continue;
        }

        if (!Expo.isExpoPushToken(user.pushToken.token)) {
          console.error(`Invalid Expo push token for user ${user.id}:`, user.pushToken.token);
          continue;
        }

        messages.push({
          to: user.pushToken.token,
          title,
          body,
          data: { ...data, groupId },
          sound: 'default',
          badge: 1,
        });
      }

      if (messages.length === 0) {
        console.log(`No valid push tokens for group ${groupId}`);
        return 0;
      }

      // Send notifications in chunks
      const chunks = this.expo.chunkPushNotifications(messages);
      
      for (const chunk of chunks) {
        try {
          const tickets = await this.expo.sendPushNotificationsAsync(chunk);
          
          for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            if (ticket.status === 'ok') {
              successCount++;
            } else {
              console.error('Push notification error:', ticket.message);
              if (ticket.details?.error === 'DeviceNotRegistered') {
                // Find the corresponding message and deactivate token
                const message = chunk[i];
                const userToken = await prisma.userPushToken.findFirst({
                  where: { token: message.to as string },
                });
                if (userToken) {
                  await this.deactivateUserToken(userToken.userId);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error sending push notification chunk:', error);
        }
      }

      console.log(`Sent ${successCount} notifications to group ${groupId}`);
      return successCount;
    } catch (error) {
      console.error('Error in sendNotificationToGroup:', error);
      return 0;
    }
  }

  async sendSubmissionReminder(groupId: string): Promise<number> {
    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        console.error(`Group ${groupId} not found`);
        return 0;
      }

      const title = '🎵 Time to submit your song!';
      const body = `Submit your daily song to ${group.name}. Deadline is 11 PM!`;

      return await this.sendNotificationToGroup(groupId, title, body, {
        type: 'submission_reminder',
        groupId,
        groupName: group.name,
      });
    } catch (error) {
      console.error('Error sending submission reminder:', error);
      return 0;
    }
  }

  async sendPlaylistReadyNotification(groupId: string, playlistUrl?: string): Promise<number> {
    try {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        console.error(`Group ${groupId} not found`);
        return 0;
      }

      const title = '🎵 Your playlist is ready!';
      const body = `${group.name}'s collaborative playlist is now available!`;

      return await this.sendNotificationToGroup(groupId, title, body, {
        type: 'playlist_ready',
        groupId,
        groupName: group.name,
        playlistUrl,
      });
    } catch (error) {
      console.error('Error sending playlist ready notification:', error);
      return 0;
    }
  }

  async sendTestNotification(userId: string): Promise<boolean> {
    const title = 'Test Notification';
    const body = 'This is a test notification from Mixtape! 🎵';

    return await this.sendNotificationToUser(userId, title, body, {
      type: 'test',
    });
  }

  private async deactivateUserToken(userId: string): Promise<void> {
    try {
      await prisma.userPushToken.update({
        where: { userId },
        data: { isActive: false },
      });
      console.log(`Deactivated push token for user ${userId}`);
    } catch (error) {
      console.error(`Failed to deactivate push token for user ${userId}:`, error);
    }
  }
}

export default new PushNotificationService();