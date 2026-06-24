import { ConversationRepository } from "@/lib/repositories/ConversationRepository";
import { MessageRepository } from "@/lib/repositories/MessageRepository";
import type { Conversation, Message, DirectConversationSummary } from "@/types";

export class ChatService {
  private convRepo = new ConversationRepository();
  private msgRepo = new MessageRepository();

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
    await this.convRepo.updateStatus(data.conversation_id, "open");
    return this.msgRepo.create(data);
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
    return this.msgRepo.create({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: "player",
      content,
    });
  }

  async getDirectUnreadCount(userId: string): Promise<number> {
    return this.convRepo.getDirectUnreadCount(userId);
  }
}
