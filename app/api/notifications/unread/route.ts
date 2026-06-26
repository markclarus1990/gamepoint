import { NotificationService } from "@/lib/services/NotificationService";

const notificationService = new NotificationService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const count = await notificationService.getUnreadCount(userId);
  return Response.json({ count });
}
