import { ChatService } from "@/lib/services/ChatService";

const chatService = new ChatService();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") as "player" | "admin" | "direct" | null;
  const userId = searchParams.get("userId");

  if (role === "direct" && userId) {
    const messages = await chatService.getDirectMessages(id, userId);
    return Response.json(messages);
  }

  const messages = await chatService.getMessages(id, (role ?? "player") as "player" | "admin");
  return Response.json(messages);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { sender_id, sender_role, content } = body;

  if (!sender_id || !sender_role || !content) {
    return Response.json(
      { error: "sender_id, sender_role, and content are required" },
      { status: 400 }
    );
  }

  const message = await chatService.sendMessage({
    conversation_id: id,
    sender_id,
    sender_role,
    content,
  });

  return Response.json(message);
}
