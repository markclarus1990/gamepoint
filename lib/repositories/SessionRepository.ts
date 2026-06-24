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

  async findAllWithMinutes(): Promise<Pick<Session, "user_name" | "minutes">[]> {
    const { data } = await supabase
      .from("sessions")
      .select("user_name, minutes");
    return data || [];
  }
}
