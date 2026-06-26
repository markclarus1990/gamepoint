import { MarketplaceRepository } from "@/lib/repositories/MarketplaceRepository";
import { NotificationRepository } from "@/lib/repositories/NotificationRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import type {
  MarketplacePost,
  MarketplacePostStatus,
} from "@/types";

export class MarketplaceService {
  private repo = new MarketplaceRepository();
  private userRepo = new UserRepository();
  private notifRepo = new NotificationRepository();

  async findAll(
    filter?: {
      status?: MarketplacePostStatus;
      search?: string;
      sort?: "newest" | "highest_points" | "lowest_price";
    },
    page?: number,
    pageSize?: number
  ): Promise<{ data: MarketplacePost[]; total: number }> {
    return this.repo.findAll(filter, page, pageSize);
  }

  async findById(
    id: string
  ): Promise<{ success: MarketplacePost } | { error: string }> {
    const post = await this.repo.findById(id);
    if (!post) return { error: "Listing not found" };
    return { success: post };
  }

  async findByUser(userId: string): Promise<MarketplacePost[]> {
    return this.repo.findByUser(userId);
  }

  async create(
    userId: string,
    data: {
      points_amount: number;
      asking_price: number;
      payment_method: string;
      description?: string;
    }
  ): Promise<{ success: MarketplacePost } | { error: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) return { error: "User not found" };

    if (data.points_amount <= 0) {
      return { error: "Points must be greater than zero" };
    }

    if (data.asking_price <= 0) {
      return { error: "Price must be greater than zero" };
    }

    if (data.points_amount > user.points) {
      return { error: "You cannot list more points than you own" };
    }

    if (!data.payment_method || data.payment_method.trim().length === 0) {
      return { error: "Payment method is required" };
    }

    try {
      const post = await this.repo.create({
        user_id: userId,
        points_amount: data.points_amount,
        asking_price: data.asking_price,
        payment_method: data.payment_method.trim(),
        description: data.description?.trim() || undefined,
        status: "available",
      });
      return { success: post };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create listing";
      return { error: message };
    }
  }

  async update(
    postId: string,
    userId: string,
    data: Partial<{
      points_amount: number;
      asking_price: number;
      payment_method: string;
      description: string;
      status: MarketplacePostStatus;
    }>
  ): Promise<{ success: MarketplacePost } | { error: string }> {
    const post = await this.repo.findById(postId);
    if (!post) return { error: "Listing not found" };

    if (post.user_id !== userId) {
      return { error: "You can only edit your own listings" };
    }

    if (
      data.points_amount !== undefined &&
      data.points_amount <= 0
    ) {
      return { error: "Points must be greater than zero" };
    }

    if (
      data.asking_price !== undefined &&
      data.asking_price <= 0
    ) {
      return { error: "Price must be greater than zero" };
    }

    try {
      const updated = await this.repo.update(postId, data);

      if (data.status && data.status !== post.status) {
        try {
          const title =
            data.status === "reserved"
              ? "Your listing has been marked as reserved"
              : "Your listing has been marked as completed";
          await this.notifRepo.create({
            user_id: post.user_id,
            type: `marketplace_${data.status}`,
            title,
            data: { listing_id: postId },
          });
        } catch {}
      }

      return { success: updated };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update listing";
      return { error: message };
    }
  }

  async delete(
    postId: string,
    userId: string
  ): Promise<{ success: true } | { error: string }> {
    const post = await this.repo.findById(postId);
    if (!post) return { error: "Listing not found" };

    if (post.user_id !== userId) {
      return { error: "You can only delete your own listings" };
    }

    try {
      await this.repo.delete(postId);
      return { success: true };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete listing";
      return { error: message };
    }
  }
}
