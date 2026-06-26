import { NotificationRepository } from "@/lib/repositories/NotificationRepository";
import { RedeemRepository } from "@/lib/repositories/RedeemRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import type { RedeemRequest } from "@/types";

export class RedeemService {
  private redeemRepo = new RedeemRepository();
  private userRepo = new UserRepository();
  private notifRepo = new NotificationRepository();

  async createRequest(
    userId: string,
    points: number
  ): Promise<{ success: true } | { error: string }> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      return { error: "User not found" };
    }

    const existing = await this.redeemRepo.findExistingPending(user.id);
    if (existing) {
      return { error: "You already have a pending request" };
    }

    try {
      await this.redeemRepo.create({
        user_id: user.id,
        points_used: points,
        minutes: points / 2.5,
        status: "pending",
      });
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create request";
      return { error: message };
    }
  }

  async getPending(page?: number, pageSize?: number): Promise<{ data: RedeemRequest[]; total: number }> {
    return this.redeemRepo.findPending(page, pageSize);
  }

  async approve(
    requestId: string
  ): Promise<{ success: true } | { error: string }> {
    const request = await this.redeemRepo.findById(requestId);

    if (!request) {
      return { error: "Request not found" };
    }

    if (request.status !== "pending") {
      return { error: "Already processed" };
    }

    const user = await this.userRepo.findById(request.user_id);
    if (!user) {
      return { error: "User not found" };
    }

    const newPoints = user.points - request.points_used;
    await this.userRepo.updatePointsById(user.id, newPoints);

    const convertPointsToMinutes = (p: number) =>
      Math.round(0.004666 * p * p - 0.03333 * p + 6.8);
    convertPointsToMinutes(request.points_used);

    await this.redeemRepo.updateStatus(requestId, "approved");

    try {
      await this.notifRepo.create({
        user_id: request.user_id,
        type: "redeem_approved",
        title: "Redeem request approved!",
        body: `${request.points_used} points have been deducted.`,
        data: { request_id: requestId, points_used: request.points_used },
      });
    } catch {}

    return { success: true };
  }
}
