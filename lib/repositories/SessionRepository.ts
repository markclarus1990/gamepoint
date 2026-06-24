import { supabase } from "@/lib/supabase";
import type { Session } from "@/types";

export class SessionRepository {
  async findByUserName(userName: string): Promise<Session[]> {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_name", userName);
    return data || [];
  }

  async findByUserId(userId: string): Promise<Session[]> {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId);
    return data || [];
  }

  async create(data: {
    user_name: string;
    user_id?: string;
    amount: number;
    minutes: number;
    points: number;
  }): Promise<void> {
    await supabase.from("sessions").insert(data);
  }

  async findAllWithMinutes(limit?: number, offset?: number): Promise<Pick<Session, "user_name" | "minutes">[]> {
    let query = supabase.from("sessions").select("user_name, minutes");
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit ?? 1000) - 1);
    const { data } = await query;
    return data || [];
  }
}
