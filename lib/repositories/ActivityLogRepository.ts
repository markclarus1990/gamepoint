import { supabase } from "@/lib/supabase";
import type { ActivityLogEntry } from "@/types";

export class ActivityLogRepository {
  async log(entry: {
    actor_id?: string | null;
    actor_name: string;
    actor_role?: string;
    action: string;
    target_type?: string | null;
    target_id?: string | null;
    details?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await supabase.from("activity_log").insert({
        actor_id: entry.actor_id ?? null,
        actor_name: entry.actor_name,
        actor_role: entry.actor_role ?? "player",
        action: entry.action,
        target_type: entry.target_type ?? null,
        target_id: entry.target_id ?? null,
        details: entry.details ?? null,
      });
    } catch {
      // logging must never break the main flow
    }
  }

  async findAll(filters?: {
    fromDate?: string | null;
    toDate?: string | null;
    actor?: string | null;
    action?: string | null;
    search?: string | null;
    page?: number;
    pageSize?: number;
  }): Promise<{
    data: ActivityLogEntry[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 50;

    let query = supabase
      .from("activity_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters?.fromDate) {
      const from = new Date(filters.fromDate);
      if (!isNaN(from.getTime())) {
        query = query.gte("created_at", from.toISOString());
      }
    }
    if (filters?.toDate) {
      const to = new Date(filters.toDate);
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        query = query.lte("created_at", to.toISOString());
      }
    }
    if (filters?.actor) {
      query = query.eq("actor_name", filters.actor);
    }
    if (filters?.action) {
      query = query.eq("action", filters.action);
    }
    if (filters?.search) {
      const s = filters.search.replace(/[%_,().]/g, "");
      query = query.or(
        `actor_name.ilike.%${s}%,action.ilike.%${s}%,target_id.ilike.%${s}%`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count } = await query;
    return {
      data: (data as ActivityLogEntry[]) || [],
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async getByActor(actorName: string, limit = 100): Promise<ActivityLogEntry[]> {
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .eq("actor_name", actorName)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data as ActivityLogEntry[]) || [];
  }

  async getByUser(userName: string, limit = 200): Promise<ActivityLogEntry[]> {
    // Events where the player was the actor OR the target
    // (e.g. received a share, got loaded by admin).
    // Two separate queries merged in JS to avoid PostgREST
    // parsing issues with special characters in usernames.
    const [asActor, asTarget] = await Promise.all([
      supabase
        .from("activity_log")
        .select("*")
        .ilike("actor_name", userName)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("activity_log")
        .select("*")
        .ilike("target_id", userName)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    const seen = new Set<string>();
    const merged = [
      ...((asActor.data as ActivityLogEntry[]) || []),
      ...((asTarget.data as ActivityLogEntry[]) || []),
    ].filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    merged.sort((a, b) =>
      String(a.created_at) < String(b.created_at) ? 1 : -1
    );
    return merged.slice(0, limit);
  }

  async getRecent(limit = 50): Promise<ActivityLogEntry[]> {
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data as ActivityLogEntry[]) || [];
  }
}
