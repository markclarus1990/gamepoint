import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types";

export class TransactionRepository {
  async findById(id: string): Promise<Transaction | null> {
    const { data } = await supabase
      .from("transactions")
      .select("*, seller:users!seller_id(name, avatar_url), buyer:users!buyer_id(name, avatar_url), listing:marketplace_posts(*)")
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  async findByListing(listingId: string): Promise<Transaction | null> {
    const { data } = await supabase
      .from("transactions")
      .select("*, seller:users!seller_id(name, avatar_url), buyer:users!buyer_id(name, avatar_url)")
      .eq("listing_id", listingId)
      .maybeSingle();
    return data;
  }

  async findPurchasesByUser(
    userId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ data: Transaction[]; total: number }> {
    let query = supabase
      .from("transactions")
      .select("*, seller:users!seller_id(name, avatar_url), buyer:users!buyer_id(name, avatar_url), listing:marketplace_posts(*)", { count: "exact" })
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false });

    if (page !== undefined && pageSize !== undefined) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, count } = await query;
    return { data: data || [], total: count ?? 0 };
  }

  async findSalesByUser(
    userId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ data: Transaction[]; total: number }> {
    let query = supabase
      .from("transactions")
      .select("*, seller:users!seller_id(name, avatar_url), buyer:users!buyer_id(name, avatar_url), listing:marketplace_posts(*)", { count: "exact" })
      .eq("seller_id", userId)
      .order("created_at", { ascending: false });

    if (page !== undefined && pageSize !== undefined) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, count } = await query;
    return { data: data || [], total: count ?? 0 };
  }

  async findAllByUser(
    userId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ data: Transaction[]; total: number }> {
    let query = supabase
      .from("transactions")
      .select("*, seller:users!seller_id(name, avatar_url), buyer:users!buyer_id(name, avatar_url), listing:marketplace_posts(*)", { count: "exact" })
      .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (page !== undefined && pageSize !== undefined) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, count } = await query;
    return { data: data || [], total: count ?? 0 };
  }
}
