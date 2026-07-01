import { BidRepository } from "@/lib/repositories/BidRepository";
import { MarketplaceRepository } from "@/lib/repositories/MarketplaceRepository";
import { NotificationRepository } from "@/lib/repositories/NotificationRepository";
import type { Bid } from "@/types";

export class BidService {
  private bidRepo = new BidRepository();
  private listingRepo = new MarketplaceRepository();
  private notifRepo = new NotificationRepository();

  async placeBid(
    listingId: string,
    userId: string,
    amount: number
  ): Promise<{ success: Bid } | { error: string }> {
    const listing = await this.listingRepo.findById(listingId);
    if (!listing) return { error: "Listing not found" };
    if (listing.listing_type !== "auction") return { error: "Listing is not an auction" };
    if (listing.status !== "active") return { error: "Auction is not active" };
    if (listing.user_id === userId) return { error: "Cannot bid on your own listing" };

    if (listing.end_time && new Date(listing.end_time) <= new Date()) {
      return { error: "Auction has already ended" };
    }

    if (!listing.starting_bid || amount < listing.starting_bid) {
      return { error: `Bid must be at least ${listing.starting_bid}` };
    }

    const highestBid = await this.bidRepo.findHighestForListing(listingId);
    if (highestBid) {
      const minIncrement = listing.min_increment || 1;
      const minBid = highestBid.amount + minIncrement;
      if (amount < minBid) {
        return { error: `Bid must be at least ${minBid} (current highest + minimum increment)` };
      }
    }

    try {
      const bid = await this.bidRepo.create({
        listing_id: listingId,
        user_id: userId,
        amount,
      });

      if (highestBid && highestBid.user_id !== userId) {
        try {
          await this.notifRepo.create({
            user_id: highestBid.user_id,
            type: "marketplace_outbid",
            title: "You've been outbid!",
            body: `Someone placed a higher bid of ${amount.toLocaleString()} points on "${listing.points_amount.toLocaleString()} point auction"`,
            data: { listing_id: listingId, bid_amount: amount },
          });
        } catch {}
      }

      return { success: bid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to place bid";
      return { error: message };
    }
  }

  async getBids(listingId: string): Promise<Bid[]> {
    return this.bidRepo.findByListing(listingId);
  }

  async getUserBids(userId: string): Promise<Bid[]> {
    return this.bidRepo.findByUser(userId);
  }

  async getHighestBid(listingId: string): Promise<Bid | null> {
    return this.bidRepo.findHighestForListing(listingId);
  }
}
