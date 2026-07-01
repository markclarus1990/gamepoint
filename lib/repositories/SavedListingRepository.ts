import { supabase } from "@/lib/supabase";
import type { MarketplacePost } from "@/types";

export class SavedListingRepository {
  async findByUser(userId: string): Promise<MarketplacePost[]> {
    const { data } = await supabase
      .from("saved_listings")
      .select("listing:marketplace_posts(*, users(name, avatar_url))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!data) return [];
    return data.map((d) => d.listing as unknown as MarketplacePost);
  }

  async isSaved(userId: string, listingId: string): Promise<boolean> {
    const { data } = await supabase
      .from("saved_listings")
      .select("user_id")
      .eq("user_id", userId)
      .eq("listing_id", listingId)
      .maybeSingle();
    return !!data;
  }

  async save(userId: string, listingId: string): Promise<void> {
    const { error } = await supabase
      .from("saved_listings")
      .insert({ user_id: userId, listing_id: listingId });
    if (error && error.code !== "23505") throw error;
  }

  async unsave(userId: string, listingId: string): Promise<void> {
    await supabase
      .from("saved_listings")
      .delete()
      .eq("user_id", userId)
      .eq("listing_id", listingId);
  }
}
