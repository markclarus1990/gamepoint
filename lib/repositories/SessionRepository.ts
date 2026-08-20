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
    station_name?: string;
    status: string;
    starts_at: string;
    ends_at: string;
    payment_method: string;
    points_used: number;
    gfunds_used: number;
  }): Promise<Session> {
    const { data: row, error } = await supabase
      .from("sessions")
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return row;
  }

  async findActiveByStation(stationName: string): Promise<Session | null> {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("station_name", stationName)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }

  async findActiveForUser(userId: string): Promise<Session | null> {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }

  async findAllActive(): Promise<Session[]> {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString());
    return data || [];
  }

  async findAllPaused(): Promise<Session[]> {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("status", "paused")
      .gt("resume_seconds", 0)
      .order("created_at", { ascending: false });
    return data || [];
  }

  async expireOverdue(): Promise<void> {
    const { error } = await supabase
      .from("sessions")
      .update({ status: "expired" })
      .eq("status", "active")
      .lte("ends_at", new Date().toISOString());
    if (error) throw error;
  }

  async endActiveByStation(stationName: string): Promise<void> {
    const { error } = await supabase
      .from("sessions")
      .update({ status: "completed", ends_at: new Date().toISOString() })
      .eq("station_name", stationName)
      .eq("status", "active");
    if (error) throw error;
  }

  async findPausedForUser(userId: string): Promise<Session | null> {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "paused")
      .gt("resume_seconds", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }

  async pauseActiveByStation(stationName: string, resumeSeconds: number): Promise<void> {
    const { error } = await supabase
      .from("sessions")
      .update({ status: "paused", resume_seconds: resumeSeconds })
      .eq("station_name", stationName)
      .eq("status", "active");
    if (error) throw error;
  }

  async discardPausedForUser(userId: string): Promise<void> {
    const { error } = await supabase
      .from("sessions")
      .update({ status: "completed", resume_seconds: 0 })
      .eq("user_id", userId)
      .eq("status", "paused");
    if (error) throw error;
  }

  async resumeSession(id: string, stationName: string, seconds: number): Promise<void> {
    const endsAt = new Date(Date.now() + seconds * 1000).toISOString();
    const { error } = await supabase
      .from("sessions")
      .update({
        status: "active",
        ends_at: endsAt,
        station_name: stationName,
        resume_seconds: 0,
      })
      .eq("id", id);
    if (error) throw error;
  }

  async updateEndsAt(id: string, endsAt: string): Promise<void> {
    const { error } = await supabase
      .from("sessions")
      .update({ ends_at: endsAt })
      .eq("id", id);
    if (error) throw error;
  }

  async findAllWithMinutes(limit?: number, offset?: number): Promise<Pick<Session, "user_name" | "minutes">[]> {
    let query = supabase.from("sessions").select("user_name, minutes");
    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + (limit ?? 1000) - 1);
    const { data } = await query;
    return data || [];
  }
}
