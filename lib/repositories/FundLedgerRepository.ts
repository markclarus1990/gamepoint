import { supabase } from "@/lib/supabase";
import type { FundLedgerEntry } from "@/types";

export class FundLedgerRepository {
  async findByUser(
    userId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ data: FundLedgerEntry[]; total: number }> {
    let query = supabase
      .from("fund_ledger")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (page !== undefined && pageSize !== undefined) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, count } = await query;
    return { data: (data as FundLedgerEntry[]) || [], total: count ?? 0 };
  }

  async log(entry: {
    user_id: string;
    type: string;
    amount: number;
    balance_before: number;
    balance_after: number;
    reference_type?: string | null;
    reference_id?: string | null;
    description?: string | null;
  }): Promise<void> {
    try {
      await supabase.from("fund_ledger").insert({
        user_id: entry.user_id,
        type: entry.type,
        amount: entry.amount,
        balance_before: entry.balance_before,
        balance_after: entry.balance_after,
        reference_type: entry.reference_type ?? null,
        reference_id: entry.reference_id ?? null,
        description: entry.description ?? null,
      });
    } catch {
      // ledger logging must never break the main flow
    }
  }
}
