import { ChatService } from "@/lib/services/ChatService";

const chatService = new ChatService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (userId) {
    const conversation = await chatService.getOrCreateConversation(userId);
    return Response.json({ conversation });
  }

  const conversations = await chatService.getConversationsForAdmin();
  return Response.json(conversations);
}

export async function POST(req: Request) {
  const { userId } = await req.json();
  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const conversation = await chatService.getOrCreateConversation(userId);
  return Response.json({ conversation });
}
