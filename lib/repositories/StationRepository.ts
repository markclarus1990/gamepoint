import { supabase } from "@/lib/supabase";
import type { Station } from "@/types";

export class StationRepository {
  async create(name: string, agentKey: string): Promise<Station> {
    const { data, error } = await supabase
      .from("stations")
      .insert({ name, agent_key: agentKey })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findAll(): Promise<Station[]> {
    const { data } = await supabase
      .from("stations")
      .select("*")
      .order("name", { ascending: true });
    return data || [];
  }

  async findByName(name: string): Promise<Station | null> {
    const { data } = await supabase
      .from("stations")
      .select("*")
      .eq("name", name)
      .maybeSingle();
    return data;
  }

  async findByKey(agentKey: string): Promise<Station | null> {
    const { data } = await supabase
      .from("stations")
      .select("*")
      .eq("agent_key", agentKey)
      .maybeSingle();
    return data;
  }

  async updateLastSeen(id: string): Promise<void> {
    await supabase
      .from("stations")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", id);
  }

  async remove(id: string): Promise<void> {
    await supabase.from("stations").delete().eq("id", id);
  }
}
