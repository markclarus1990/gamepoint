import { supabase } from "@/lib/supabase";
import type { AppNotification } from "@/types";

export class NotificationRepository {
  async findByUser(
    userId: string,
    page?: number,
    pageSize?: number
  ): Promise<{ data: AppNotification[]; total: number }> {
    let query = supabase
      .from("notifications")
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

  async findById(id: string): Promise<AppNotification | null> {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  async findUnreadCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    return count ?? 0;
  }

  async create(data: {
    user_id: string;
    type: string;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
  }): Promise<AppNotification> {
    const { data: notif, error } = await supabase
      .from("notifications")
      .insert({
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        body: data.body || null,
        data: data.data || null,
      })
      .select()
      .single();
    if (error) throw error;
    return notif;
  }

  async markRead(id: string): Promise<void> {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  }

  async markAllRead(userId: string): Promise<void> {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
  }
}
