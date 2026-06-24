import { supabase } from "@/lib/supabase";
import type { RedeemRequest } from "@/types";

export class RedeemRepository {
  async findByUserId(userId: string): Promise<RedeemRequest[]> {
    const { data } = await supabase
      .from("redeem_requests")
      .select("*")
      .eq("user_id", userId);
    return data || [];
  }

  async findPending(): Promise<RedeemRequest[]> {
    const { data } = await supabase
      .from("redeem_requests")
      .select("*, users(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    return data || [];
  }

  async findById(id: string): Promise<RedeemRequest | null> {
    const { data } = await supabase
      .from("redeem_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  async findExistingPending(userId: string): Promise<RedeemRequest | null> {
    const { data } = await supabase
      .from("redeem_requests")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    return data;
  }

  async create(data: {
    user_id: string;
    points_used: number;
    minutes: number;
    status: string;
  }): Promise<void> {
    const { error } = await supabase.from("redeem_requests").insert(data);
    if (error) throw error;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await supabase.from("redeem_requests").update({ status }).eq("id", id);
  }
}
