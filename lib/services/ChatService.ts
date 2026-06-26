import { ConversationRepository } from "@/lib/repositories/ConversationRepository";
import { MessageRepository } from "@/lib/repositories/MessageRepository";
import { NotificationRepository } from "@/lib/repositories/NotificationRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import type { Conversation, Message, DirectConversationSummary } from "@/types";

export class ChatService {
  private convRepo = new ConversationRepository();
  private msgRepo = new MessageRepository();
  private notifRepo = new NotificationRepository();
  private userRepo = new UserRepository();

  async getOrCreateConversation(
    userId: string
  ): Promise<Conversation> {
    const existing = await this.convRepo.findByUserId(userId);
    if (existing) return existing;
    return this.convRepo.create(userId);
  }

  async getMessages(
    conversationId: string,
    role: "player" | "admin"
  ): Promise<Message[]> {
    await this.msgRepo.markAsRead(conversationId, role === "player" ? "admin" : "player");
    return this.msgRepo.findByConversationId(conversationId);
  }

  async sendMessage(data: {
    conversation_id: string;
    sender_id: string;
    sender_role: "player" | "admin";
    content: string;
  }): Promise<Message> {
    const msg = await this.msgRepo.create(data);
    await this.convRepo.updateStatus(data.conversation_id, "open");

    if (data.sender_role === "admin") {
      const conv = await this.convRepo.findById(data.conversation_id);
      if (conv && conv.user_id !== data.sender_id) {
        try {
          await this.notifRepo.create({
            user_id: conv.user_id,
            type: "admin_reply",
            title: "Admin replied to your support ticket",
            body: data.content.slice(0, 200),
            data: { conversation_id: data.conversation_id },
          });
        } catch {}
      }
    }

    return msg;
  }

  async getConversationsForAdmin() {
    return this.convRepo.findAllWithDetails();
  }

  async getConversation(
    conversationId: string
  ): Promise<Conversation | null> {
    return this.convRepo.findById(conversationId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.convRepo.getUnreadCount(userId);
  }

  async getDirectConversations(
    userId: string
  ): Promise<DirectConversationSummary[]> {
    return this.convRepo.findDirectConversationsForUser(userId);
  }

  async getOrCreateDirectConversation(
    userId1: string,
    userId2: string
  ): Promise<string> {
    const existing = await this.convRepo.findExistingDirectConversation(
      userId1,
      userId2
    );
    if (existing) return existing;
    return this.convRepo.createDirectConversation(userId1, userId2);
  }

  async getDirectMessages(
    conversationId: string,
    userId: string
  ): Promise<Message[]> {
    await this.msgRepo.markDirectMessagesAsRead(conversationId, userId);
    return this.msgRepo.findByConversationId(conversationId);
  }

  async sendDirectMessage(
    conversationId: string,
    senderId: string,
    content: string
  ): Promise<Message> {
    const msg = await this.msgRepo.create({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: "player",
      content,
    });

    try {
      const participants = await this.convRepo.findParticipants(conversationId);
      const receiver = participants.find((p) => p.user_id !== senderId);
      if (receiver) {
        const sender = await this.userRepo.findById(senderId);
        await this.notifRepo.create({
          user_id: receiver.user_id,
          type: "direct_message",
          title: `New message from ${sender?.name || "Unknown"}`,
          body: content.slice(0, 200),
          data: { conversation_id: conversationId, sender_id: senderId },
        });
      }
    } catch {}

    return msg;
  }

  async getDirectUnreadCount(userId: string): Promise<number> {
    return this.convRepo.getDirectUnreadCount(userId);
  }
}
