import { MarketplaceRepository } from "@/lib/repositories/MarketplaceRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import { NotificationRepository } from "@/lib/repositories/NotificationRepository";
import { SavedListingRepository } from "@/lib/repositories/SavedListingRepository";
import { EscrowService } from "@/lib/services/EscrowService";
import { BidService } from "@/lib/services/BidService";
import { supabase } from "@/lib/supabase";
import type {
  MarketplacePost,
  MarketplacePostStatus,
  MarketplaceListingType,
} from "@/types";

export class MarketplaceService {
  private repo = new MarketplaceRepository();
  private userRepo = new UserRepository();
  private notifRepo = new NotificationRepository();
  private savedRepo = new SavedListingRepository();
  private escrow = new EscrowService();
  private bidService = new BidService();

  // ── Browse ──

  async findAll(
    filter?: {
      status?: MarketplacePostStatus;
      listingType?: MarketplaceListingType;
      search?: string;
      sort?: "newest" | "highest_points" | "lowest_price" | "ending_soon";
    },
    page?: number,
    pageSize?: number
  ): Promise<{ data: MarketplacePost[]; total: number }> {
    await this.checkAndCompleteExpiredAuctions();
    return this.repo.findAll(filter, page, pageSize);
  }

  async findById(
    id: string
  ): Promise<{ success: MarketplacePost } | { error: string }> {
    await this.checkAndCompleteExpiredAuctions();
    const post = await this.repo.findById(id);
    if (!post) return { error: "Listing not found" };
    return { success: post };
  }

  async findByUser(userId: string): Promise<MarketplacePost[]> {
    return this.repo.findByUser(userId);
  }

  async findByBuyer(userId: string): Promise<MarketplacePost[]> {
    return this.repo.findByBuyer(userId);
  }

  // ── Create Listing ──

  async create(
    userId: string,
    data: {
      points_amount: number;
      asking_price: number;
      payment_method?: string;
      description?: string;
      listing_type: MarketplaceListingType;
      starting_bid?: number;
      min_increment?: number;
      end_time?: string;
      reserve_price?: number;
    }
  ): Promise<{ success: MarketplacePost } | { error: string }> {
    const user = await this.userRepo.findById(userId);
    if (!user) return { error: "User not found" };

    if (data.points_amount <= 0) {
      return { error: "Points must be greater than zero" };
    }

    const available = user.points - (user.reserved_points || 0);
    if (data.points_amount > available) {
      return { error: "You cannot list more points than you have available" };
    }

    if (data.listing_type === "fixed_price") {
      if (!data.asking_price || data.asking_price <= 0) {
        return { error: "Price must be greater than zero" };
      }
      if (!data.payment_method?.trim()) {
        return { error: "Payment method is required for fixed price listings" };
      }
    }

    if (data.listing_type === "auction") {
      if (!data.starting_bid || data.starting_bid <= 0) {
        return { error: "Starting bid must be greater than zero" };
      }
      if (!data.min_increment || data.min_increment <= 0) {
        return { error: "Minimum increment must be greater than zero" };
      }
      if (!data.end_time || new Date(data.end_time) <= new Date()) {
        return { error: "End time must be in the future" };
      }
    }

    try {
      const post = await this.repo.create({
        user_id: userId,
        points_amount: data.points_amount,
        asking_price: data.listing_type === "fixed_price" ? data.asking_price : (data.starting_bid || 0),
      payment_method: data.payment_method?.trim() || undefined,
      description: data.description?.trim() || undefined,
      status: "active",
      listing_type: data.listing_type,
      starting_bid: data.starting_bid || undefined,
      min_increment: data.min_increment || undefined,
      end_time: data.end_time || undefined,
      reserve_price: data.reserve_price || undefined,
      });

      const reserveResult = await this.escrow.reserve(
        userId,
        data.points_amount,
        post.id,
        `Points reserved for ${data.listing_type === "fixed_price" ? "fixed price listing" : "auction"}`
      );

      if ("error" in reserveResult) {
        await this.repo.delete(post.id);
        return { error: reserveResult.error };
      }

      return { success: post };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create listing";
      return { error: message };
    }
  }

  // ── Buy Now (Fixed Price) ──

  async buyNow(
    listingId: string,
    buyerId: string
  ): Promise<{ success: { transaction_id: string } } | { error: string }> {
    const listing = await this.repo.findById(listingId);
    if (!listing) return { error: "Listing not found" };
    if (listing.listing_type !== "fixed_price") return { error: "Listing is not fixed price" };
    if (listing.status !== "active") return { error: "Listing is not available" };
    if (listing.user_id === buyerId) return { error: "Cannot buy your own listing" };

    const { data, error } = await supabase.rpc("complete_fixed_price_purchase", {
      p_listing_id: listingId,
      p_buyer_id: buyerId,
    });

    if (error) return { error: error.message };
    const result = data as { success: boolean; error?: string; transaction_id?: string };
    if (!result.success) return { error: result.error || "Purchase failed" };

    try {
      await this.notifRepo.create({
        user_id: listing.user_id,
        type: "marketplace_sold",
        title: "Your listing has been sold!",
        body: `Your ${listing.points_amount.toLocaleString()} point listing was purchased.`,
        data: { listing_id: listingId, transaction_id: result.transaction_id },
      });

      await this.notifRepo.create({
        user_id: buyerId,
        type: "marketplace_bought",
        title: "Purchase successful!",
        body: `You purchased ${listing.points_amount.toLocaleString()} points.`,
        data: { listing_id: listingId, transaction_id: result.transaction_id },
      });
    } catch {}

    return { success: { transaction_id: result.transaction_id || "" } };
  }

  // ── Cancel Listing ──

  async cancel(
    listingId: string,
    userId: string
  ): Promise<{ success: true } | { error: string }> {
    const listing = await this.repo.findById(listingId);
    if (!listing) return { error: "Listing not found" };
    if (listing.user_id !== userId) return { error: "You can only cancel your own listings" };
    if (listing.status !== "active") return { error: "Listing is not active" };
    if (listing.listing_type === "auction") {
      const bids = await this.bidService.getBids(listingId);
      if (bids.length > 0) return { error: "Cannot cancel an auction with active bids" };
    }

    try {
      await this.repo.update(listingId, { status: "cancelled" });

      await this.escrow.release(
        userId,
        listing.points_amount,
        listingId,
        "Points released from cancelled listing"
      );

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel listing";
      return { error: message };
    }
  }

  // ── Update Listing ──

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
    if (post.user_id !== userId) return { error: "You can only edit your own listings" };
    if (post.status !== "active") return { error: "Cannot edit a non-active listing" };

    if (data.points_amount !== undefined && data.points_amount <= 0) {
      return { error: "Points must be greater than zero" };
    }
    if (data.asking_price !== undefined && data.asking_price <= 0) {
      return { error: "Price must be greater than zero" };
    }

    if (post.listing_type === "auction") {
      const bids = await this.bidService.getBids(postId);
      if (bids.length > 0) {
        if (data.points_amount !== undefined || data.asking_price !== undefined) {
          return { error: "Cannot change points or price once bids have been placed" };
        }
      }
    }

    try {
      const updated = await this.repo.update(postId, data);
      return { success: updated };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update listing";
      return { error: message };
    }
  }

  // ── Delete Listing ──

  async delete(
    postId: string,
    userId: string
  ): Promise<{ success: true } | { error: string }> {
    const post = await this.repo.findById(postId);
    if (!post) return { error: "Listing not found" };
    if (post.user_id !== userId) return { error: "You can only delete your own listings" };
    if (post.status === "active") return { error: "Cannot delete an active listing. Cancel it first." };

    try {
      await this.escrow.release(userId, post.points_amount, postId, "Points released from deleted listing");
      await this.repo.delete(postId);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete listing";
      return { error: message };
    }
  }

  // ── Expired Auctions ──

  async checkAndCompleteExpiredAuctions(): Promise<void> {
    const expired = await this.repo.findActiveAuctions();
    for (const listing of expired) {
      const { data, error } = await supabase.rpc("complete_auction", {
        p_listing_id: listing.id,
      });
      if (error) continue;
      const result = data as {
        success: boolean;
        status?: string;
        reason?: string;
        winner_id?: string;
        winning_bid?: number;
      };

      if (!result.success) continue;

      if (result.status === "expired") {
        try {
          await this.notifRepo.create({
            user_id: listing.user_id,
            type: "marketplace_auction_ended",
            title: "Your auction has ended",
            body: result.reason === "no_bids"
              ? "Your auction ended with no bids."
              : "Your auction ended without meeting the reserve price.",
            data: { listing_id: listing.id },
          });
        } catch {}
      } else if (result.winner_id) {
        try {
          await this.notifRepo.create({
            user_id: listing.user_id,
            type: "marketplace_sold",
            title: "Your auction has ended with a sale!",
            body: `Your auction sold for ${result.winning_bid?.toLocaleString()} points.`,
            data: { listing_id: listing.id },
          });

          await this.notifRepo.create({
            user_id: result.winner_id,
            type: "marketplace_auction_won",
            title: "You won the auction!",
            body: `You won the auction for ${listing.points_amount.toLocaleString()} points with a bid of ${result.winning_bid?.toLocaleString()}.`,
            data: { listing_id: listing.id, winning_bid: result.winning_bid },
          });
        } catch {}
      }
    }
  }

  // ── Saved Listings ──

  async toggleSave(
    userId: string,
    listingId: string
  ): Promise<{ success: boolean; saved: boolean } | { error: string }> {
    const listing = await this.repo.findById(listingId);
    if (!listing) return { error: "Listing not found" };

    const isSaved = await this.savedRepo.isSaved(userId, listingId);
    if (isSaved) {
      await this.savedRepo.unsave(userId, listingId);
      return { success: true, saved: false };
    } else {
      await this.savedRepo.save(userId, listingId);
      return { success: true, saved: true };
    }
  }

  async getSavedListings(userId: string): Promise<MarketplacePost[]> {
    return this.savedRepo.findByUser(userId);
  }

  async isSaved(userId: string, listingId: string): Promise<boolean> {
    return this.savedRepo.isSaved(userId, listingId);
  }
}
