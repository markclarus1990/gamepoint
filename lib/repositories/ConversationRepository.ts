import { supabase } from "@/lib/supabase";
import type { Conversation } from "@/types";

export class ConversationRepository {
  async findById(id: string): Promise<Conversation | null> {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  async findByUserId(userId: string): Promise<Conversation | null> {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  }

  async create(userId: string): Promise<Conversation> {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateStatus(id: string, status: "open" | "closed"): Promise<void> {
    await supabase
      .from("conversations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  async findAllWithDetails(): Promise<
    {
      id: string;
      user_id: string;
      user_name: string;
      user_avatar: string | null;
      status: string;
      last_message: string | null;
      last_message_at: string | null;
      unread_count: number;
      created_at: string;
      updated_at: string;
    }[]
  > {
    const { data: conversations } = await supabase
      .from("conversations")
      .select("*, users(name, avatar_url)")
      .order("updated_at", { ascending: false });

    if (!conversations) return [];

    const results = await Promise.all(
      conversations.map(async (conv) => {
        const { data: lastMessage } = await supabase
          .from("messages")
          .select("content, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count: unreadCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("sender_role", "player")
          .is("read_at", null);

        return {
          id: conv.id,
          user_id: conv.user_id,
          user_name: conv.users?.name ?? "Unknown",
          user_avatar: conv.users?.avatar_url ?? null,
          status: conv.status,
          last_message: lastMessage?.content ?? null,
          last_message_at: lastMessage?.created_at ?? conv.updated_at,
          unread_count: unreadCount ?? 0,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
        };
      })
    );

    return results;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const conv = await this.findByUserId(userId);
    if (!conv) return 0;

    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
      .eq("sender_role", "admin")
      .is("read_at", null);

    return count ?? 0;
  }
}
