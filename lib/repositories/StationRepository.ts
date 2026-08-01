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

  async setCommand(
    ids: string[],
    command: string,
    all = false
  ): Promise<void> {
    if (all) {
      const { data } = await supabase.from("stations").select("id");
      ids = (data ?? []).map((s) => s.id);
      if (ids.length === 0) return;
    }
    const { error } = await supabase
      .from("stations")
      .update({ command, command_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw error;
  }

  async clearCommand(id: string): Promise<void> {
    const { error } = await supabase
      .from("stations")
      .update({ command: null, command_at: null })
      .eq("id", id);
    if (error) throw error;
  }

  async saveScreenshot(id: string, url: string): Promise<void> {
    const { error } = await supabase
      .from("stations")
      .update({ screenshot_url: url, screenshot_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }
}
