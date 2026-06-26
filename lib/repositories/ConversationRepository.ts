import { supabase } from "@/lib/supabase";
import type { Conversation, DirectConversationSummary } from "@/types";

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
      .eq("type", "support")
      .maybeSingle();
    return data;
  }

  async create(userId: string): Promise<Conversation> {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: userId, type: "support" })
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
      .eq("type", "support")
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

  async findDirectConversationsForUser(
    userId: string
  ): Promise<DirectConversationSummary[]> {
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    if (!participations || participations.length === 0) return [];

    const conversationIds = participations.map((p) => p.conversation_id);

    const { data: conversations } = await supabase
      .from("conversations")
      .select("*")
      .in("id", conversationIds)
      .eq("type", "direct")
      .order("updated_at", { ascending: false });

    if (!conversations) return [];

    const results = await Promise.all(
      conversations.map(async (conv) => {
        const { data: participants } = await supabase
          .from("conversation_participants")
          .select("user_id, users!inner(name, avatar_url)")
          .eq("conversation_id", conv.id);

        const otherUser = (participants || []).find(
          (p) => p.user_id !== userId
        );

        const userData = otherUser?.users as
          | { name: string; avatar_url: string | null }
          | undefined;

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
          .neq("sender_id", userId)
          .is("read_at", null);

        return {
          id: conv.id,
          other_user: {
            id: otherUser?.user_id ?? "",
            name: userData?.name ?? "Unknown",
            avatar_url: userData?.avatar_url ?? null,
          },
          last_message: lastMessage?.content ?? null,
          last_message_at: lastMessage?.created_at ?? conv.updated_at,
          unread_count: unreadCount ?? 0,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
        };
      })
    );

    return results.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  async findExistingDirectConversation(
    userId1: string,
    userId2: string
  ): Promise<string | null> {
    const { data: p1 } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId1);

    if (!p1 || p1.length === 0) return null;

    const ids1 = p1.map((p) => p.conversation_id);

    const { data: p2 } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId2)
      .in("conversation_id", ids1);

    if (!p2 || p2.length === 0) return null;

    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", p2[0].conversation_id)
      .eq("type", "direct")
      .maybeSingle();

    return conv?.id ?? null;
  }

  async findParticipants(
    conversationId: string
  ): Promise<{ user_id: string }[]> {
    const { data } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId);
    return data || [];
  }

  async createDirectConversation(
    creatorId: string,
    otherUserId: string
  ): Promise<string> {
    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ user_id: creatorId, type: "direct" })
      .select()
      .single();

    if (error) throw error;

    await supabase.from("conversation_participants").insert([
      { conversation_id: conv.id, user_id: creatorId },
      { conversation_id: conv.id, user_id: otherUserId },
    ]);

    return conv.id;
  }

  async getDirectUnreadCount(userId: string): Promise<number> {
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    if (!participations || participations.length === 0) return 0;

    const ids = participations.map((p) => p.conversation_id);

    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", ids)
      .neq("sender_id", userId)
      .is("read_at", null);

    return count ?? 0;
  }
}
