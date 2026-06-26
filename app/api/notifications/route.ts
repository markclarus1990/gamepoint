import { NotificationService } from "@/lib/services/NotificationService";

const notificationService = new NotificationService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");

  const result = await notificationService.getNotifications(
    userId,
    page ? Number(page) : undefined,
    pageSize ? Number(pageSize) : undefined
  );

  return Response.json(result);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { userId } = body;

  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const result = await notificationService.markAllRead(userId);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ success: true });
}
