import { NotificationRepository } from "@/lib/repositories/NotificationRepository";
import type { AppNotification } from "@/types";

export class NotificationService {
  private notifRepo = new NotificationRepository();

  async getNotifications(
    userId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ data: AppNotification[]; total: number }> {
    return this.notifRepo.findByUser(userId, page, pageSize);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifRepo.findUnreadCount(userId);
  }

  async markRead(
    notificationId: string,
    userId: string
  ): Promise<{ success: true } | { error: string }> {
    const notif = await this.notifRepo.findById(notificationId);
    if (!notif) return { error: "Notification not found" };
    if (notif.user_id !== userId) return { error: "Unauthorized" };

    await this.notifRepo.markRead(notificationId);
    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ success: true } | { error: string }> {
    await this.notifRepo.markAllRead(userId);
    return { success: true };
  }
}
