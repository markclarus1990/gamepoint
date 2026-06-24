import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  async findByName(name: string, caseInsensitive = false): Promise<User | null> {
    let query = supabase.from("users").select("*");
    if (caseInsensitive) {
      query = query.ilike("name", name);
    } else {
      query = query.eq("name", name);
    }
    const { data } = await query.maybeSingle();
    return data;
  }

  async existsByName(name: string): Promise<boolean> {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    return !!data;
  }

  async create(name: string, pin: string): Promise<void> {
    const { error } = await supabase.from("users").insert({ name, pin, points: 0 });
    if (error) throw error;
  }

  async updatePointsByName(name: string, points: number): Promise<void> {
    await supabase.from("users").update({ points }).eq("name", name);
  }

  async updatePointsById(id: string, points: number): Promise<void> {
    await supabase.from("users").update({ points }).eq("id", id);
  }

  async updatePin(id: string, pin: string): Promise<void> {
    const { error } = await supabase.from("users").update({ pin }).eq("id", id);
    if (error) throw error;
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", id);
    if (error) throw error;
  }

  async findAll(orderBy?: string, page?: number, pageSize?: number): Promise<{ data: User[]; total: number }> {
    let query = supabase.from("users").select("*", { count: "exact" });
    if (orderBy) {
      query = query.order(orderBy, { ascending: false });
    }
    if (page !== undefined && pageSize !== undefined) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }
    const { data, count } = await query;
    return { data: data || [], total: count ?? 0 };
  }

  async findNamesWithAvatars(names: string[]): Promise<Pick<User, "name" | "avatar_url">[]> {
    if (names.length === 0) return [];
    const { data } = await supabase
      .from("users")
      .select("name, avatar_url")
      .in("name", names);
    return data || [];
  }
}
