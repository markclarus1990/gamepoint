import { ChatService } from "@/lib/services/ChatService";

const chatService = new ChatService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const conversations = await chatService.getDirectConversations(userId);
  return Response.json(conversations);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { userId, participantId } = body;

  if (!userId || !participantId) {
    return Response.json(
      { error: "userId and participantId are required" },
      { status: 400 }
    );
  }

  if (userId === participantId) {
    return Response.json(
      { error: "Cannot start a conversation with yourself" },
      { status: 400 }
    );
  }

  const conversationId = await chatService.getOrCreateDirectConversation(
    userId,
    participantId
  );
  return Response.json({ conversationId });
}
