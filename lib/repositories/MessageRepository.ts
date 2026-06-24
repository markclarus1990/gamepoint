import { supabase } from "@/lib/supabase";
import type { Message } from "@/types";

export class MessageRepository {
  async findByConversationId(conversationId: string): Promise<Message[]> {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    return data || [];
  }

  async create(data: {
    conversation_id: string;
    sender_id: string;
    sender_role: "player" | "admin";
    content: string;
  }): Promise<Message> {
    const { data: message, error } = await supabase
      .from("messages")
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return message;
  }

  async markAsRead(
    conversationId: string,
    senderRole: "player" | "admin"
  ): Promise<void> {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("sender_role", senderRole)
      .is("read_at", null);
  }
}
