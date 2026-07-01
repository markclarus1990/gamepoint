import { supabase } from "@/lib/supabase";
import type { Bid } from "@/types";

export class BidRepository {
  async findByListing(listingId: string): Promise<Bid[]> {
    const { data } = await supabase
      .from("bids")
      .select("*, users(name, avatar_url)")
      .eq("listing_id", listingId)
      .order("amount", { ascending: false });
    return data || [];
  }

  async findByUser(userId: string): Promise<Bid[]> {
    const { data } = await supabase
      .from("bids")
      .select("*, users!inner(name, avatar_url), marketplace_posts!inner(id, points_amount, status, listing_type)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data || [];
  }

  async findHighestForListing(listingId: string): Promise<Bid | null> {
    const { data } = await supabase
      .from("bids")
      .select("*, users(name, avatar_url)")
      .eq("listing_id", listingId)
      .order("amount", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }

  async create(data: {
    listing_id: string;
    user_id: string;
    amount: number;
  }): Promise<Bid> {
    const { data: bid, error } = await supabase
      .from("bids")
      .insert(data)
      .select("*, users(name, avatar_url)")
      .single();
    if (error) throw error;
    return bid;
  }
}
