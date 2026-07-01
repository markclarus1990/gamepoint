import { supabase } from "@/lib/supabase";
import type { PointLedgerEntry } from "@/types";

export class LedgerRepository {
  async findByUser(
    userId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ data: PointLedgerEntry[]; total: number }> {
    let query = supabase
      .from("point_ledger")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
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
